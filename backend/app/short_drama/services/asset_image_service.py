from __future__ import annotations

import logging
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from ...config import settings
from ...database import SessionLocal
from ..models import CharacterAsset, ProductAsset, SceneAsset, ShortDramaProject
from ..providers.generated_image import GeneratedImage
from ..providers.image_provider_factory import build_short_drama_image_provider
from ..utils.image_prompts import prepare_image_prompt, prepare_image_prompt_v2_asset_spec_pass_through
from ..utils.image_storage import mime_to_ext, save_image_bytes
from .workflow_orchestrator import orchestrator
from .project_task_guard import current_stage

logger = logging.getLogger(__name__)

_CHARACTER_PROMPT_CORE_GUARDS = [
    "one single person only",
    "one character reference image",
    "single subject centered",
    "full body or half body portrait",
    "no multiple people",
    "no collage",
    "no grid",
    "no contact sheet",
    "no lineup",
]


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _should_skip_prompt_mutations(meta: dict[str, Any]) -> bool:
    if meta.get("v2_asset_spec_pass_through"):
        return True
    tf = meta.get("type_fields")
    if isinstance(tf, dict) and tf.get("asset_spec_source") == "s2_asset_generation_specs":
        return True
    return False


def _enforce_character_prompt_constraints(prompt: str, *, project_id: int, asset_id: int) -> str:
    base = str(prompt or "").strip()
    missing = [rule for rule in _CHARACTER_PROMPT_CORE_GUARDS if rule.lower() not in base.lower()]
    if not missing:
        return base
    fixed = re.sub(r"\s+", " ", f"{base}. {'; '.join(missing)}").strip(" .;")
    logger.info(
        "[S3_CHARACTER_PROMPT_CONSTRAINTS_ENFORCED] %s",
        {"project_id": project_id, "asset_id": asset_id, "added_constraints": missing},
    )
    return fixed


@dataclass
class AssetImageBatchResult:
    project_id: int
    characters_attempted: int = 0
    characters_succeeded: int = 0
    scenes_attempted: int = 0
    scenes_succeeded: int = 0
    products_attempted: int = 0
    products_succeeded: int = 0
    errors: list[dict[str, Any]] = field(default_factory=list)

    @property
    def had_attempts(self) -> bool:
        return (
            self.characters_attempted + self.scenes_attempted + self.products_attempted
        ) > 0

    @property
    def any_success(self) -> bool:
        return (
            self.characters_succeeded + self.scenes_succeeded + self.products_succeeded
        ) > 0


