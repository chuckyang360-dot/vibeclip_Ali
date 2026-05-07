from __future__ import annotations

from ..schemas.product import ProductRawInputSchema


def normalize_product_raw_input(raw: ProductRawInputSchema) -> ProductRawInputSchema:
    def _clean_text(v: str) -> str:
        return str(v or "").strip()

    def _clean_list(values: list[str]) -> list[str]:
        out: list[str] = []
        for item in values or []:
            t = _clean_text(item)
            if t:
                out.append(t)
        return out

    images = []
    for idx, img in enumerate(raw.product_images or []):
        url = _clean_text(img.image_url)
        if not url:
            continue
        images.append(
            {
                "image_url": url,
                "image_order": int(img.image_order if img.image_order is not None else idx),
                "is_main_image": bool(img.is_main_image),
                "image_caption_raw": _clean_text(img.image_caption_raw),
            }
        )
    if images and not any(i["is_main_image"] for i in images):
        images[0]["is_main_image"] = True

    return ProductRawInputSchema(
        product_name_raw=_clean_text(raw.product_name_raw),
        product_category_raw=_clean_text(raw.product_category_raw),
        brand_raw=_clean_text(raw.brand_raw),
        price_raw=_clean_text(raw.price_raw),
        target_users_raw=_clean_text(raw.target_users_raw),
        selling_points_raw=_clean_list(raw.selling_points_raw),
        usage_scenarios_raw=_clean_list(raw.usage_scenarios_raw),
        extra_notes_raw=_clean_text(raw.extra_notes_raw),
        product_images=images,
    )
