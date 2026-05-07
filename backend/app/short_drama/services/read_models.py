"""Read helpers for latest pipeline artifacts (keeps route handlers thin)."""

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import (
    AssetEntity,
    AssetImage,
    CharacterAsset,
    ProductAsset,
    ProductContextRecord,
    RenderJob,
    SceneAsset,
    SegmentScriptRecord,
    StoryBlueprintRecord,
)
from ..utils.enums import RenderJobStatus, RenderTargetType


def _as_text(v: object) -> str:
    return str(v or "").strip()


def _first_non_empty(*values: object) -> str:
    for v in values:
        t = _as_text(v)
        if t:
            return t
    return ""


def _fallback_scene_form(asset_type: str, current: str) -> str:
    if _as_text(current):
        return _as_text(current)
    if asset_type == "character":
        return "主角人物资产"
    if asset_type == "scene":
        return "单地点生活方式场景"
    return "主商品展示资产"


def _fallback_plot_stage(asset_type: str, current: str) -> str:
    if _as_text(current):
        return _as_text(current)
    if asset_type == "character":
        return "情绪共鸣"
    if asset_type == "scene":
        return "生活场景"
    return "产品自然出现"


def _fallback_structure_summary(asset_type: str, scene_form: str, description: str) -> str:
    desc = _as_text(description)
    if asset_type == "character":
        return _first_non_empty(
            desc and f"{scene_form}，用于承接通勤场景中的生活化角色出镜与产品自然露出。",
            f"{scene_form}，用于承接通勤场景中的生活化角色出镜与产品自然露出。",
        )
    if asset_type == "scene":
        return _first_non_empty(
            desc and f"{scene_form}，用于承载生活方式剧情并支持角色动作与产品露出。",
            f"{scene_form}，用于承载生活方式剧情并支持角色动作与产品露出。",
        )
    return _first_non_empty(
        desc and f"{scene_form}，用于展示商品外观、材质与使用卖点。",
        f"{scene_form}，用于展示商品外观、材质与使用卖点。",
    )


def _fallback_display_description(asset_type: str, description: str, name: str) -> str:
    d = _as_text(description)
    if _is_weak_description(asset_type, d):
        d = ""
    if asset_type == "character":
        return _first_non_empty(d, f"用于承接生活化剧情的角色资产，围绕{name or '主角'}完成自然出镜。")
    if asset_type == "scene":
        return _first_non_empty(d, f"用于承载生活方式剧情的单地点场景资产，支持角色动作与产品露出。")
    return _first_non_empty(d, f"用于展示{name or '主商品'}外观、材质与穿着卖点的商品资产。")


def _is_weak_description(asset_type: str, description: str) -> bool:
    d = _as_text(description)
    if not d:
        return True
    if asset_type == "product" and len(d) < 12:
        return True
    bad_terms = ["产品资产", "实物产品", "待完善", "暂无", "Product-only reference asset"]
    return any(t in d for t in bad_terms)


def ensure_type_fields_visible_summary(
    *,
    asset_type: str,
    tf: dict,
    name: str,
    description: str | None,
) -> dict:
    out = dict(tf or {})
    display_name = _first_non_empty(out.get("display_name"), name)
    display_description = _first_non_empty(out.get("display_description"), _fallback_display_description(asset_type, _as_text(description), display_name))
    if _is_weak_description(asset_type, display_description):
        display_description = _fallback_display_description(asset_type, _as_text(description), display_name)
    scene_form = _fallback_scene_form(asset_type, _as_text(out.get("scene_form")))
    plot_stage = _fallback_plot_stage(asset_type, _as_text(out.get("plot_stage")))
    structure_summary = _first_non_empty(
        out.get("structure_summary"),
        _fallback_structure_summary(asset_type, scene_form, display_description or _as_text(description)),
    )
    out["display_name"] = display_name
    out["display_description"] = display_description
    out["scene_form"] = scene_form
    out["plot_stage"] = plot_stage
    out["structure_summary"] = structure_summary
    return out


def latest_product_context(db: Session, project_id: int) -> Optional[ProductContextRecord]:
    return (
        db.query(ProductContextRecord)
        .filter(ProductContextRecord.project_id == project_id)
        .order_by(ProductContextRecord.version.desc(), ProductContextRecord.id.desc())
        .first()
    )