class AssetImageService:
    def __init__(self, provider: Any | None = None):
        self._provider = provider if provider is not None else build_short_drama_image_provider()

    def _mark_image_generation_failed(self, row: CharacterAsset | SceneAsset | ProductAsset, err: Exception) -> None:
        meta = dict(row.meta_json or {})
        meta["image_generation_status"] = "failed"
        meta["image_generation_error_type"] = type(err).__name__
        meta["image_generation_error_message"] = str(err)[:500]
        row.meta_json = meta

    def _clear_image_generation_failure(self, row: CharacterAsset | SceneAsset | ProductAsset) -> None:
        meta = dict(row.meta_json or {})
        meta.pop("image_generation_status", None)
        meta.pop("image_generation_error_type", None)
        meta.pop("image_generation_error_message", None)
        row.meta_json = meta

    def _max_workers(self) -> int:
        return max(1, int(settings.SHORT_DRAMA_IMAGE_MAX_CONCURRENT))

    def _total_asset_row_count(self, db: Session, project_id: int) -> int:
        nc = db.query(CharacterAsset).filter(CharacterAsset.project_id == project_id).count()
        ns = db.query(SceneAsset).filter(SceneAsset.project_id == project_id).count()
        np = db.query(ProductAsset).filter(ProductAsset.project_id == project_id).count()
        return int(nc + ns + np)

    def _prepare_project_for_asset_image_batch(self, db: Session, project: ShortDramaProject) -> None:
        """Unblock failed projects that still have asset rows; must run before begin_asset_image_render."""
        n = self._total_asset_row_count(db, project.id)
        orchestrator.normalize_failed_for_asset_image_retry(db, project, asset_row_count=n)

    def _run_parallel_character(
        self,
        project_id: int,
        rows: list[CharacterAsset],
    ) -> tuple[int, int, list[dict[str, Any]]]:
        if not rows:
            return 0, 0, []
        by_id = {r.id: r for r in rows}
        errors: list[dict[str, Any]] = []
        ok = 0

        def job(row: CharacterAsset) -> tuple[int, str | None, GeneratedImage | None, Exception | None]:
            try:
                _trace(
                    "S3_IMAGE_ROW_INPUT",
                    {
                        "project_id": project_id,
                        "asset_type": "character",
                        "asset_id": row.id,
                        "row_visual_prompt": row.visual_prompt,
                        "row_image_prompt": (row.meta_json or {}).get("type_fields", {}).get("image_prompt"),
                        "row_description": row.description,
                        "row_type_fields": (row.meta_json or {}).get("type_fields"),
                    },
                )
                meta0 = dict(row.meta_json or {})
                base_vp = str(row.visual_prompt or "").strip()
                if _should_skip_prompt_mutations(meta0):
                    audited_prompt = base_vp
                else:
                    audited_prompt = _enforce_character_prompt_constraints(
                        base_vp,
                        project_id=project_id,
                        asset_id=row.id,
                    )
                _trace(
                    "S3_IMAGE_PROMPT_BEFORE_PREPARE",
                    {"project_id": project_id, "asset_type": "character", "asset_id": row.id, "before_prompt": audited_prompt},
                )
                prompt = (
                    prepare_image_prompt_v2_asset_spec_pass_through(audited_prompt)
                    if _should_skip_prompt_mutations(meta0)
                    else prepare_image_prompt(audited_prompt)
                )
                _trace(
                    "S3_IMAGE_PROMPT_AFTER_PREPARE",
                    {
                        "project_id": project_id,
                        "asset_type": "character",
                        "asset_id": row.id,
                        "before_prompt": audited_prompt,
                        "after_prompt": prompt,
                        "added_parts": [],
                        "removed_parts": [],
                        "source": "ai_visual_prompt",
                    },
                )
                meta = dict(row.meta_json or {})
                seed = meta.get("generation_seed")
                gen = self._provider.generate_from_text(
                    prompt=prompt,
                    asset_type="character",
                    project_id=project_id,
                    asset_id=row.id,
                    metadata={
                        "generation_seed": seed,
                        "style_tags": meta.get("style_tags"),
                    },
                )
                ext = mime_to_ext(gen.mime_type)
                url = save_image_bytes(
                    project_id=project_id,
                    asset_type="character",
                    asset_id=row.id,
                    data=gen.data,
                    ext=ext,
                )
                return row.id, url, gen, None
            except Exception as e:
                return row.id, None, None, e

        with ThreadPoolExecutor(max_workers=min(self._max_workers(), len(rows))) as pool:
            futures = [pool.submit(job, r) for r in rows]
            for fut in as_completed(futures):
                rid, url, gen, err = fut.result()
                if err is not None:
                    row = by_id[rid]
                    self._mark_image_generation_failed(row, err)
                    logger.warning(
                        "ASSET_IMAGE_CHAR_FAIL project_id=%s asset_id=%s err=%s",
                        project_id,
                        rid,
                        err,
                    )
                    errors.append(
                        {
                            "asset_type": "character",
                            "asset_id": rid,
                            "error": str(err),
                            "error_type": type(err).__name__,
                        }
                    )
                    continue
                ok += 1
                row = by_id[rid]
                merged = dict(row.meta_json or {})
                if gen:
                    merged.update(gen.meta)
                row.image_url = url
                row.meta_json = merged
                self._clear_image_generation_failure(row)
        return len(rows), ok, errors

    def _run_parallel_scene(
        self,
        project_id: int,
        rows: list[SceneAsset],
    ) -> tuple[int, int, list[dict[str, Any]], dict[int, tuple[str, dict[str, Any]]]]:
        if not rows:
            return 0, 0, [], {}

        errors: list[dict[str, Any]] = []
        ok = 0
        results: dict[int, tuple[str, dict[str, Any]]] = {}

        def job(row: SceneAsset) -> tuple[int, str | None, GeneratedImage | None, Exception | None]:
            try:
                meta0 = dict(row.meta_json or {})
                base_vp = str(row.visual_prompt or "").strip()
                prompt = (
                    prepare_image_prompt_v2_asset_spec_pass_through(base_vp)
                    if _should_skip_prompt_mutations(meta0)
                    else prepare_image_prompt(base_vp)
                )
                meta = dict(row.meta_json or {})
                seed = meta.get("generation_seed")
                gen = self._provider.generate_from_text(
                    prompt=prompt,
                    asset_type="scene",
                    project_id=project_id,
                    asset_id=row.id,
                    metadata={"generation_seed": seed, "style_tags": meta.get("style_tags")},
                )
                ext = mime_to_ext(gen.mime_type)
                url = save_image_bytes(
                    project_id=project_id,
                    asset_type="scene",
                    asset_id=row.id,
                    data=gen.data,
                    ext=ext,
                )
                return row.id, url, gen, None
            except Exception as e:
                return row.id, None, None, e

        with ThreadPoolExecutor(max_workers=min(self._max_workers(), len(rows))) as pool:
            futures = [pool.submit(job, r) for r in rows]
            for fut in as_completed(futures):
                rid, url, gen, err = fut.result()
                if err is not None:
                    errors.append({"asset_type": "scene", "asset_id": rid, "error": str(err), "error_type": type(err).__name__})
                    continue
                ok += 1
                results[rid] = (str(url or ""), dict(gen.meta or {}))
        return len(rows), ok, errors, results

    def _run_parallel_product(
        self,
        project_id: int,
        rows: list[ProductAsset],
    ) -> tuple[int, int, list[dict[str, Any]], dict[int, tuple[str, dict[str, Any]]]]:
        if not rows:
            return 0, 0, [], {}

        errors: list[dict[str, Any]] = []
        ok = 0
        results: dict[int, tuple[str, dict[str, Any]]] = {}

        def job(row: ProductAsset) -> tuple[int, str | None, GeneratedImage | None, Exception | None]:
            try:
                meta0 = dict(row.meta_json or {})
                base_vp = str(row.visual_prompt or "").strip()
                prompt = (
                    prepare_image_prompt_v2_asset_spec_pass_through(base_vp)
                    if _should_skip_prompt_mutations(meta0)
                    else prepare_image_prompt(base_vp)
                )
                meta = dict(row.meta_json or {})
                seed = meta.get("generation_seed")
                gen = self._provider.generate_from_text(
                    prompt=prompt,
                    asset_type="product",
                    project_id=project_id,
                    asset_id=row.id,
                    metadata={"generation_seed": seed, "style_tags": meta.get("style_tags")},
                )
                ext = mime_to_ext(gen.mime_type)
                url = save_image_bytes(
                    project_id=project_id,
                    asset_type="product",
                    asset_id=row.id,
                    data=gen.data,
                    ext=ext,
                )
                return row.id, url, gen, None
            except Exception as e:
                return row.id, None, None, e

        with ThreadPoolExecutor(max_workers=min(self._max_workers(), len(rows))) as pool:
            futures = [pool.submit(job, r) for r in rows]
            for fut in as_completed(futures):
                rid, url, gen, err = fut.result()
                if err is not None:
                    errors.append({"asset_type": "product", "asset_id": rid, "error": str(err), "error_type": type(err).__name__})
                    continue
                ok += 1
                results[rid] = (str(url or ""), dict(gen.meta or {}))
        return len(rows), ok, errors, results

    def _writeback_image_result(self, *, project_id: int, asset_type: str, asset_id: int, image_url: str, meta_patch: dict[str, Any]) -> None:
        logger.info("[S3_DB_REOPEN_FOR_WRITEBACK] project_id=%s asset_type=%s asset_id=%s", project_id, asset_type, asset_id)
        wdb = SessionLocal()
        try:
            if asset_type == "character":
                row = wdb.query(CharacterAsset).filter(CharacterAsset.id == asset_id, CharacterAsset.project_id == project_id).first()
            elif asset_type == "scene":
                row = wdb.query(SceneAsset).filter(SceneAsset.id == asset_id, SceneAsset.project_id == project_id).first()
            else:
                row = wdb.query(ProductAsset).filter(ProductAsset.id == asset_id, ProductAsset.project_id == project_id).first()
            if row is None:
                wdb.rollback()
                return
            merged = dict(row.meta_json or {})
            merged.update(meta_patch or {})
            merged.pop("image_generation_status", None)
            merged.pop("image_generation_error_type", None)
            merged.pop("image_generation_error_message", None)
            row.image_url = image_url
            row.meta_json = merged
            wdb.add(row)
            wdb.commit()
        except Exception:
            wdb.rollback()
            raise
        finally:
            wdb.close()

    def _writeback_image_failure(self, *, project_id: int, asset_type: str, asset_id: int, error: str, error_type: str) -> None:
        logger.info("[S3_DB_REOPEN_FOR_IMAGE_FAILURE] project_id=%s asset_type=%s asset_id=%s", project_id, asset_type, asset_id)
        wdb = SessionLocal()
        try:
            if asset_type == "character":
                row = wdb.query(CharacterAsset).filter(CharacterAsset.id == asset_id, CharacterAsset.project_id == project_id).first()
            elif asset_type == "scene":
                row = wdb.query(SceneAsset).filter(SceneAsset.id == asset_id, SceneAsset.project_id == project_id).first()
            else:
                row = wdb.query(ProductAsset).filter(ProductAsset.id == asset_id, ProductAsset.project_id == project_id).first()
            if row is None:
                wdb.rollback()
                return
            meta = dict(row.meta_json or {})
            meta["image_generation_status"] = "failed"
            meta["image_generation_error_type"] = error_type
            meta["image_generation_error_message"] = str(error or "")[:500]
            row.meta_json = meta
            wdb.add(row)
            wdb.commit()
        except Exception:
            wdb.rollback()
            raise
        finally:
            wdb.close()

    def _apply_scene_results(
        self,
        db: Session,
        project_id: int,
        rows: list[SceneAsset],
    ) -> tuple[int, int, list[dict[str, Any]]]:
        if not rows:
            return 0, 0, []

        def job(row: SceneAsset) -> tuple[int, str | None, GeneratedImage | None, Exception | None]:
            try:
                _trace(
                    "S3_IMAGE_ROW_INPUT",
                    {
                        "project_id": project_id,
                        "asset_type": "scene",
                        "asset_id": row.id,
                        "row_visual_prompt": row.visual_prompt,
                        "row_image_prompt": (row.meta_json or {}).get("type_fields", {}).get("image_prompt"),
                        "row_description": row.description,
                        "row_type_fields": (row.meta_json or {}).get("type_fields"),
                    },
                )
                _trace("S3_IMAGE_PROMPT_BEFORE_PREPARE", {"project_id": project_id, "asset_type": "scene", "asset_id": row.id, "before_prompt": row.visual_prompt})
                meta0 = dict(row.meta_json or {})
                base_vp = str(row.visual_prompt or "").strip()
                prompt = (
                    prepare_image_prompt_v2_asset_spec_pass_through(base_vp)
                    if _should_skip_prompt_mutations(meta0)
                    else prepare_image_prompt(base_vp)
                )
                _trace("S3_IMAGE_PROMPT_AFTER_PREPARE", {"project_id": project_id, "asset_type": "scene", "asset_id": row.id, "before_prompt": row.visual_prompt, "after_prompt": prompt, "added_parts": [], "removed_parts": [], "source": "ai_visual_prompt"})
                meta = dict(row.meta_json or {})
                seed = meta.get("generation_seed")
                gen = self._provider.generate_from_text(
                    prompt=prompt,
                    asset_type="scene",
                    project_id=project_id,
                    asset_id=row.id,
                    metadata={
                        "generation_seed": seed,
                        "style_tags": meta.get("style_tags"),
                    },
                )
                ext = mime_to_ext(gen.mime_type)
                url = save_image_bytes(
                    project_id=project_id,
                    asset_type="scene",
                    asset_id=row.id,
                    data=gen.data,
                    ext=ext,
                )
                return row.id, url, gen, None
            except Exception as e:
                return row.id, None, None, e

        errors: list[dict[str, Any]] = []
        ok = 0
        with ThreadPoolExecutor(max_workers=min(self._max_workers(), len(rows))) as pool:
            futures = [pool.submit(job, r) for r in rows]
            for fut in as_completed(futures):
                rid, url, gen, err = fut.result()
                row = db.query(SceneAsset).filter(SceneAsset.id == rid).first()
                if not row:
                    continue
                if err is not None:
                    self._mark_image_generation_failed(row, err)
                    logger.warning(
                        "ASSET_IMAGE_SCENE_FAIL project_id=%s asset_id=%s err=%s",
                        project_id,
                        rid,
                        err,
                    )
                    errors.append(
                        {
                            "asset_type": "scene",
                            "asset_id": rid,
                            "error": str(err),
                            "error_type": type(err).__name__,
                        }
                    )
                    continue
                ok += 1
                merged = dict(row.meta_json or {})
                if gen:
                    merged.update(gen.meta)
                row.image_url = url
                row.meta_json = merged
                self._clear_image_generation_failure(row)
        return len(rows), ok, errors

    def _apply_product_results(
        self,
        db: Session,
        project_id: int,
        rows: list[ProductAsset],
    ) -> tuple[int, int, list[dict[str, Any]]]:
        if not rows:
            return 0, 0, []

        def job(row: ProductAsset) -> tuple[int, str | None, GeneratedImage | None, Exception | None]:
            try:
                _trace(
                    "S3_IMAGE_ROW_INPUT",
                    {
                        "project_id": project_id,
                        "asset_type": "product",
                        "asset_id": row.id,
                        "row_visual_prompt": row.visual_prompt,
                        "row_image_prompt": (row.meta_json or {}).get("type_fields", {}).get("image_prompt"),
                        "row_description": row.description,
                        "row_type_fields": (row.meta_json or {}).get("type_fields"),
                    },
                )
                _trace("S3_IMAGE_PROMPT_BEFORE_PREPARE", {"project_id": project_id, "asset_type": "product", "asset_id": row.id, "before_prompt": row.visual_prompt})
                meta0 = dict(row.meta_json or {})
                base_vp = str(row.visual_prompt or "").strip()
                prompt = (
                    prepare_image_prompt_v2_asset_spec_pass_through(base_vp)
                    if _should_skip_prompt_mutations(meta0)
                    else prepare_image_prompt(base_vp)
                )
                _trace("S3_IMAGE_PROMPT_AFTER_PREPARE", {"project_id": project_id, "asset_type": "product", "asset_id": row.id, "before_prompt": row.visual_prompt, "after_prompt": prompt, "added_parts": [], "removed_parts": [], "source": "ai_visual_prompt"})
                meta = dict(row.meta_json or {})
                seed = meta.get("generation_seed")
                gen = self._provider.generate_from_text(
                    prompt=prompt,
                    asset_type="product",
                    project_id=project_id,
                    asset_id=row.id,
                    metadata={
                        "generation_seed": seed,
                        "style_tags": meta.get("style_tags"),
                    },
                )
                ext = mime_to_ext(gen.mime_type)
                url = save_image_bytes(
                    project_id=project_id,
                    asset_type="product",
                    asset_id=row.id,
                    data=gen.data,
                    ext=ext,
                )
                return row.id, url, gen, None
            except Exception as e:
                return row.id, None, None, e

        errors: list[dict[str, Any]] = []
        ok = 0
        with ThreadPoolExecutor(max_workers=min(self._max_workers(), len(rows))) as pool:
            futures = [pool.submit(job, r) for r in rows]
            for fut in as_completed(futures):
                rid, url, gen, err = fut.result()
                row = db.query(ProductAsset).filter(ProductAsset.id == rid).first()
                if not row:
                    continue
                if err is not None:
                    self._mark_image_generation_failed(row, err)
                    logger.warning(
                        "ASSET_IMAGE_PRODUCT_FAIL project_id=%s asset_id=%s err=%s",
                        project_id,
                        rid,
                        err,
                    )
                    errors.append(
                        {
                            "asset_type": "product",
                            "asset_id": rid,
                            "error": str(err),
                            "error_type": type(err).__name__,
                        }
                    )
                    continue
                ok += 1
                merged = dict(row.meta_json or {})
                if gen:
                    merged.update(gen.meta)
                row.image_url = url
                row.meta_json = merged
                self._clear_image_generation_failure(row)
        return len(rows), ok, errors

    def _recover_after_image_batch_crash(self, db: Session, project_id: int) -> None:
        """Rollback uncommitted work and leave project retryable (not terminal failed)."""
        db.rollback()
        p = orchestrator.get_project(db, project_id)
        orchestrator.revert_to_asset_specs_after_image_batch_failure(
            db,
            p,
            reason="asset_image_batch_uncaught_exception",
        )
        db.commit()

    def regenerate_one_asset_image(
        self,
        db: Session,
        *,
        project_id: int,
        asset_type: str,
        asset_id: int,
    ) -> str:
        project = orchestrator.get_project(db, project_id)
        self._prepare_project_for_asset_image_batch(db, project)
        t = (asset_type or "").strip().lower()
        if t == "character":
            row = db.query(CharacterAsset).filter(CharacterAsset.project_id == project_id, CharacterAsset.id == asset_id).first()
            if row is None:
                raise ValueError("character asset not found")
            n, ok, errs = self._run_parallel_character(project_id, [row])
            if errs or ok <= 0:
                raise RuntimeError(errs[0].get("error") if errs else "character regenerate failed")
            db.add(row)
            db.commit()
            return str(row.image_url or "")
        if t == "scene":
            row = db.query(SceneAsset).filter(SceneAsset.project_id == project_id, SceneAsset.id == asset_id).first()
            if row is None:
                raise ValueError("scene asset not found")
            n, ok, errs = self._apply_scene_results(db, project_id, [row])
            if errs or ok <= 0:
                raise RuntimeError(errs[0].get("error") if errs else "scene regenerate failed")
            db.commit()
            return str(row.image_url or "")
        if t == "product":
            row = db.query(ProductAsset).filter(ProductAsset.project_id == project_id, ProductAsset.id == asset_id).first()
            if row is None:
                raise ValueError("product asset not found")
            n, ok, errs = self._apply_product_results(db, project_id, [row])
            if errs or ok <= 0:
                raise RuntimeError(errs[0].get("error") if errs else "product regenerate failed")
            db.commit()
            return str(row.image_url or "")
        raise ValueError("invalid asset_type")

    def generate_character_images(self, db: Session, project_id: int) -> AssetImageBatchResult:
        project = orchestrator.get_project(db, project_id)
        self._prepare_project_for_asset_image_batch(db, project)
        orchestrator.begin_asset_image_render(db, project)
        db.commit()
        result = AssetImageBatchResult(project_id=project_id)
        try:
            rows = (
                db.query(CharacterAsset)
                .filter(CharacterAsset.project_id == project_id)
                .order_by(CharacterAsset.id)
                .all()
            )
            if not rows:
                orchestrator.complete_asset_image_render(
                    db, project, had_attempts=False, any_success=False
                )
                db.commit()
                return result
            n, ok, errs = self._run_parallel_character(project_id, rows)
            result.errors.extend(errs)
            result.characters_attempted = n
            result.characters_succeeded = ok
            for row in rows:
                db.add(row)
            orchestrator.complete_asset_image_render(
                db, project, had_attempts=result.had_attempts, any_success=result.any_success
            )
            db.commit()
            return result
        except Exception:
            self._recover_after_image_batch_crash(db, project_id)
            raise

    def generate_scene_images(self, db: Session, project_id: int) -> AssetImageBatchResult:
        project = orchestrator.get_project(db, project_id)
        self._prepare_project_for_asset_image_batch(db, project)
        orchestrator.begin_asset_image_render(db, project)
        db.commit()
        result = AssetImageBatchResult(project_id=project_id)
        try:
            rows = (
                db.query(SceneAsset)
                .filter(SceneAsset.project_id == project_id)
                .order_by(SceneAsset.id)
                .all()
            )
            if not rows:
                orchestrator.complete_asset_image_render(
                    db, project, had_attempts=False, any_success=False
                )
                db.commit()
                return result
            n, ok, errs = self._apply_scene_results(db, project_id, rows)
            result.errors.extend(errs)
            result.scenes_attempted = n
            result.scenes_succeeded = ok
            orchestrator.complete_asset_image_render(
                db, project, had_attempts=result.had_attempts, any_success=result.any_success
            )
            db.commit()
            return result
        except Exception:
            self._recover_after_image_batch_crash(db, project_id)
            raise

    def generate_product_images(self, db: Session, project_id: int) -> AssetImageBatchResult:
        project = orchestrator.get_project(db, project_id)
        self._prepare_project_for_asset_image_batch(db, project)
        orchestrator.begin_asset_image_render(db, project)
        db.commit()
        result = AssetImageBatchResult(project_id=project_id)
        try:
            rows = (
                db.query(ProductAsset)
                .filter(ProductAsset.project_id == project_id)
                .order_by(ProductAsset.id)
                .all()
            )
            if not rows:
                orchestrator.complete_asset_image_render(
                    db, project, had_attempts=False, any_success=False
                )
                db.commit()
                return result
            n, ok, errs = self._apply_product_results(db, project_id, rows)
            result.errors.extend(errs)
            result.products_attempted = n
            result.products_succeeded = ok
            orchestrator.complete_asset_image_render(
                db, project, had_attempts=result.had_attempts, any_success=result.any_success
            )
            db.commit()
            return result
        except Exception:
            self._recover_after_image_batch_crash(db, project_id)
            raise

    def generate_all_asset_images(self, db: Session, project_id: int) -> AssetImageBatchResult:
        project = orchestrator.get_project(db, project_id)
        self._prepare_project_for_asset_image_batch(db, project)
        # /assets/images/generate route acquires task lock first and sets status=processing.
        # In that flow, business-step validation already happened before lock.
        if not (str(project.status or "").strip() == "processing" and current_stage(project) == "s3_images"):
            orchestrator.begin_asset_image_render(db, project)
            db.commit()
        result = AssetImageBatchResult(project_id=project_id)
        try:
            chars = (
                db.query(CharacterAsset)
                .filter(CharacterAsset.project_id == project_id)
                .order_by(CharacterAsset.id)
                .all()
            )
            chars = [row for row in chars if not str(row.image_url or "").strip()]
            scenes = (
                db.query(SceneAsset)
                .filter(SceneAsset.project_id == project_id)
                .order_by(SceneAsset.id)
                .all()
            )
            scenes = [row for row in scenes if not str(row.image_url or "").strip()]
            products = (
                db.query(ProductAsset)
                .filter(ProductAsset.project_id == project_id)
                .order_by(ProductAsset.id)
                .all()
            )
            products = [row for row in products if not str(row.image_url or "").strip()]
            logger.info("[S3_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s", project_id)
            db.close()

            try:
                prov_id = self._provider.capabilities().get("provider_id", "unknown")
            except Exception:
                prov_id = "unknown"
            logger.info(
                "[ASSET_IMAGE_BATCH] project_id=%s provider=%s image_provider_key=%s use_mock_legacy=%s characters=%s scenes=%s products=%s",
                project_id,
                prov_id,
                (settings.SHORT_DRAMA_IMAGE_PROVIDER or "xai"),
                bool(settings.SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER),
                len(chars),
                len(scenes),
                len(products),
            )

            if chars:
                n, ok, errs = self._run_parallel_character(project_id, chars)
                result.characters_attempted = n
                result.characters_succeeded = ok
                result.errors.extend(errs)
                for err in errs:
                    self._writeback_image_failure(
                        project_id=project_id,
                        asset_type="character",
                        asset_id=int(err.get("asset_id") or 0),
                        error=str(err.get("error") or ""),
                        error_type=str(err.get("error_type") or "ImageGenerationError"),
                    )
                for row in chars:
                    if row.image_url:
                        self._writeback_image_result(
                            project_id=project_id,
                            asset_type="character",
                            asset_id=int(row.id),
                            image_url=str(row.image_url),
                            meta_patch=dict(row.meta_json or {}),
                        )

            if scenes:
                n, ok, errs, scene_results = self._run_parallel_scene(project_id, scenes)
                result.scenes_attempted = n
                result.scenes_succeeded = ok
                result.errors.extend(errs)
                for err in errs:
                    self._writeback_image_failure(
                        project_id=project_id,
                        asset_type="scene",
                        asset_id=int(err.get("asset_id") or 0),
                        error=str(err.get("error") or ""),
                        error_type=str(err.get("error_type") or "ImageGenerationError"),
                    )
                for sid, (url, meta_patch) in scene_results.items():
                    self._writeback_image_result(
                        project_id=project_id,
                        asset_type="scene",
                        asset_id=int(sid),
                        image_url=url,
                        meta_patch=meta_patch,
                    )

            if products:
                n, ok, errs, product_results = self._run_parallel_product(project_id, products)
                result.products_attempted = n
                result.products_succeeded = ok
                result.errors.extend(errs)
                for err in errs:
                    self._writeback_image_failure(
                        project_id=project_id,
                        asset_type="product",
                        asset_id=int(err.get("asset_id") or 0),
                        error=str(err.get("error") or ""),
                        error_type=str(err.get("error_type") or "ImageGenerationError"),
                    )
                for pid, (url, meta_patch) in product_results.items():
                    self._writeback_image_result(
                        project_id=project_id,
                        asset_type="product",
                        asset_id=int(pid),
                        image_url=url,
                        meta_patch=meta_patch,
                    )

            db = SessionLocal()
            orchestrator.complete_asset_image_render(
                db,
                orchestrator.get_project(db, project_id),
                had_attempts=result.had_attempts,
                any_success=result.any_success,
            )
            db.commit()
            return result
        except Exception:
            self._recover_after_image_batch_crash(db, project_id)
            raise


asset_image_service = AssetImageService()
