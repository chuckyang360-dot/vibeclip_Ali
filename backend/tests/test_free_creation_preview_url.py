from __future__ import annotations

from app.free_creation.models import FreeCreationAsset, FreeCreationSegment
from app.free_creation.service import asset_to_response, segment_to_response


def test_asset_response_uses_presigned_preview_url(monkeypatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setattr(
        "app.free_creation.service.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )
    row = FreeCreationAsset(
        id=1,
        project_id=2,
        user_id=3,
        asset_type="image",
        url="https://public.example/free-creation/uploads/3/2/a.png",
        storage_key="free-creation/uploads/3/2/a.png",
        file_name="a.png",
        mime_type="image/png",
        file_size=12,
        role="reference_image",
        label="@图片1",
    )

    data = asset_to_response(row)

    assert data["url"] == "https://public.example/free-creation/uploads/3/2/a.png"
    assert data["preview_url"] == "https://signed.example/free-creation/uploads/3/2/a.png"


def test_segment_response_adds_preview_urls_to_bound_assets_and_outputs(monkeypatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setattr(
        "app.free_creation.service.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )
    row = FreeCreationSegment(
        id=4,
        project_id=2,
        user_id=3,
        segment_index=1,
        title="片段 1",
        prompt="p",
        input_assets_json=[
            {
                "type": "image",
                "url": "https://public.example/free-creation/uploads/3/2/a.png",
                "storage_key": "free-creation/uploads/3/2/a.png",
            }
        ],
        video_url="https://public.example/free-creation/videos/3/2/4/result.mp4",
        video_storage_key="free-creation/videos/3/2/4/result.mp4",
        last_frame_url="https://public.example/free-creation/images/3/2/4/last_frame.png",
        last_frame_storage_key="free-creation/images/3/2/4/last_frame.png",
    )

    data = segment_to_response(row)

    assert data["input_assets"][0]["preview_url"] == "https://signed.example/free-creation/uploads/3/2/a.png"
    assert data["video_preview_url"] == "https://signed.example/free-creation/videos/3/2/4/result.mp4"
    assert data["last_frame_preview_url"] == "https://signed.example/free-creation/images/3/2/4/last_frame.png"


def test_segment_response_treats_existing_video_as_completed() -> None:
    row = FreeCreationSegment(
        id=5,
        project_id=2,
        user_id=3,
        segment_index=1,
        title="片段 1",
        prompt="p",
        status="idle",
        video_url="https://public.example/free-creation/videos/3/2/5/result.mp4",
    )

    data = segment_to_response(row)

    assert data["status"] == "completed"
