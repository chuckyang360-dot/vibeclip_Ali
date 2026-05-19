"""Credit checks at Short Drama API boundaries (before external AI calls)."""

from __future__ import annotations

import hashlib

from sqlalchemy.orm import Session

from ...services.credit_service import (
    charge_project,
    count_assets_missing_images,
    ensure_project_credit_balance,
    get_project_user_id,
    raise_insufficient_credits_http,
    require_project_credits,
    s1_product_parse_required_credits,
    stable_hash_payload,
    InsufficientCreditsError,
)
from ..schemas.product import ParseProductRequest


def _input_has_text(body: ParseProductRequest) -> bool:
    inp = body.input
    parts = [
        inp.product_name_raw,
        inp.product_link_raw,
        inp.extra_notes_raw,
        inp.target_users_raw,
        inp.usage_scenarios_raw,
    ]
    if any(str(p or "").strip() for p in parts):
        return True
    for row in inp.selling_points_raw or []:
        if str(row or "").strip():
            return True
    return False


def require_s1_product_parse_credits(db: Session, body: ParseProductRequest) -> int:
    image_count = len(body.input.product_images or [])
    required = s1_product_parse_required_credits(
        has_text=_input_has_text(body),
        image_count=image_count,
    )
    if required <= 0:
        return 0
    try:
        ensure_project_credit_balance(db, body.project_id, required)
    except InsufficientCreditsError as e:
        raise_insufficient_credits_http(e.required_credits, e.current_balance)
    return required


def charge_s1_product_parse_credits(db: Session, body: ParseProductRequest, *, version: int) -> None:
    user_id = get_project_user_id(db, body.project_id)
    payload_hash = stable_hash_payload(
        {
            "reparse_mode": body.reparse_mode,
            "input": body.input.model_dump(),
            "version": version,
        }
    )
    if _input_has_text(body):
        charge_project(
            db,
            project_id=body.project_id,
            cost_code="text_understanding",
            idempotency_key=f"short_drama:{body.project_id}:s1:text_understanding:v{version}:{payload_hash}",
        )
    for idx, img in enumerate(body.input.product_images or []):
        order = getattr(img, "image_order", None) or (idx + 1)
        img_hash = hashlib.sha256(str(getattr(img, "image_url", "") or "").encode("utf-8")).hexdigest()[:16]
        charge_project(
            db,
            project_id=body.project_id,
            cost_code="image_understanding",
            idempotency_key=(
                f"short_drama:{body.project_id}:s1:image_understanding:v{version}:order{order}:{img_hash}"
            ),
        )


def require_script_generation_credits(db: Session, project_id: int) -> None:
    require_project_credits(db, project_id, "script_generation")


def charge_script_generation(db: Session, project_id: int, *, attempt_key: str) -> None:
    charge_project(
        db,
        project_id=project_id,
        cost_code="script_generation",
        idempotency_key=f"short_drama:{project_id}:s2:script_generation:{attempt_key}",
    )


def require_segment_script_generation_credits(db: Session, project_id: int) -> None:
    """S4 segment director AI path — same unit cost as S2 script generation."""
    require_project_credits(db, project_id, "script_generation")


def charge_segment_script_generation(db: Session, project_id: int, *, attempt_key: str) -> None:
    charge_project(
        db,
        project_id=project_id,
        cost_code="script_generation",
        idempotency_key=f"short_drama:{project_id}:segment_generate:{attempt_key}",
    )


def require_text_understanding_credits(db: Session, project_id: int) -> None:
    require_project_credits(db, project_id, "text_understanding")


def charge_text_understanding(db: Session, project_id: int, *, attempt_key: str) -> None:
    charge_project(
        db,
        project_id=project_id,
        cost_code="text_understanding",
        idempotency_key=f"short_drama:{project_id}:s1:text_understanding:{attempt_key}",
    )


def require_image_understanding_credits(db: Session, project_id: int, *, image_count: int = 1) -> None:
    if image_count <= 0:
        return
    require_project_credits(db, project_id, "image_understanding", units=image_count)


def charge_image_understanding(
    db: Session,
    project_id: int,
    *,
    attempt_key: str,
    image_count: int = 1,
) -> None:
    for i in range(max(0, image_count)):
        suffix = f"{attempt_key}:img{i}" if image_count > 1 else attempt_key
        charge_project(
            db,
            project_id=project_id,
            cost_code="image_understanding",
            idempotency_key=f"short_drama:{project_id}:s1:image_understanding:{suffix}",
        )


def require_image_asset_credits(db: Session, project_id: int, image_count: int) -> None:
    if image_count <= 0:
        return
    require_project_credits(
        db,
        project_id,
        "image_asset_generation",
        units=image_count,
    )


def charge_image_asset_credit(
    db: Session,
    *,
    project_id: int,
    asset_id: int | str,
    attempt_id: str,
) -> None:
    charge_project(
        db,
        project_id=project_id,
        cost_code="image_asset_generation",
        idempotency_key=f"short_drama:{project_id}:s3:asset:{asset_id}:image_generation:{attempt_id}",
    )


def require_segment_video_credits(db: Session, project_id: int, segment_count: int = 1) -> None:
    if segment_count <= 0:
        return
    require_project_credits(
        db,
        project_id,
        "segment_video_generation",
        units=segment_count,
    )


def charge_segment_video_credit(
    db: Session,
    *,
    project_id: int,
    segment_id: str,
    render_job_id: int,
) -> None:
    charge_project(
        db,
        project_id=project_id,
        cost_code="segment_video_generation",
        idempotency_key=f"short_drama:{project_id}:segment:{segment_id}:video_generation:job_{render_job_id}",
        extra_note=f"（{segment_id}）",
    )


def require_hd_export_credits(db: Session, project_id: int) -> None:
    require_project_credits(db, project_id, "hd_export")


def charge_hd_export(db: Session, project_id: int, *, export_key: str) -> None:
    charge_project(
        db,
        project_id=project_id,
        cost_code="hd_export",
        idempotency_key=f"short_drama:{project_id}:hd_export:{export_key}",
    )


def charge_batch_asset_images(
    db: Session,
    project_id: int,
    *,
    batch_key: str,
    characters_succeeded: int,
    scenes_succeeded: int,
    products_succeeded: int,
) -> None:
    idx = 0
    for kind, count in (
        ("character", characters_succeeded),
        ("scene", scenes_succeeded),
        ("product", products_succeeded),
    ):
        for _ in range(max(0, int(count))):
            charge_image_asset_credit(
                db,
                project_id=project_id,
                asset_id=f"{kind}_{idx}",
                attempt_id=f"{batch_key}:{kind}:{idx}",
            )
            idx += 1
