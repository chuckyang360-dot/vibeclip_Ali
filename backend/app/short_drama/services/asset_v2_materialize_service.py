"""S3 P2: deterministic materialization from creative_blueprint_v2.asset_generation_specs only."""

from __future__ import annotations

import json
import logging
import re

from sqlalchemy.orm import Session

from ..exceptions import ShortDramaInvalidModelOutputError
from ..models import CharacterAsset, ProductAsset, SceneAsset
from ..schemas.asset import (
    AssetSpecsBundleSchema,
    CharacterAssetSchema,
    ProductAssetSchema,
    SceneAssetSchema,
)
from ..schemas.story import (
    AssetGenerationSpecSchema,
    CreativeBlueprintCharacterSchema,
    CreativeBlueprintProductAssetSchema,
    CreativeBlueprintSceneSchema,
    StoryBlueprintSchema,
)

logger = logging.getLogger(__name__)

CREATIVE_BLUEPRINT_V2_SCHEMA_VERSION = "creative_blueprint_v2"

# UI-facing name only; do not apply to image_prompt / negative_prompt / immutable_constraints.
_ASSET_DISPLAY_NAME_SUFFIXES: tuple[str, ...] = (
    "character reference",
    "scene reference",
    "product reference",
    "reference image",
    "asset reference",
    "参考图",
    "资产参考",
    "参考",
)


def normalize_asset_display_name(raw: str) -> str:
    """Strip trailing purpose suffixes from S2 display_name (non-creative normalization for DB name)."""
    s = str(raw or "").strip()
    if not s:
        return ""
    original = s
    for _ in range(24):
        before = s
        for suf in sorted(_ASSET_DISPLAY_NAME_SUFFIXES, key=len, reverse=True):
            if any("\u4e00" <= c <= "\u9fff" for c in suf):
                if s.endswith(suf):
                    s = s[: -len(suf)].rstrip()
                    break
            else:
                pat = rf"(?i)\s*{re.escape(suf)}\s*$"
                if re.search(pat, s):
                    s = re.sub(pat, "", s).rstrip()
                    break
        else:
            m = re.search(r"(?i)(.+?)(\s+)reference\s*$", s)
            if m and m.group(1).strip():
                s = m.group(1).rstrip()
        if s == before:
            break
    s = s.strip()
    return s if s else original


def is_creative_blueprint_v2_project(blueprint: StoryBlueprintSchema) -> bool:
    return str(blueprint.blueprint_schema_version or "").strip() == CREATIVE_BLUEPRINT_V2_SCHEMA_VERSION


def _fail_validate(project_id: int, asset_key: str, missing_field: str, reason: str) -> None:
    payload = {
        "project_id": project_id,
        "asset_key": asset_key,
        "missing_field": missing_field,
        "reason": reason,
    }
    logger.warning("[S3_ASSET_SPEC_VALIDATE_FAILED] %s", json.dumps(payload, ensure_ascii=False))
    raise ShortDramaInvalidModelOutputError(
        reason,
        code="s3_v2_asset_spec_invalid",
        missing_fields=[f"{asset_key}:{missing_field}"],
    )


def _validate_linked_entity_key(
    project_id: int,
    spec: AssetGenerationSpecSchema,
    *,
    char_keys: set[str],
    scene_keys: set[str],
    product_keys: set[str],
) -> None:
    ak = str(spec.asset_key or "").strip()
    lk = str(spec.linked_entity_key or "").strip()
    if not lk:
        _fail_validate(
            project_id,
            ak or "(missing_asset_key)",
            "linked_entity_key",
            "linked_entity_key is required for v2 asset_generation_specs rows.",
        )
    kind = str(spec.asset_kind or "").strip().lower()
    if kind == "character":
        if lk in char_keys:
            return
        if lk in scene_keys:
            _fail_validate(
                project_id,
                ak,
                "linked_entity_key",
                f"asset_kind is character but linked_entity_key {lk!r} matches scenes[].scene_key; "
                "expected characters[].character_key.",
            )
        if lk in product_keys:
            _fail_validate(
                project_id,
                ak,
                "linked_entity_key",
                f"asset_kind is character but linked_entity_key {lk!r} matches product_assets[].product_asset_key; "
                "expected characters[].character_key.",
            )
        _fail_validate(
            project_id,
            ak,
            "linked_entity_key",
            f"linked_entity_key {lk!r} not found in blueprint.characters[].character_key.",
        )
    if kind == "scene":
        if lk in scene_keys:
            return
        if lk in char_keys:
            _fail_validate(
                project_id,
                ak,
                "linked_entity_key",
                f"asset_kind is scene but linked_entity_key {lk!r} matches characters[].character_key; "
                "expected scenes[].scene_key.",
            )
        if lk in product_keys:
            _fail_validate(
                project_id,
                ak,
                "linked_entity_key",
                f"asset_kind is scene but linked_entity_key {lk!r} matches product_assets[].product_asset_key; "
                "expected scenes[].scene_key.",
            )
        _fail_validate(
            project_id,
            ak,
            "linked_entity_key",
            f"linked_entity_key {lk!r} not found in blueprint.scenes[].scene_key.",
        )
    if kind == "product":
        if lk in product_keys:
            return
        if lk in char_keys:
            _fail_validate(
                project_id,
                ak,
                "linked_entity_key",
                f"asset_kind is product but linked_entity_key {lk!r} matches characters[].character_key; "
                "expected product_assets[].product_asset_key.",
            )
        if lk in scene_keys:
            _fail_validate(
                project_id,
                ak,
                "linked_entity_key",
                f"asset_kind is product but linked_entity_key {lk!r} matches scenes[].scene_key; "
                "expected product_assets[].product_asset_key.",
            )
        _fail_validate(
            project_id,
            ak,
            "linked_entity_key",
            f"linked_entity_key {lk!r} not found in blueprint.product_assets[].product_asset_key.",
        )