def latest_story_blueprint(db: Session, project_id: int) -> Optional[StoryBlueprintRecord]:
    return (
        db.query(StoryBlueprintRecord)
        .filter(StoryBlueprintRecord.project_id == project_id)
        .order_by(StoryBlueprintRecord.version.desc(), StoryBlueprintRecord.id.desc())
        .first()
    )


def next_product_context_version(db: Session, project_id: int) -> int:
    v = db.query(func.max(ProductContextRecord.version)).filter(
        ProductContextRecord.project_id == project_id
    ).scalar()
    return (v or 0) + 1


def next_story_version(db: Session, project_id: int) -> int:
    v = db.query(func.max(StoryBlueprintRecord.version)).filter(
        StoryBlueprintRecord.project_id == project_id
    ).scalar()
    return (v or 0) + 1


def next_segment_batch_version(db: Session, project_id: int) -> int:
    v = db.query(func.max(SegmentScriptRecord.version)).filter(
        SegmentScriptRecord.project_id == project_id
    ).scalar()
    return (v or 0) + 1


def list_segment_scripts(db: Session, project_id: int) -> list[SegmentScriptRecord]:
    """One row per segment_id: highest version (then id) wins — avoids duplicate segments in pipeline/merge."""
    rows: list[SegmentScriptRecord] = (
        db.query(SegmentScriptRecord)
        .filter(SegmentScriptRecord.project_id == project_id)
        .order_by(
            SegmentScriptRecord.segment_id,
            SegmentScriptRecord.version.desc(),
            SegmentScriptRecord.id.desc(),
        )
        .all()
    )
    picked: dict[str, SegmentScriptRecord] = {}
    for r in rows:
        if r.segment_id not in picked:
            picked[r.segment_id] = r

    def _natural_key(segment_id: str) -> list:
        return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", segment_id)]

    return sorted(picked.values(), key=lambda x: _natural_key(x.segment_id))


def list_asset_rows(db: Session, project_id: int) -> tuple[list[CharacterAsset], list[SceneAsset], list[ProductAsset]]:
    chars = (
        db.query(CharacterAsset)
        .filter(CharacterAsset.project_id == project_id)
        .order_by(CharacterAsset.id)
        .all()
    )
    scenes = (
        db.query(SceneAsset).filter(SceneAsset.project_id == project_id).order_by(SceneAsset.id).all()
    )
    products = (
        db.query(ProductAsset)
        .filter(ProductAsset.project_id == project_id)
        .order_by(ProductAsset.id)
        .all()
    )
    return chars, scenes, products


@dataclass
class PipelineCharacterAssetRow:
    id: int
    name: str
    role_type: str
    description: str | None
    visual_prompt: str | None
    image_url: str | None
    visual_anchor_image_id: int | None
    source_asset_version: str
    exposure_priority: str
    narrative_function: str | None
    purpose: str | None
    meta_json: dict


@dataclass
class PipelineSceneAssetRow:
    id: int
    name: str
    scene_type: str | None
    scene_form: str | None
    description: str | None
    visual_prompt: str | None
    image_url: str | None
    visual_anchor_image_id: int | None
    source_asset_version: str
    exposure_priority: str
    narrative_function: str | None
    purpose: str | None
    meta_json: dict


@dataclass
class PipelineProductAssetRow:
    id: int
    name: str
    product_role: str | None
    description: str | None
    visual_prompt: str | None
    image_url: str | None
    visual_anchor_image_id: int | None
    source_asset_version: str
    exposure_priority: str
    narrative_function: str | None
    purpose: str | None
    meta_json: dict


