"""S3 image batch task lock must always release; failures restore asset_specs_generated."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import User
from app.short_drama.models import AssetEntity, CharacterAsset, ShortDramaProject
from app.short_drama.services.asset_library_service import asset_library_service
from app.short_drama.services.project_task_guard import (
    acquire_project_task_lock,
    finalize_s3_images_task,
    is_processing,
    mark_project_stage_failed,
    recover_stale_processing_status_if_possible,
)
from app.short_drama.utils.enums import ProjectStatus


@pytest.fixture
def db() -> Session:
    init_db()
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


def _new_user(session: Session) -> int:
    token = uuid.uuid4().hex[:12]
    row = User(
        username=f"s3_guard_{token}",
        name="S3 Guard",
        email=f"s3-guard-{token}@example.com",
        password_hash="x",
        is_active=True,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return int(row.id)


def _project(session: Session, *, status: str = ProjectStatus.ASSET_SPECS_GENERATED.value) -> ShortDramaProject:
    p = ShortDramaProject(
        user_id=_new_user(session),
        project_name="s3-guard-test",
        status=status,
        step_status={},
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def test_mark_project_stage_failed_s3_restores_asset_specs_generated(db: Session) -> None:
    p = _project(db)
    acquire_project_task_lock(db, p, stage="s3_images")
    assert p.status == "processing"

    mark_project_stage_failed(
        db,
        p.id,
        stage="s3_images",
        error_type_value="missing_b64_json",
        message="proxy returned no image bytes",
    )
    db.refresh(p)
    assert p.status == ProjectStatus.ASSET_SPECS_GENERATED.value
    rt = (p.step_status or {}).get("_runtime") or {}
    assert rt.get("task_running") is False
    assert rt.get("current_stage") in ("", None)
    assert rt.get("can_retry") is True
    assert not is_processing(p)


def test_finalize_s3_images_all_failed(db: Session) -> None:
    p = _project(db)
    acquire_project_task_lock(db, p, stage="s3_images")

    finalize_s3_images_task(
        db,
        p.id,
        total_attempts=3,
        total_succeeded=0,
        message="all failed",
    )
    db.refresh(p)
    assert p.status == ProjectStatus.ASSET_SPECS_GENERATED.value
    assert not is_processing(p)


def test_finalize_s3_images_provider_error(db: Session) -> None:
    p = _project(db)
    acquire_project_task_lock(db, p, stage="s3_images")

    finalize_s3_images_task(
        db,
        p.id,
        error_type_value="image_generation_failed",
        message="railway_ai_proxy_image_timeout",
    )
    db.refresh(p)
    assert p.status == ProjectStatus.ASSET_SPECS_GENERATED.value
    assert not is_processing(p)


def test_second_project_not_blocked_after_first_s3_failure(db: Session) -> None:
    uid = _new_user(db)
    p1 = ShortDramaProject(
        user_id=uid,
        project_name="blocked-first",
        status=ProjectStatus.ASSET_SPECS_GENERATED.value,
        step_status={},
    )
    p2 = ShortDramaProject(
        user_id=uid,
        project_name="blocked-second",
        status=ProjectStatus.STORY_GENERATED.value,
        step_status={},
    )
    db.add_all([p1, p2])
    db.commit()
    db.refresh(p1)
    db.refresh(p2)

    acquire_project_task_lock(db, p1, stage="s3_images")
    finalize_s3_images_task(
        db,
        p1.id,
        error_type_value="timeout",
        message="timeout",
    )
    db.refresh(p1)
    assert p1.status == ProjectStatus.ASSET_SPECS_GENERATED.value

    acquire_project_task_lock(db, p2, stage="s2_story")
    db.refresh(p2)
    assert p2.status == "processing"


def test_finalize_s3_images_success_clears_processing(db: Session) -> None:
    p = _project(db)
    acquire_project_task_lock(db, p, stage="s3_images")

    finalize_s3_images_task(
        db,
        p.id,
        total_attempts=2,
        total_succeeded=1,
    )
    db.refresh(p)
    assert not is_processing(p)
    assert p.status in (
        ProjectStatus.ASSETS_READY.value,
        ProjectStatus.ASSET_SPECS_GENERATED.value,
    )


def test_recover_stale_s3_images_lock_even_when_task_running_true(db: Session) -> None:
    p = _project(db)
    db.add(
        AssetEntity(
            project_id=p.id,
            asset_type="character",
            name="Hero",
            description="retryable asset row",
            base_prompt="studio portrait",
            source="system_generated",
            status="active",
        )
    )
    stale_lock = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    p.status = "processing"
    p.step_status = {
        "_runtime": {
            "task_running": True,
            "current_stage": "s3_images",
            "lock_acquired_at": stale_lock,
            "previous_status": ProjectStatus.ASSET_SPECS_GENERATED.value,
        }
    }
    db.add(p)
    db.commit()
    db.refresh(p)

    result = recover_stale_processing_status_if_possible(db, p)

    assert result == "recovered"
    assert p.status == ProjectStatus.ASSET_SPECS_GENERATED.value
    assert not is_processing(p)


def test_asset_library_sync_clears_stale_image_failure_meta_when_image_exists(db: Session) -> None:
    p = _project(db)
    legacy = CharacterAsset(
        project_id=p.id,
        name="Hero",
        role_type="main",
        description="retryable asset row",
        visual_prompt="studio portrait",
        image_url="https://cdn.example.com/hero.jpg",
        meta_json={"image_prompt": "studio portrait"},
    )
    db.add(legacy)
    db.commit()
    db.refresh(legacy)
    asset = AssetEntity(
        project_id=p.id,
        asset_type="character",
        name="Hero",
        description="retryable asset row",
        base_prompt="studio portrait",
        source="system_generated",
        status="active",
        extra_json={
            "legacy_source": {"table_asset_id": legacy.id, "asset_type": "character"},
            "image_generation_status": "failed",
            "image_generation_error_type": "ShortDramaImageProviderError",
            "image_generation_error_message": "old upstream error",
            "type_fields": {
                "image_prompt": "studio portrait",
                "image_generation_status": "failed",
                "image_generation_error_type": "ShortDramaImageProviderError",
                "image_generation_error_message": "old upstream error",
            },
        },
    )
    db.add(asset)
    db.commit()

    asset_library_service.sync_legacy_assets_for_project(db, p.id)
    db.commit()
    db.refresh(asset)

    extra = dict(asset.extra_json or {})
    tf = dict(extra.get("type_fields") or {})
    assert "image_generation_status" not in extra
    assert "image_generation_error_type" not in extra
    assert "image_generation_error_message" not in extra
    assert "image_generation_status" not in tf
    assert "image_generation_error_type" not in tf
    assert "image_generation_error_message" not in tf