def validate_v2_asset_generation_specs(project_id: int, blueprint: StoryBlueprintSchema) -> None:
    specs = list(blueprint.asset_generation_specs or [])
    if not specs:
        _fail_validate(
            project_id,
            "(none)",
            "asset_generation_specs",
            "creative_blueprint_v2 requires at least one asset_generation_specs row.",
        )

    char_keys = {str(c.character_key or "").strip() for c in blueprint.characters if str(c.character_key or "").strip()}
    scene_keys = {str(s.scene_key or "").strip() for s in blueprint.scenes if str(s.scene_key or "").strip()}
    product_keys = {
        str(p.product_asset_key or "").strip() for p in blueprint.product_assets if str(p.product_asset_key or "").strip()
    }

    seen_keys: set[str] = set()
    for spec in specs:
        ak = str(spec.asset_key or "").strip()
        if not ak:
            _fail_validate(project_id, "(empty)", "asset_key", "asset_key is required for each asset_generation_specs row.")
        if ak in seen_keys:
            _fail_validate(project_id, ak, "asset_key", f"Duplicate asset_key {ak!r} in asset_generation_specs.")
        seen_keys.add(ak)

        ip = str(spec.image_prompt or "").strip()
        if not ip:
            _fail_validate(project_id, ak, "image_prompt", "image_prompt must be non-empty for v2 asset_generation_specs.")

        kind = str(spec.asset_kind or "").strip().lower()
        if kind not in {"character", "scene", "product"}:
            _fail_validate(project_id, ak, "asset_kind", f"Invalid asset_kind {spec.asset_kind!r}.")

        _validate_linked_entity_key(project_id, spec, char_keys=char_keys, scene_keys=scene_keys, product_keys=product_keys)


def _char_by_key(blueprint: StoryBlueprintSchema, key: str) -> CreativeBlueprintCharacterSchema | None:
    for c in blueprint.characters:
        if str(c.character_key or "").strip() == key:
            return c
    return None


def _scene_by_key(blueprint: StoryBlueprintSchema, key: str) -> CreativeBlueprintSceneSchema | None:
    for s in blueprint.scenes:
        if str(s.scene_key or "").strip() == key:
            return s
    return None


def _product_by_key(blueprint: StoryBlueprintSchema, key: str) -> CreativeBlueprintProductAssetSchema | None:
    for p in blueprint.product_assets:
        if str(p.product_asset_key or "").strip() == key:
            return p
    return None


