from __future__ import annotations

import base64
import logging
import json
from typing import Any

from sqlalchemy.orm import Session

from ...config import settings
from ..models import (
    AssetEntity,
    AssetImage,
    AssetReferenceImage,
    CharacterAsset,
    ProductContextRecord,
    ProductAsset,
    SceneAsset,
    SegmentScriptRecord,
    ShortDramaProject,
    StoryBlueprintRecord,
)
from ..providers.image_provider_factory import build_short_drama_image_provider
from .image_understanding_service import asset_image_understanding_service, validate_supported_image_data_url
from ..utils.image_prompts import prepare_image_prompt
from ..utils.image_storage import mime_to_ext, persist_generated_image_url, save_image_bytes

MAX_ASSET_IMAGES = 6
logger = logging.getLogger(__name__)

_UI_NAME_NOISE = {"新增角色", "添加角色", "新增场景", "添加场景", "新增产品", "添加产品"}


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _merge_type_fields_preserve_non_empty(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    out = dict(base or {})
    for k, v in (incoming or {}).items():
        if isinstance(v, str):
            if v.strip():
                out[k] = v
            else:
                out.setdefault(k, out.get(k, ""))
            continue
        if isinstance(v, list):
            if v:
                out[k] = v
            else:
                out.setdefault(k, out.get(k, []))
            continue
        if v is not None:
            out[k] = v
    return out


class AssetLibraryService:
    def __init__(self):
        self._provider = build_short_drama_image_provider()

    def _get_project(self, db: Session, project_id: int) -> ShortDramaProject:
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
        if not project:
            raise ValueError("Project not found")
        return project

    def _build_prompt(self, asset: AssetEntity, variant_hint: str | None = None) -> str:
        base_prompt = (asset.base_prompt or "").strip()
        extra = dict(asset.extra_json or {})
        tf = dict(extra.get("type_fields") or {})
        fallback_prompt = (
            str(tf.get("image_prompt") or "").strip()
            or str(tf.get("visual_prompt") or "").strip()
            or str(asset.description or "").strip()
        )
        used_history_fallback = False
        if not base_prompt and fallback_prompt:
            base_prompt = fallback_prompt
            used_history_fallback = True
        raw_input = {
            "asset_type": asset.asset_type,
            "name": (asset.name or "").strip(),
            "description": (asset.description or "").strip(),
            "base_prompt": base_prompt,
            "variant_hint": (variant_hint or "").strip(),
        }
        if not base_prompt:
            raise ValueError("Asset base_prompt is empty; historical fallback also unavailable")
        clean_prompt = base_prompt
        _trace(
            "S3_LIBRARY_REGENERATE_BASE_PROMPT",
            {
                "project_id": asset.project_id,
                "asset_id": asset.id,
                "asset_type": asset.asset_type,
                "variant_hint": variant_hint,
                "base_prompt": clean_prompt,
                "source": "asset.base_prompt/type_fields/description",
            },
        )
        final_prompt = prepare_image_prompt(clean_prompt)
        _trace(
            "S3_LIBRARY_REGENERATE_FINAL_PROMPT",
            {
                "project_id": asset.project_id,
                "asset_id": asset.id,
                "asset_type": asset.asset_type,
                "variant_hint": variant_hint,
                "final_prompt": final_prompt,
            },
        )
        if used_history_fallback:
            logger.warning(
                "[ASSET_PROMPT_HISTORY_FALLBACK] project_id=%s asset_id=%s asset_type=%s fallback_source=%s",
                asset.project_id,
                asset.id,
                asset.asset_type,
                "type_fields.image_prompt/type_fields.visual_prompt/description",
            )
        if asset.asset_type == "product":
            logger.info(
                "[PRODUCT_ASSET_GENERATE_PROMPT] project_id=%s asset_id=%s variant_hint=%s clean_prompt=%s final_prompt=%s",
                asset.project_id,
                asset.id,
                variant_hint or "",
                clean_prompt,
                final_prompt,
            )
        logger.info(
            "[IMAGE_PROMPT_DEBUG]\nraw_input: %s\nclean_prompt: %s\nfinal_prompt: %s",
            raw_input,
            clean_prompt,
            final_prompt,
        )
        logger.info("[IMAGE_PROMPT] %s", final_prompt)
        logger.info("[FINAL_IMAGE_PROMPT] %s", final_prompt)
        return final_prompt

    def _mark_suspicious_if_text_image_weak(self, db: Session, asset: AssetEntity, *, reason: str) -> None:
        extra = dict(asset.extra_json or {})
        extra["suspicious"] = True
        extra["suspicious_reason"] = reason
        asset.extra_json = extra
        db.add(asset)
        logger.warning(
            "[ASSET_TEXT_IMAGE_SUSPICIOUS] project_id=%s asset_id=%s asset_type=%s name=%s reason=%s",
            asset.project_id,
            asset.id,
            asset.asset_type,
            asset.name,
            reason,
        )

    def _persist_data_url_image(self, *, project_id: int, asset_type: str, asset_id: int, image_data_url: str) -> str:
        mime = validate_supported_image_data_url(image_data_url)
        try:
            _, payload = str(image_data_url).split(",", 1)
            raw = base64.b64decode(payload, validate=False)
        except Exception as exc:
            raise ValueError("Invalid image payload") from exc
        return save_image_bytes(
            project_id=project_id,
            asset_type=f"{asset_type}-library-upload",
            asset_id=asset_id,
            data=raw,
            ext=mime_to_ext(mime),
        )

    def _persist_generated_image(
        self,
        db: Session,
        *,
        project_id: int,
        asset: AssetEntity,
        prompt: str,
        variant_label: str,
        variant_meta: dict[str, Any],
    ) -> AssetImage:
        gen = self._provider.generate_from_text(
            prompt=prompt,
            asset_type=asset.asset_type,
            project_id=project_id,
            asset_id=asset.id,
            metadata={"variant_label": variant_label},
        )
        url = persist_generated_image_url(
            gen,
            project_id=project_id,
            asset_type=f"{asset.asset_type}-library",
            asset_id=asset.id,
        )
        provider = "unknown"
        try:
            provider = str(self._provider.capabilities().get("provider_id", "unknown"))
        except Exception:
            provider = settings.SHORT_DRAMA_IMAGE_PROVIDER or "unknown"
        image = AssetImage(
            asset_id=asset.id,
            image_url=url,
            image_type="generated",
            variant_label=variant_label,
            variant_meta=variant_meta,
            prompt_snapshot=prompt,
            provider=provider,
            provider_params=gen.meta if isinstance(gen.meta, dict) else {},
            is_cover=False,
            status="active",
        )
        db.add(image)
        db.flush()
        return image

    def _active_images(self, db: Session, asset_id: int) -> list[AssetImage]:
        return (
            db.query(AssetImage)
            .filter(AssetImage.asset_id == asset_id, AssetImage.status == "active")
            .order_by(AssetImage.id.asc())
            .all()
        )

    def _active_refs(self, db: Session, asset_id: int) -> list[AssetReferenceImage]:
        return (
            db.query(AssetReferenceImage)
            .filter(AssetReferenceImage.asset_id == asset_id, AssetReferenceImage.status == "active")
            .order_by(AssetReferenceImage.sort_order.asc(), AssetReferenceImage.id.asc())
            .all()
        )

    def _ensure_cover(self, db: Session, asset: AssetEntity) -> None:
        images = self._active_images(db, asset.id)
        if not images:
            asset.cover_image_id = None
            db.add(asset)
            return
        preferred_images = [img for img in images if str(img.image_type or "").lower() != "reference"]
        fallback_pool = preferred_images or images
        cover = next((img for img in images if img.id == asset.cover_image_id), None) or fallback_pool[0]
        for img in images:
            img.is_cover = img.id == cover.id
            db.add(img)
        asset.cover_image_id = cover.id
        db.add(asset)

    def _normalize_generate_count(self, n: int) -> int:
        if n < 1:
            return 1
        if n > MAX_ASSET_IMAGES:
            return MAX_ASSET_IMAGES
        return int(n)

    def _normalize_role_type(self, raw: Any) -> str | None:
        v = str(raw or "").strip().lower()
        if not v:
            return None
        if v in {"main", "protagonist", "lead", "hero"}:
            return "main"
        if v in {"supporting", "support"}:
            return "supporting"
        if v in {"antagonist", "villain"}:
            return "antagonist"
        if v in {"extra", "background", "passerby", "crowd"}:
            return "extra"
        return None

    def _normalize_scene_type(self, raw: Any) -> str | None:
        v = str(raw or "").strip().lower()
        if not v:
            return None
        if v in {"hook", "opening", "intro", "start"}:
            return "hook"
        if v in {"conflict", "build"}:
            return "conflict"
        if v in {"turn", "twist"}:
            return "turn"
        if v in {"resolution", "ending", "close"}:
            return "resolution"
        return None

    def _normalize_scene_form(self, raw: Any) -> str | None:
        v = str(raw or "").strip().lower()
        if not v:
            return None
        if v in {"interior", "indoor", "室内", "bedroom_interior", "interior office", "indoor_home"}:
            return "interior"
        if v in {"exterior", "outdoor", "室外", "exterior_day", "exterior urban", "outdoor urban"}:
            return "exterior"
        if v in {"montage", "montage_dynamic", "mixed interior exterior", "室内到室外"}:
            return "montage"
        return None

    def _infer_scene_type_from_text(self, text: str) -> str | None:
        corpus = str(text or "").strip().lower()
        if not corpus:
            return None
        rules: list[tuple[str, set[str]]] = [
            ("hook", {"hook", "opening", "intro", "start", "开场", "引子", "初始", "困境出现", "吸引观众"}),
            ("conflict", {"conflict", "build", "struggle", "pressure", "冲突", "矛盾", "挣扎", "压力", "困难加深"}),
            ("turn", {"turn", "twist", "reveal", "change", "转折", "反转", "变化", "揭示"}),
            ("resolution", {"resolution", "ending", "close", "solve", "收尾", "结局", "解决", "完成"}),
        ]
        for scene_type, keywords in rules:
            if any(k in corpus for k in keywords):
                return scene_type
        return None

    def _infer_scene_type_from_segment_key(self, segment_key: str) -> str | None:
        key = str(segment_key or "").strip().lower()
        if not key:
            return None
        # compound ids like "twist_resolution" should prefer terminal phase
        if "resolution" in key or "ending" in key or "close" in key:
            return "resolution"
        if "turn" in key or "twist" in key:
            return "turn"
        if "conflict" in key or "build" in key:
            return "conflict"
        if "hook" in key or "opening" in key or "intro" in key or "start" in key:
            return "hook"
        return None

    def _project_blueprint_segments(self, db: Session, project_id: int) -> list[dict[str, Any]]:
        bp = (
            db.query(StoryBlueprintRecord)
            .filter(StoryBlueprintRecord.project_id == project_id)
            .order_by(StoryBlueprintRecord.version.desc(), StoryBlueprintRecord.id.desc())
            .first()
        )
        if not bp:
            return []
        payload = bp.blueprint_json if isinstance(bp.blueprint_json, dict) else {}
        segments = payload.get("segment_plan") if isinstance(payload, dict) else None
        return [s for s in (segments or []) if isinstance(s, dict)]

    def _segment_lookup_for_project(self, db: Session, project_id: int) -> dict[str, str]:
        lookup: dict[str, str] = {}
        for row in (
            db.query(SegmentScriptRecord)
            .filter(SegmentScriptRecord.project_id == project_id)
            .order_by(SegmentScriptRecord.version.desc(), SegmentScriptRecord.id.desc())
            .all()
        ):
            key = str(row.segment_id or "").strip().lower()
            if not key or key in lookup:
                continue
            script_json = row.script_json if isinstance(row.script_json, dict) else {}
            seg = script_json.get("segment") if isinstance(script_json, dict) else {}
            text = " ".join(
                str(x or "")
                for x in [
                    key,
                    seg.get("story_beat") if isinstance(seg, dict) else "",
                    seg.get("summary") if isinstance(seg, dict) else "",
                    seg.get("goal") if isinstance(seg, dict) else "",
                    seg.get("title") if isinstance(seg, dict) else "",
                ]
            )
            inferred = self._infer_scene_type_from_text(text)
            if inferred:
                lookup[key] = inferred
        return lookup

    def _infer_scene_type_for_asset(
        self,
        *,
        asset: AssetEntity,
        type_fields: dict[str, Any],
        blueprint_segments: list[dict[str, Any]],
        segment_lookup: dict[str, str],
        order_index: int,
    ) -> tuple[str | None, str]:
        explicit = self._normalize_scene_type(type_fields.get("scene_type"))
        if explicit:
            return explicit, "existing"

        # signal 1: explicit segment/beat binding
        segment_id = str(type_fields.get("segment_id") or "").strip().lower()
        beat_id = str(type_fields.get("beat_id") or "").strip().lower()
        from_segment_key = self._infer_scene_type_from_segment_key(segment_id) or self._infer_scene_type_from_segment_key(
            beat_id
        )
        if from_segment_key:
            return from_segment_key, "segment"
        if segment_id and segment_id in segment_lookup:
            return segment_lookup[segment_id], "segment"
        if beat_id and beat_id in segment_lookup:
            return segment_lookup[beat_id], "segment"

        beat_refs = type_fields.get("beat_references")
        if isinstance(beat_refs, list):
            for ref in beat_refs:
                ref_key = str(ref or "").strip().lower()
                if ref_key in segment_lookup:
                    return segment_lookup[ref_key], "segment"

        # signal 2: blueprint match by segment_id, then by index
        if blueprint_segments:
            if segment_id:
                for seg in blueprint_segments:
                    seg_id = str(seg.get("segment_id") or "").strip().lower()
                    if seg_id and seg_id == segment_id:
                        direct = self._infer_scene_type_from_segment_key(seg_id)
                        if direct:
                            return direct, "blueprint"
                        inferred = self._infer_scene_type_from_text(
                            " ".join(
                                str(seg.get(k) or "") for k in ("segment_id", "story_beat", "summary", "goal")
                            )
                        )
                        if inferred:
                            return inferred, "blueprint"
            if 0 <= order_index < len(blueprint_segments):
                seg = blueprint_segments[order_index]
                direct = self._infer_scene_type_from_segment_key(seg.get("segment_id"))
                if direct:
                    return direct, "blueprint"
                inferred = self._infer_scene_type_from_text(
                    " ".join(str(seg.get(k) or "") for k in ("segment_id", "story_beat", "summary", "goal"))
                )
                if inferred:
                    return inferred, "blueprint"

        # signal 3: name + description semantics
        from_text = self._infer_scene_type_from_text(f"{asset.name or ''} {asset.description or ''}")
        if from_text:
            return from_text, "text"
        return None, "none"

    def repair_scene_structure_for_project(
        self, db: Session, project_id: int, *, apply_changes: bool = True
    ) -> list[dict[str, Any]]:
        scenes = (
            db.query(AssetEntity)
            .filter(
                AssetEntity.project_id == project_id,
                AssetEntity.asset_type == "scene",
                AssetEntity.status == "active",
            )
            .order_by(AssetEntity.sort_order.asc(), AssetEntity.id.asc())
            .all()
        )
        if not scenes:
            return []
        blueprint_segments = self._project_blueprint_segments(db, project_id)
        segment_lookup = self._segment_lookup_for_project(db, project_id)
        diffs: list[dict[str, Any]] = []
        for idx, scene in enumerate(scenes):
            extra = scene.extra_json if isinstance(scene.extra_json, dict) else {}
            tf = extra.get("type_fields") if isinstance(extra, dict) else {}
            tf = dict(tf) if isinstance(tf, dict) else {}
            before_type = tf.get("scene_type")
            before_form = tf.get("scene_form")
            legacy_raw_scene = before_type

            inferred_type, rule = self._infer_scene_type_for_asset(
                asset=scene,
                type_fields=tf,
                blueprint_segments=blueprint_segments,
                segment_lookup=segment_lookup,
                order_index=idx,
            )
            inferred_form = self._normalize_scene_form(tf.get("scene_form") or tf.get("scene_type"))

            if inferred_type:
                tf["scene_type"] = inferred_type
            else:
                tf.pop("scene_type", None)
            if inferred_form:
                tf["scene_form"] = inferred_form
            elif "scene_form" in tf:
                tf.pop("scene_form", None)

            after_type = tf.get("scene_type")
            after_form = tf.get("scene_form")
            if after_type != before_type or after_form != before_form:
                repair_audit = {
                    "legacy_scene_value": legacy_raw_scene,
                    "matched_rule": rule,
                    "scene_type": after_type,
                    "scene_form": after_form,
                }
                if apply_changes:
                    extra["scene_repair_audit"] = repair_audit
                    extra["type_fields"] = tf
                    scene.extra_json = extra
                    db.add(scene)
                diffs.append(
                    {
                        "asset_id": scene.id,
                        "name": scene.name,
                        "before": {"scene_type": before_type, "scene_form": before_form},
                        "after": {"scene_type": after_type, "scene_form": after_form},
                        "audit": repair_audit,
                    }
                )
        return diffs

    def _normalize_product_role(self, raw: Any) -> str | None:
        v = str(raw or "").strip().lower()
        if not v:
            return None
        if v in {"hero", "main", "primary"}:
            return "hero"
        if v in {"contrast", "compare", "comparison", "secondary"}:
            return "contrast"
        if v in {"prop", "tool"}:
            return "prop"
        if v in {"solution", "resolver"}:
            return "solution"
        return None

    def _project_context_payload(self, db: Session, project_id: int) -> dict[str, Any]:
        project = self._get_project(db, project_id)
        product = (
            db.query(ProductContextRecord)
            .filter(ProductContextRecord.project_id == project_id)
            .order_by(ProductContextRecord.version.desc(), ProductContextRecord.id.desc())
            .first()
        )
        blueprint = (
            db.query(StoryBlueprintRecord)
            .filter(StoryBlueprintRecord.project_id == project_id)
            .order_by(StoryBlueprintRecord.version.desc(), StoryBlueprintRecord.id.desc())
            .first()
        )
        segment_rows = (
            db.query(SegmentScriptRecord)
            .filter(SegmentScriptRecord.project_id == project_id)
            .order_by(SegmentScriptRecord.version.desc(), SegmentScriptRecord.id.desc())
            .limit(8)
            .all()
        )
        return {
            "s0_project_settings": {
                "project_name": project.project_name,
                "creative_intent": project.creative_intent,
                "creative_brief": project.creative_brief,
                "visual_style": project.visual_style,
                "aspect_ratio": project.aspect_ratio,
                "style": project.style,
                "target_market": project.target_market,
                "target_audience": project.target_audience,
                "marketing_goal": project.marketing_goal,
                "workflow_language": project.workflow_language,
                "video_language": project.video_language,
            },
            "s1_product_context": product.normalized_context_json if product and isinstance(product.normalized_context_json, dict) else {},
            "s2_story_blueprint": blueprint.blueprint_json if blueprint and isinstance(blueprint.blueprint_json, dict) else {},
            "s2_segments": [row.script_json for row in segment_rows if isinstance(row.script_json, dict)],
        }

    def _derive_visual_anchor_image_id(self, db: Session, asset: AssetEntity) -> int | None:
        extra = asset.extra_json if isinstance(asset.extra_json, dict) else {}
        tf = extra.get("type_fields") if isinstance(extra, dict) else {}
        tf = tf if isinstance(tf, dict) else {}
        raw = tf.get("visual_anchor_image_id")
        if isinstance(raw, int) and raw > 0:
            return int(raw)
        if isinstance(raw, str) and raw.strip().isdigit():
            n = int(raw.strip())
            if n > 0:
                return n
        if asset.cover_image_id:
            return int(asset.cover_image_id)
        images = self._active_images(db, asset.id)
        return int(images[0].id) if images else None

    def sync_legacy_assets_for_project(self, db: Session, project_id: int) -> None:
        """Idempotent sync: legacy single-image asset rows -> unified asset library rows."""
        legacy_rows: list[tuple[str, int, str, str | None, str | None, str | None, dict[str, Any], dict[str, Any]]] = []
        legacy_rows.extend(
            (
                "character",
                int(row.id),
                row.name or f"character-{row.id}",
                row.description,
                row.visual_prompt,
                row.image_url,
                dict(row.meta_json or {}),
                {"role_type": self._normalize_role_type(row.role_type) or "main"},
            )
            for row in db.query(CharacterAsset).filter(CharacterAsset.project_id == project_id).order_by(CharacterAsset.id).all()
        )
        legacy_rows.extend(
            (
                "scene",
                int(row.id),
                row.name or f"scene-{row.id}",
                row.description,
                row.visual_prompt,
                row.image_url,
                dict(row.meta_json or {}),
                {
                    "scene_type": self._normalize_scene_type(row.scene_type),
                    "scene_form": self._normalize_scene_form(row.scene_type),
                },
            )
            for row in db.query(SceneAsset).filter(SceneAsset.project_id == project_id).order_by(SceneAsset.id).all()
        )
        legacy_rows.extend(
            (
                "product",
                int(row.id),
                row.name or f"product-{row.id}",
                row.description,
                row.visual_prompt,
                row.image_url,
                dict(row.meta_json or {}),
                {"product_role": self._normalize_product_role((row.meta_json or {}).get("product_role")) or "hero"},
            )
            for row in db.query(ProductAsset).filter(ProductAsset.project_id == project_id).order_by(ProductAsset.id).all()
        )
        for asset_type, legacy_id, name, description, prompt, image_url, meta_json, base_fields in legacy_rows:
            normalized_type_fields = dict(base_fields)
            meta_payload = dict(meta_json or {})
            nested_type_fields = meta_payload.pop("type_fields", None)
            if isinstance(nested_type_fields, dict):
                normalized_type_fields = _merge_type_fields_preserve_non_empty(normalized_type_fields, nested_type_fields)
            normalized_type_fields = _merge_type_fields_preserve_non_empty(normalized_type_fields, meta_payload)
            prompt_source = (
                str(normalized_type_fields.get("image_prompt") or "").strip()
                or str(normalized_type_fields.get("visual_prompt") or "").strip()
                or str(prompt or "").strip()
                or str(description or "").strip()
                or None
            )
            candidates = (
                db.query(AssetEntity)
                .filter(
                    AssetEntity.project_id == project_id,
                    AssetEntity.asset_type == asset_type,
                    AssetEntity.status == "active",
                )
                .order_by(AssetEntity.id.asc())
                .all()
            )
            target: AssetEntity | None = None
            for c in candidates:
                extra = c.extra_json or {}
                legacy = extra.get("legacy_source") if isinstance(extra, dict) else None
                if isinstance(legacy, dict) and int(legacy.get("table_asset_id", -1)) == legacy_id:
                    target = c
                    break
            if target is None:
                if "product_role" not in normalized_type_fields and asset_type == "product":
                    normalized_type_fields["product_role"] = "hero"
                target = AssetEntity(
                    project_id=project_id,
                    asset_type=asset_type,
                    name=name,
                    description=description,
                    base_prompt=prompt_source,
                    source="system_generated",
                    tags_json=[],
                    status="active",
                    extra_json={
                        "legacy_source": {"table_asset_id": legacy_id, "asset_type": asset_type},
                        "type_fields": normalized_type_fields,
                    },
                )
                db.add(target)
                db.flush()
            else:
                target.name = name
                target.description = description
                if prompt_source:
                    target.base_prompt = prompt_source
                extra = dict(target.extra_json or {})
                extra.setdefault("legacy_source", {"table_asset_id": legacy_id, "asset_type": asset_type})
                merged_type_fields = dict(extra.get("type_fields") or {})
                merged_type_fields.update(normalized_type_fields)
                if asset_type == "product":
                    merged_type_fields["product_role"] = (
                        self._normalize_product_role(merged_type_fields.get("product_role")) or "hero"
                    )
                if asset_type == "character":
                    merged_type_fields["role_type"] = (
                        self._normalize_role_type(merged_type_fields.get("role_type")) or "main"
                    )
                if asset_type == "scene":
                    normalized_scene_type = self._normalize_scene_type(merged_type_fields.get("scene_type"))
                    normalized_scene_form = self._normalize_scene_form(
                        merged_type_fields.get("scene_form") or merged_type_fields.get("scene_type")
                    )
                    if normalized_scene_type:
                        merged_type_fields["scene_type"] = normalized_scene_type
                    else:
                        merged_type_fields.pop("scene_type", None)
                    if normalized_scene_form:
                        merged_type_fields["scene_form"] = normalized_scene_form
                extra["type_fields"] = merged_type_fields
                target.extra_json = extra
                db.add(target)

            url = (image_url or "").strip() if isinstance(image_url, str) else ""
            if url:
                exists = (
                    db.query(AssetImage)
                    .filter(
                        AssetImage.asset_id == target.id,
                        AssetImage.image_url == url,
                        AssetImage.status == "active",
                    )
                    .first()
                )
                if not exists:
                    db.add(
                        AssetImage(
                            asset_id=target.id,
                            image_url=url,
                            image_type="generated",
                            variant_label="legacy-sync",
                            variant_meta={"legacy_table_id": legacy_id},
                            prompt_snapshot=prompt,
                            provider="legacy",
                            provider_params={},
                            is_cover=False,
                            status="active",
                        )
                    )
                    db.flush()
            self._ensure_cover(db, target)
            extra = dict(target.extra_json or {})
            tf = dict(extra.get("type_fields") or {})
            if asset_type == "product":
                tf["product_role"] = self._normalize_product_role(tf.get("product_role")) or "hero"
            if asset_type == "character":
                tf["role_type"] = self._normalize_role_type(tf.get("role_type")) or "main"
            if asset_type == "scene":
                normalized_scene_type = self._normalize_scene_type(tf.get("scene_type"))
                normalized_scene_form = self._normalize_scene_form(tf.get("scene_form") or tf.get("scene_type"))
                if normalized_scene_type:
                    tf["scene_type"] = normalized_scene_type
                else:
                    tf.pop("scene_type", None)
                if normalized_scene_form:
                    tf["scene_form"] = normalized_scene_form
            anchor = self._derive_visual_anchor_image_id(db, target)
            if anchor is not None:
                tf["visual_anchor_image_id"] = int(anchor)
            extra["type_fields"] = tf
            target.extra_json = extra
            db.add(target)
        self.repair_scene_structure_for_project(db, project_id)

    def create_asset(self, db: Session, body) -> AssetEntity:
        self._get_project(db, body.project_id)
        if (body.asset_type or "").strip().lower() == "product":
            logger.info(
                "[PRODUCT_ASSET_CREATE_INPUT] project_id=%s asset_type=%s name=%s description=%s base_prompt=%s source=%s generate_count=%s",
                body.project_id,
                body.asset_type,
                (body.name or "").strip(),
                (body.description or "").strip(),
                (body.base_prompt or "").strip(),
                (body.source or "user_created").strip(),
                body.generate_count or 4,
            )
        clean_name = (body.name or "").strip()
        if clean_name in _UI_NAME_NOISE:
            clean_name = ""
        if not clean_name:
            clean_name = f"{body.asset_type.strip().lower()} asset"
        asset = AssetEntity(
            project_id=body.project_id,
            asset_type=body.asset_type.strip().lower(),
            name=clean_name,
            description=(body.description or "").strip() or None,
            tags_json=list(body.tags or []),
            base_prompt=(body.base_prompt or "").strip() or None,
            source=(body.source or "user_created").strip(),
            status="active",
            extra_json={"type_fields": body.type_fields or {}, "variant_directions": body.variant_directions or []},
        )
        db.add(asset)
        db.flush()
        refs = body.reference_images or []
        if asset.asset_type == "product":
            logger.info(
                "[PRODUCT_ASSET_REFERENCE_IMAGES] project_id=%s asset_id=%s reference_count=%s uploaded_count=%s reference_urls=%s",
                body.project_id,
                asset.id,
                len(refs),
                len(body.uploaded_images or []),
                [str((ref.get("file_url") or "")).strip() for ref in refs if isinstance(ref, dict)],
            )
        for idx, ref in enumerate(refs):
            file_url = (ref.get("file_url") or "").strip()
            if not file_url:
                continue
            db.add(
                AssetReferenceImage(
                    asset_id=asset.id,
                    file_url=file_url,
                    file_name=(ref.get("file_name") or "").strip() or None,
                    sort_order=idx,
                    is_primary=idx == 0,
                    status="active",
                )
            )
        uploads = body.uploaded_images or []
        if (refs or uploads) and (asset.name in _UI_NAME_NOISE or not (asset.description or "").strip()):
            self._mark_suspicious_if_text_image_weak(
                db,
                asset,
                reason="uploaded/reference image exists but asset text is generic or missing description",
            )
        for idx, upload in enumerate(uploads):
            image_url = (upload.get("file_url") or "").strip()
            if not image_url:
                continue
            db.add(
                AssetImage(
                    asset_id=asset.id,
                    image_url=image_url,
                    image_type="uploaded",
                    variant_label=f"upload-{idx + 1}",
                    variant_meta={"source": "user_upload"},
                    prompt_snapshot=None,
                    provider="upload",
                    provider_params={},
                    is_cover=False,
                    status="active",
                )
            )
        # If user uploaded original images, keep this path as pure upload persistence.
        # No image understanding / regeneration should be triggered here.
        if not uploads:
            n = self._normalize_generate_count(body.generate_count or 4)
            for i in range(n):
                variant_hint = (body.variant_directions[i % max(1, len(body.variant_directions))] if body.variant_directions else f"variant-{i + 1}")
                prompt = self._build_prompt(asset, variant_hint)
                self._persist_generated_image(
                    db,
                    project_id=body.project_id,
                    asset=asset,
                    prompt=prompt,
                    variant_label=f"{variant_hint}",
                    variant_meta={"direction": variant_hint},
                )
        self._ensure_cover(db, asset)
        if asset.asset_type == "product":
            active_imgs = self._active_images(db, asset.id)
            active_refs = self._active_refs(db, asset.id)
            logger.info(
                "[PRODUCT_ASSET_FINAL_BINDINGS] project_id=%s asset_id=%s cover_image_id=%s image_ids=%s reference_ids=%s",
                body.project_id,
                asset.id,
                asset.cover_image_id,
                [int(i.id) for i in active_imgs if isinstance(i.id, int)],
                [int(r.id) for r in active_refs if isinstance(r.id, int)],
            )
        return asset

    def _asset_context_for_reference_analysis(self, db: Session, asset: AssetEntity) -> dict[str, Any]:
        extra = dict(asset.extra_json or {})
        tf = dict(extra.get("type_fields") or {})
        cover = (
            db.query(AssetImage)
            .filter(AssetImage.id == asset.cover_image_id, AssetImage.asset_id == asset.id, AssetImage.status == "active")
            .first()
            if asset.cover_image_id
            else None
        )
        return {
            "asset_id": asset.id,
            "asset_type": asset.asset_type,
            "name": asset.name,
            "description": asset.description or "",
            "base_prompt": asset.base_prompt or "",
            "type_fields": tf,
            "position": tf.get("role_type") or tf.get("scene_type") or tf.get("product_role") or "",
            "cover_image": {
                "id": cover.id,
                "image_url": cover.image_url,
                "image_type": cover.image_type,
            }
            if cover
            else None,
        }

    def analyze_reference_image_and_update_asset(
        self,
        db: Session,
        *,
        project_id: int,
        asset_id: int,
        image_data_url: str,
        file_name: str | None = None,
    ) -> tuple[AssetEntity, str | None]:
        asset = (
            db.query(AssetEntity)
            .filter(AssetEntity.id == asset_id, AssetEntity.project_id == project_id, AssetEntity.status == "active")
            .first()
        )
        if not asset:
            raise ValueError("Asset not found")
        understanding = asset_image_understanding_service.analyze_reference_image(
            project_id=project_id,
            image_data_url=image_data_url,
            asset_context=self._asset_context_for_reference_analysis(db, asset),
            project_context=self._project_context_payload(db, project_id),
        )
        stored_image_url = self._persist_data_url_image(
            project_id=project_id,
            asset_type=asset.asset_type,
            asset_id=asset.id,
            image_data_url=image_data_url,
        )
        # Unified model: save user reference image as AssetImage(image_type=reference).
        images = self._active_images(db, asset.id)
        if len(images) < MAX_ASSET_IMAGES:
            db.add(
                AssetImage(
                    asset_id=asset.id,
                    image_url=stored_image_url,
                    image_type="reference",
                    variant_label=f"reference-{len(images) + 1}",
                    variant_meta={"source": "user_uploaded_reference"},
                    prompt_snapshot=None,
                    provider="upload",
                    provider_params={},
                    is_cover=False,
                    status="active",
                )
            )
        if understanding.get("visual_description"):
            asset.description = str(understanding["visual_description"]).strip()
        if understanding.get("image_prompt"):
            asset.base_prompt = str(understanding["image_prompt"]).strip()
        extra = dict(asset.extra_json or {})
        tf = dict(extra.get("type_fields") or {})
        tf["reference_image_change_summary"] = str(understanding.get("change_summary") or "").strip()
        extra["type_fields"] = tf
        asset.extra_json = extra
        db.add(asset)
        warning = None
        if not bool(understanding.get("is_same_asset", True)):
            warning = "上传图与当前资产差异较大，已作为参考图保存。"
        return asset, warning

    def create_asset_from_uploaded_image(
        self,
        db: Session,
        *,
        project_id: int,
        asset_type: str,
        image_data_url: str,
        optional_name: str | None = None,
    ) -> AssetEntity:
        self._get_project(db, project_id)
        normalized_type = str(asset_type or "").strip().lower()
        if normalized_type not in {"character", "scene", "product"}:
            raise ValueError("Invalid asset_type")
        understanding = asset_image_understanding_service.create_asset_from_image(
            project_id=project_id,
            asset_type=normalized_type,
            image_data_url=image_data_url,
            optional_name=optional_name,
            project_context=self._project_context_payload(db, project_id),
        )
        name = str(understanding.get("name") or optional_name or f"{normalized_type} asset").strip()
        if not name:
            name = f"{normalized_type} asset"
        position = str(understanding.get("position") or "").strip()
        description = str(understanding.get("visual_description") or "").strip() or None
        image_prompt = str(understanding.get("image_prompt") or "").strip() or None
        type_fields: dict[str, Any] = {
            "asset_type": normalized_type,
            "source": "image_understanding",
            "image_understanding_summary": str(understanding.get("visual_description") or "").strip(),
        }
        if normalized_type == "character":
            type_fields["role_type"] = position or "待标注角色"
        elif normalized_type == "scene":
            type_fields["scene_type"] = position or "生活场景"
        else:
            type_fields["product_role"] = position or "主商品"
        asset = AssetEntity(
            project_id=project_id,
            asset_type=normalized_type,
            name=name,
            description=description,
            tags_json=[],
            base_prompt=image_prompt,
            source="user_created",
            status="active",
            extra_json={"type_fields": type_fields},
        )
        db.add(asset)
        db.flush()
        stored_image_url = self._persist_data_url_image(
            project_id=project_id,
            asset_type=normalized_type,
            asset_id=asset.id,
            image_data_url=image_data_url,
        )
        uploaded = AssetImage(
            asset_id=asset.id,
            image_url=stored_image_url,
            image_type="uploaded",
            variant_label="upload-1",
            variant_meta={"source": "user_uploaded"},
            prompt_snapshot=None,
            provider="upload",
            provider_params={},
            is_cover=True,
            status="active",
        )
        db.add(uploaded)
        db.flush()
        asset.cover_image_id = uploaded.id
        db.add(asset)
        self._ensure_cover(db, asset)
        return asset

    def append_uploaded_images(
        self,
        db: Session,
        *,
        project_id: int,
        asset_id: int,
        uploaded_images: list[dict[str, str]],
    ) -> AssetEntity:
        asset = (
            db.query(AssetEntity)
            .filter(AssetEntity.id == asset_id, AssetEntity.project_id == project_id, AssetEntity.status == "active")
            .first()
        )
        if not asset:
            raise ValueError("Asset not found")
        current = self._active_images(db, asset.id)
        room = MAX_ASSET_IMAGES - len(current)
        if room <= 0:
            raise ValueError("Asset image limit reached (6). Delete one before uploading.")
        for idx, upload in enumerate(uploaded_images[:room]):
            image_url = (upload.get("file_url") or "").strip()
            if not image_url:
                continue
            db.add(
                AssetImage(
                    asset_id=asset.id,
                    image_url=image_url,
                    image_type="uploaded",
                    variant_label=f"upload-{len(current) + idx + 1}",
                    variant_meta={"source": "user_upload"},
                    prompt_snapshot=None,
                    provider="upload",
                    provider_params={},
                    is_cover=False,
                    status="active",
                )
            )
        if uploaded_images and not (asset.description or "").strip():
            self._mark_suspicious_if_text_image_weak(
                db,
                asset,
                reason="uploaded image appended but asset description is missing",
            )
        self._ensure_cover(db, asset)
        return asset

    def regenerate_asset_images(self, db: Session, body) -> AssetEntity:
        asset = (
            db.query(AssetEntity)
            .filter(AssetEntity.id == body.asset_id, AssetEntity.project_id == body.project_id, AssetEntity.status == "active")
            .first()
        )
        if not asset:
            raise ValueError("Asset not found")
        prompt_override = (
            str(getattr(body, "current_image_prompt", "") or "").strip()
            or str(getattr(body, "base_prompt", "") or "").strip()
            or str(getattr(body, "image_description_override", "") or "").strip()
        )
        if prompt_override:
            asset.base_prompt = prompt_override
            db.add(asset)
        logger.info(
            "[S3_REGENERATE_PROMPT_SOURCE] project_id=%s asset_id=%s used_override=%s prompt_preview=%s",
            body.project_id,
            body.asset_id,
            bool(prompt_override),
            (asset.base_prompt or "")[:280],
        )
        current = self._active_images(db, asset.id)
        room = MAX_ASSET_IMAGES - len(current)
        if room <= 0:
            raise ValueError("Asset image limit reached (6). Delete one before regenerating.")
        count = min(self._normalize_generate_count(body.generate_count or 1), room)
        for idx, ref in enumerate(body.reference_images or []):
            raw_url = (ref.get("file_url") or "").strip()
            if not raw_url:
                continue
            file_url = (
                self._persist_data_url_image(
                    project_id=body.project_id,
                    asset_type=asset.asset_type,
                    asset_id=asset.id,
                    image_data_url=raw_url,
                )
                if raw_url.startswith("data:image/")
                else raw_url
            )
            db.add(
                AssetImage(
                    asset_id=asset.id,
                    image_url=file_url,
                    image_type="reference",
                    variant_label=f"reference-{len(current) + idx + 1}",
                    variant_meta={"source": "regenerate_reference"},
                    prompt_snapshot=None,
                    provider="upload",
                    provider_params={},
                    is_cover=False,
                    status="active",
                )
            )
        latest_generated_id: int | None = None
        for i in range(count):
            variant_hint = (body.variant_directions[i % max(1, len(body.variant_directions))] if body.variant_directions else f"regen-{len(current) + i + 1}")
            prompt = self._build_prompt(asset, variant_hint)
            image = self._persist_generated_image(
                db,
                project_id=body.project_id,
                asset=asset,
                prompt=prompt,
                variant_label=f"{variant_hint}",
                variant_meta={"direction": variant_hint, "regenerated": True},
            )
            latest_generated_id = int(image.id) if isinstance(image.id, int) else latest_generated_id
        if latest_generated_id is not None:
            asset.cover_image_id = latest_generated_id
            db.add(asset)
        self._ensure_cover(db, asset)
        if asset.cover_image_id:
            extra = dict(asset.extra_json or {})
            tf = dict(extra.get("type_fields") or {})
            tf["visual_anchor_image_id"] = int(asset.cover_image_id)
            extra["type_fields"] = tf
            asset.extra_json = extra
            db.add(asset)
        return asset

    def to_detail(self, db: Session, asset: AssetEntity) -> dict[str, Any]:
        images = self._active_images(db, asset.id)
        refs = self._active_refs(db, asset.id)
        used_image_ids = {int(i.id) for i in images if isinstance(i.id, int)}
        compat_ref_images: list[dict[str, Any]] = []
        compat_seed_id = (max(used_image_ids) + 1) if used_image_ids else 1
        for idx, ref in enumerate(refs):
            compat_ref_images.append(
                {
                    "id": compat_seed_id + idx,
                    "image_url": ref.file_url,
                    "image_type": "reference",
                    "variant_label": ref.file_name or "legacy-reference",
                    "variant_meta": {"source": "legacy_reference_table", "legacy_reference_id": ref.id},
                    "prompt_snapshot": None,
                    "provider": "upload",
                    "provider_params": {},
                    "is_cover": False,
                    "status": ref.status,
                    "created_at": ref.created_at,
                }
            )
        cover = next((img for img in images if img.id == asset.cover_image_id), None)
        extra = asset.extra_json if isinstance(asset.extra_json, dict) else {}
        tf = extra.get("type_fields") if isinstance(extra, dict) else {}
        tf = tf if isinstance(tf, dict) else {}
        role_type = self._normalize_role_type(tf.get("role_type"))
        scene_type = self._normalize_scene_type(tf.get("scene_type"))
        scene_form = self._normalize_scene_form(tf.get("scene_form") or tf.get("scene_type"))
        product_role = self._normalize_product_role(tf.get("product_role"))
        narrative_function = str(tf.get("narrative_function") or "").strip() or None
        exposure_priority = str(tf.get("exposure_priority") or "").strip() or None
        visual_anchor_image_id = self._derive_visual_anchor_image_id(db, asset)
        variant_image_ids = [int(i.id) for i in images if isinstance(i.id, int)]
        return {
            "id": asset.id,
            "project_id": asset.project_id,
            "asset_type": asset.asset_type,
            "name": asset.name,
            "description": asset.description,
            "tags": list(asset.tags_json or []),
            "base_prompt": asset.base_prompt,
            "source": asset.source,
            "role_type": role_type,
            "scene_type": scene_type,
            "scene_form": scene_form,
            "product_role": product_role,
            "narrative_function": narrative_function,
            "exposure_priority": exposure_priority,
            "visual_anchor_image_id": visual_anchor_image_id,
            "variant_image_ids": variant_image_ids,
            "cover_image_id": asset.cover_image_id,
            "cover_image": self._image_to_dict(cover) if cover else None,
            "image_count": len(images) + len(compat_ref_images),
            "has_reference_images": len(refs) > 0 or any(str(i.image_type or "").lower() == "reference" for i in images),
            "sort_order": asset.sort_order,
            "status": asset.status,
            "extra": extra,
            "images": [self._image_to_dict(i) for i in images] + compat_ref_images,
            "reference_images": [self._ref_to_dict(r) for r in refs],
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
        }

    def _image_to_dict(self, image: AssetImage | None) -> dict[str, Any]:
        if image is None:
            return {}
        return {
            "id": image.id,
            "image_url": image.image_url,
            "image_type": image.image_type,
            "variant_label": image.variant_label,
            "variant_meta": image.variant_meta or {},
            "prompt_snapshot": image.prompt_snapshot,
            "provider": image.provider,
            "provider_params": image.provider_params or {},
            "is_cover": bool(image.is_cover),
            "status": image.status,
            "created_at": image.created_at,
        }

    def _ref_to_dict(self, ref: AssetReferenceImage) -> dict[str, Any]:
        return {
            "id": ref.id,
            "file_url": ref.file_url,
            "file_name": ref.file_name,
            "sort_order": ref.sort_order,
            "is_primary": bool(ref.is_primary),
            "status": ref.status,
            "created_at": ref.created_at,
        }


asset_library_service = AssetLibraryService()
