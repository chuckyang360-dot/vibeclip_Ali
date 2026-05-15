from __future__ import annotations

import json

from app.short_drama.schemas.product import (
    ProductImageInputSchema,
    ProductImageUnderstandingSchema,
    ProductRawInputSchema,
)
from app.short_drama.services.product_context_builder import build_product_context_builder_payload


def test_product_context_builder_payload_sanitizes_large_image_data_url() -> None:
    long_base64 = "A" * 1_000_000
    image_url = f"data:image/png;base64,{long_base64}"
    raw_input = ProductRawInputSchema(
        product_name_raw="Demo product",
        product_category_raw="Home",
        brand_raw="Brand",
        target_users_raw="Users",
        selling_points_raw=["compact"],
        product_images=[
            ProductImageInputSchema(
                image_url=image_url,
                image_order=2,
                is_main_image=True,
                image_caption_raw="front view",
            )
        ],
    )
    image_understanding = ProductImageUnderstandingSchema(detected_visual_features=["matte white"])

    payload, audit = build_product_context_builder_payload(
        project_id=7,
        raw_input=raw_input,
        image_understanding=image_understanding,
        project_constraints={"language_policy": {"workflow_language": "zh-CN"}},
    )
    payload_json = json.dumps(payload, ensure_ascii=False)

    assert long_base64 not in payload_json
    assert "data:image/png;base64" not in payload_json
    assert audit["has_base64_in_payload"] is False
    assert audit["raw_product_images_count"] == 1
    assert audit["raw_product_images_sanitized"] is True
    assert len(payload_json) < 10_000
    assert payload["raw_input"]["product_images"] == {
        "image_count": 1,
        "items": [{"image_order": 2, "is_main_image": True, "image_caption_raw": "front view"}],
    }

    # The original S1 input is untouched, so image_understanding_service can still consume the image.
    assert raw_input.product_images[0].image_url == image_url