def list_pipeline_asset_rows(
    db: Session, project_id: int
) -> tuple[list[PipelineCharacterAssetRow], list[PipelineSceneAssetRow], list[PipelineProductAssetRow]]:
    assets = (
        db.query(AssetEntity)
        .filter(AssetEntity.project_id == project_id, AssetEntity.status == "active")
        .order_by(AssetEntity.sort_order.asc(), AssetEntity.id.asc())
        .all()
    )
    if not assets:
        return [], [], []
    asset_ids = [a.id for a in assets]
    images = (
        db.query(AssetImage)
        .filter(AssetImage.asset_id.in_(asset_ids), AssetImage.status == "active")
        .order_by(AssetImage.id.asc())
        .all()
    )
    image_by_asset: dict[int, list[AssetImage]] = {}
    image_by_id: dict[int, AssetImage] = {}
    for img in images:
        image_by_asset.setdefault(img.asset_id, []).append(img)
        image_by_id[img.id] = img

    def _normalize_role_type(raw: object) -> str:
        v = str(raw or "").strip().lower()
        if v in {"main", "protagonist", "lead", "hero"}:
            return "main"
        if v in {"supporting", "support"}:
            return "supporting"
        if v in {"antagonist", "villain"}:
            return "antagonist"
        if v in {"extra", "background", "passerby", "crowd"}:
            return "extra"
        return "main"

    def _normalize_scene_type(raw: object) -> str | None:
        v = str(raw or "").strip().lower()
        if v in {"hook", "opening", "intro", "start"}:
            return "hook"
        if v in {"conflict", "build"}:
            return "conflict"
        if v in {"turn", "twist"}:
            return "turn"
        if v in {"resolution", "ending", "close"}:
            return "resolution"
        return None

    def _normalize_scene_form(raw: object) -> str | None:
        v = str(raw or "").strip().lower()
        if v in {"interior", "indoor", "室内", "bedroom_interior", "interior office", "indoor_home"}:
            return "interior"
        if v in {"exterior", "outdoor", "室外", "exterior_day", "exterior urban", "outdoor urban"}:
            return "exterior"
        if v in {"montage", "montage_dynamic", "mixed interior exterior", "室内到室外"}:
            return "montage"
        return None

    def _normalize_product_role(raw: object) -> str:
        v = str(raw or "").strip().lower()
        if v in {"hero", "main", "primary"}:
            return "hero"
        if v in {"contrast", "compare", "comparison", "secondary"}:
            return "contrast"
        if v in {"prop", "tool"}:
            return "prop"
        if v in {"solution", "resolver"}:
            return "solution"
        return "hero"

    def _source_asset_version(asset: AssetEntity, tf: dict, cover_url: str | None) -> str:
        # Deterministic version fingerprint for Step4 stale/rebuild checks.
        payload = {
            "asset_id": asset.id,
            "asset_type": asset.asset_type,
            "name": asset.name or "",
            "description": asset.description or "",
            "base_prompt": asset.base_prompt or "",
            "cover_image_id": asset.cover_image_id,
            "cover_url": cover_url or "",
            "narrative_function": str(tf.get("narrative_function") or ""),
            "exposure_priority": str(tf.get("exposure_priority") or ""),
            "purpose": str(tf.get("purpose") or ""),
            "visual_anchor_image_id": tf.get("visual_anchor_image_id"),
        }
        raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

    def _pick_visual_anchor_id(asset: AssetEntity, tf: dict) -> int | None:
        if asset.cover_image_id:
            return int(asset.cover_image_id)
        raw = tf.get("visual_anchor_image_id")
        if isinstance(raw, int):
            return raw
        if isinstance(raw, str) and raw.strip().isdigit():
            return int(raw.strip())
        imgs = image_by_asset.get(asset.id) or []
        non_reference = [img for img in imgs if str(img.image_type or "").lower() != "reference"]
        picked = non_reference[0] if non_reference else (imgs[0] if imgs else None)
        return int(picked.id) if picked else None

    def _normalize_priority(tf: dict) -> str:
        p = str(tf.get("exposure_priority") or "secondary").strip().lower()
        if p in {"primary", "secondary", "background"}:
            return p
        return "secondary"

    def _cover_image(asset: AssetEntity) -> AssetImage | None:
        if asset.cover_image_id and asset.cover_image_id in image_by_id:
            return image_by_id[asset.cover_image_id]
        imgs = image_by_asset.get(asset.id) or []
        non_reference = [img for img in imgs if str(img.image_type or "").lower() != "reference"]
        return (non_reference[0] if non_reference else (imgs[0] if imgs else None))

    chars: list[PipelineCharacterAssetRow] = []
    scenes: list[PipelineSceneAssetRow] = []
    products: list[PipelineProductAssetRow] = []
    for asset in assets:
        tf = ((asset.extra_json or {}).get("type_fields") or {}) if isinstance(asset.extra_json, dict) else {}
        tf = tf if isinstance(tf, dict) else {}
        prompt = asset.base_prompt
        cover_image = _cover_image(asset)
        cover_url = cover_image.image_url if cover_image else None
        visual_anchor_image_id = _pick_visual_anchor_id(asset, tf)
        exposure_priority = _normalize_priority(tf)
        narrative_function = str(tf.get("narrative_function")).strip() if tf.get("narrative_function") else None
        purpose = str(tf.get("purpose")).strip() if tf.get("purpose") else None
        source_asset_version = _source_asset_version(asset, tf, cover_url)
        tf = ensure_type_fields_visible_summary(
            asset_type=asset.asset_type,
            tf=tf,
            name=asset.name,
            description=asset.description,
        )
        final_description = _as_text(asset.description)
        if _is_weak_description(asset.asset_type, final_description):
            final_description = _as_text(tf.get("display_description"))
        meta_json = dict(tf)
        # Keep nested shape for callers expecting meta.type_fields.
        meta_json["type_fields"] = dict(tf)
        meta_json.setdefault("source_asset_version", source_asset_version)
        if cover_image and isinstance(cover_image.image_type, str):
            meta_json["cover_image_type"] = cover_image.image_type
        if asset.asset_type == "character":
            role_type = _normalize_role_type(tf.get("role_type"))
            meta_json["role_type"] = role_type
            chars.append(
                PipelineCharacterAssetRow(
                    id=asset.id,
                    name=asset.name,
                    role_type=role_type,
                    description=final_description or asset.description,
                    visual_prompt=prompt,
                    image_url=cover_url,
                    visual_anchor_image_id=visual_anchor_image_id,
                    source_asset_version=source_asset_version,
                    exposure_priority=exposure_priority,
                    narrative_function=narrative_function,
                    purpose=purpose,
                    meta_json=meta_json,
                )
            )
        elif asset.asset_type == "scene":
            scene_type = _normalize_scene_type(tf.get("scene_type"))
            scene_form = _normalize_scene_form(tf.get("scene_form") or tf.get("scene_type"))
            if scene_type:
                meta_json["scene_type"] = scene_type
            if scene_form:
                meta_json["scene_form"] = scene_form
            scenes.append(
                PipelineSceneAssetRow(
                    id=asset.id,
                    name=asset.name,
                    scene_type=scene_type,
                    scene_form=scene_form,
                    description=final_description or asset.description,
                    visual_prompt=prompt,
                    image_url=cover_url,
                    visual_anchor_image_id=visual_anchor_image_id,
                    source_asset_version=source_asset_version,
                    exposure_priority=exposure_priority,
                    narrative_function=narrative_function,
                    purpose=purpose,
                    meta_json=meta_json,
                )
            )
        elif asset.asset_type == "product":
            product_role = _normalize_product_role(tf.get("product_role"))
            meta_json["product_role"] = product_role
            products.append(
                PipelineProductAssetRow(
                    id=asset.id,
                    name=asset.name,
                    product_role=product_role,
                    description=final_description or asset.description,
                    visual_prompt=prompt,
                    image_url=cover_url,
                    visual_anchor_image_id=visual_anchor_image_id,
                    source_asset_version=source_asset_version,
                    exposure_priority=exposure_priority,
                    narrative_function=narrative_function,
                    purpose=purpose,
                    meta_json=meta_json,
                )
            )
    return chars, scenes, products


