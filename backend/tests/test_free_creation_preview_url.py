from __future__ import annotations

from app.free_creation.models import FreeCreationAsset, FreeCreationSegment
from app.free_creation.service import asset_to_response, build_seedance_payload, downloadable_free_creation_url, segment_to_response


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


def test_downloadable_free_creation_url_presigns_private_video_url(monkeypatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setattr(
        "app.free_creation.service.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )

    url = downloadable_free_creation_url(
        "https://pub.example.r2.dev/free-creation/videos/3/2/5/result.mp4"
    )

    assert url == "https://signed.example/free-creation/videos/3/2/5/result.mp4"


def test_downloadable_free_creation_url_prefers_storage_key(monkeypatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setattr(
        "app.free_creation.service.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )

    url = downloadable_free_creation_url(
        "https://pub.example.r2.dev/free-creation/videos/wrong/result.mp4",
        storage_key="free-creation/videos/3/2/5/result.mp4",
    )

    assert url == "https://signed.example/free-creation/videos/3/2/5/result.mp4"


def test_seedance_payload_only_sends_prompt_referenced_assets(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.free_creation.service.provider_ready_asset_url",
        lambda url, storage_key=None: str(url or ""),
    )
    row = FreeCreationSegment(
        id=6,
        project_id=2,
        user_id=3,
        segment_index=1,
        title="片段 1",
        prompt="背景参考@图片6，男主说话，画面马上衔接@图片7和@图片8",
        input_assets_json=[
            {
                "type": "image",
                "url": f"https://example.test/image-{idx}.png",
                "role": "reference_image",
                "label": f"@图片{idx}",
            }
            for idx in range(1, 9)
        ],
    )

    payload = build_seedance_payload(row)

    assert payload["content"] == [
        {"type": "text", "text": row.prompt},
        {"type": "image_url", "image_url": {"url": "https://example.test/image-6.png"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "https://example.test/image-7.png"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "https://example.test/image-8.png"}, "role": "reference_image"},
    ]


def test_seedance_payload_keeps_all_assets_when_prompt_has_no_asset_labels(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.free_creation.service.provider_ready_asset_url",
        lambda url, storage_key=None: str(url or ""),
    )
    row = FreeCreationSegment(
        id=7,
        project_id=2,
        user_id=3,
        segment_index=1,
        title="片段 1",
        prompt="沿山路骑行，保持照片质感",
        input_assets_json=[
            {"type": "image", "url": "https://example.test/image-1.png", "role": "reference_image", "label": "@图片1"},
            {"type": "image", "url": "https://example.test/image-2.png", "role": "reference_image", "label": "@图片2"},
        ],
    )

    payload = build_seedance_payload(row)

    assert [item["image_url"]["url"] for item in payload["content"][1:]] == [
        "https://example.test/image-1.png",
        "https://example.test/image-2.png",
    ]


def test_seedance_payload_does_not_match_short_numeric_label_prefix(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.free_creation.service.provider_ready_asset_url",
        lambda url, storage_key=None: str(url or ""),
    )
    row = FreeCreationSegment(
        id=8,
        project_id=2,
        user_id=3,
        segment_index=1,
        title="片段 1",
        prompt="只参考@图片10",
        input_assets_json=[
            {"type": "image", "url": "https://example.test/image-1.png", "role": "reference_image", "label": "@图片1"},
            {"type": "image", "url": "https://example.test/image-10.png", "role": "reference_image", "label": "@图片10"},
        ],
    )

    payload = build_seedance_payload(row)

    assert payload["content"] == [
        {"type": "text", "text": row.prompt},
        {"type": "image_url", "image_url": {"url": "https://example.test/image-10.png"}, "role": "reference_image"},
    ]