def build_v2_asset_specs_bundle(*, project_id: int, blueprint: StoryBlueprintSchema) -> AssetSpecsBundleSchema:
    validate_v2_asset_generation_specs(project_id, blueprint)
    characters: list[CharacterAssetSchema] = []
    scenes: list[SceneAssetSchema] = []
    products: list[ProductAssetSchema] = []

    for spec in blueprint.asset_generation_specs or []:
        kind = str(spec.asset_kind or "").strip().lower()
        ak = str(spec.asset_key or "").strip()
        lk = str(spec.linked_entity_key or "").strip()
        display = normalize_asset_display_name(str(spec.display_name or "").strip()) or ak
        ip = str(spec.image_prompt or "").strip()
        np = str(spec.negative_prompt or "").strip()
        ic = list(spec.immutable_constraints or [])

        type_fields: dict = {
            "image_prompt": ip,
            "negative_prompt": np,
            "immutable_constraints": ic,
            "linked_entity_key": lk,
            "asset_key": ak,
            "reference_role": str(spec.reference_role or "").strip(),
            "asset_spec_source": "s2_asset_generation_specs",
        }

        if kind == "character":
            meta: dict = {
                "type_fields": type_fields,
                "v2_asset_spec_pass_through": True,
            }
            ent = _char_by_key(blueprint, lk)
            desc = str(spec.description or "").strip() or (str(ent.description or "").strip() if ent else "")
            characters.append(
                CharacterAssetSchema(
                    name=display,
                    role_type="main",
                    description=desc or None,
                    image_prompt=ip,
                    visual_prompt=ip,
                    meta=meta,
                )
            )
        elif kind == "scene":
            meta = {
                "type_fields": type_fields,
                "v2_asset_spec_pass_through": True,
            }
            ent = _scene_by_key(blueprint, lk)
            desc = str(spec.description or "").strip() or (str(ent.description or "").strip() if ent else "")
            st = str(ent.location_type or "").strip() if ent else None
            scenes.append(
                SceneAssetSchema(
                    name=display,
                    scene_type=st,
                    description=desc or None,
                    image_prompt=ip,
                    visual_prompt=ip,
                    meta=meta,
                )
            )
        else:
            tf = dict(type_fields)
            tf["product_role"] = "hero"
            meta = {
                "type_fields": tf,
                "v2_asset_spec_pass_through": True,
            }
            ent = _product_by_key(blueprint, lk)
            desc = str(spec.description or "").strip() or (str(ent.description or "").strip() if ent else "")
            products.append(
                ProductAssetSchema(
                    name=display,
                    product_role="hero",
                    description=desc or None,
                    image_prompt=ip,
                    visual_prompt=ip,
                    meta=meta,
                )
            )

    return AssetSpecsBundleSchema(characters=characters, scenes=scenes, products=products)


def persist_v2_asset_specs_bundle_to_legacy_tables(db: Session, project_id: int, bundle: AssetSpecsBundleSchema) -> None:
    """Insert legacy Character/Scene/Product rows from a v2-only bundle (no name/prompt rewriting)."""
    for c in bundle.characters:
        row = CharacterAsset(
            project_id=project_id,
            name=c.name,
            role_type=c.role_type or "main",
            description=c.description,
            visual_prompt=(c.visual_prompt or "").strip(),
            image_url=c.image_url,
            meta_json=dict(c.meta or {}),
        )
        db.add(row)
        db.flush()
        tf = (row.meta_json or {}).get("type_fields") or {}
        logger.info(
            "[S3_V2_ASSET_SPEC_MATERIALIZED] %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "asset_key": tf.get("asset_key"),
                    "asset_kind": "character",
                    "asset_id": row.id,
                    "linked_entity_key": tf.get("linked_entity_key"),
                },
                ensure_ascii=False,
            ),
        )

    for s in bundle.scenes:
        st = (str(s.scene_type or "").strip() or "scene_reference")
        row = SceneAsset(
            project_id=project_id,
            name=s.name,
            scene_type=st,
            description=s.description,
            visual_prompt=(s.visual_prompt or "").strip(),
            image_url=s.image_url,
            meta_json=dict(s.meta or {}),
        )
        db.add(row)
        db.flush()
        tf = (row.meta_json or {}).get("type_fields") or {}
        logger.info(
            "[S3_V2_ASSET_SPEC_MATERIALIZED] %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "asset_key": tf.get("asset_key"),
                    "asset_kind": "scene",
                    "asset_id": row.id,
                    "linked_entity_key": tf.get("linked_entity_key"),
                },
                ensure_ascii=False,
            ),
        )

    for p in bundle.products:
        row = ProductAsset(
            project_id=project_id,
            name=p.name,
            description=p.description,
            visual_prompt=(p.visual_prompt or "").strip(),
            image_url=p.image_url,
            meta_json=dict(p.meta or {}),
        )
        db.add(row)
        db.flush()
        tf = (row.meta_json or {}).get("type_fields") or {}
        logger.info(
            "[S3_V2_ASSET_SPEC_MATERIALIZED] %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "asset_key": tf.get("asset_key"),
                    "asset_kind": "product",
                    "asset_id": row.id,
                    "linked_entity_key": tf.get("linked_entity_key"),
                },
                ensure_ascii=False,
            ),
        )