def latest_final_video_url(db: Session, project_id: int) -> str | None:
    # Use the latest final job attempt only, so old completed rows
    # cannot pollute current pipeline state after retries.
    row = (
        db.query(RenderJob)
        .filter(
            RenderJob.project_id == project_id,
            RenderJob.target_type == RenderTargetType.FINAL.value,
        )
        .order_by(RenderJob.id.desc())
        .first()
    )
    if not row:
        return None
    if (row.status or "").lower() != RenderJobStatus.COMPLETED.value:
        return None
    output_url = (row.output_url or "").strip()
    return output_url or None


def latest_final_render_job(db: Session, project_id: int) -> RenderJob | None:
    """Most recent final merge attempt (any status)."""
    return (
        db.query(RenderJob)
        .filter(
            RenderJob.project_id == project_id,
            RenderJob.target_type == RenderTargetType.FINAL.value,
        )
        .order_by(RenderJob.id.desc())
        .first()
    )


def all_segment_scripts_have_video(db: Session, project_id: int) -> bool:
    segs = list_segment_scripts(db, project_id)
    if not segs:
        return False
    for s in segs:
        script = s.script_json if isinstance(s.script_json, dict) else {}
        vr = script.get("video_render") or {}
        if not (str(vr.get("video_url") or "").strip()):
            return False
    return True


def segment_render_job_by_segment_id(
    db: Session, project_id: int, segment_id: str
) -> RenderJob | None:
    return (
        db.query(RenderJob)
        .filter(
            RenderJob.project_id == project_id,
            RenderJob.target_type == RenderTargetType.SEGMENT.value,
            RenderJob.target_id == segment_id,
        )
        .order_by(RenderJob.id.desc())
        .first()
    )
