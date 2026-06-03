from __future__ import annotations

from .schemas import AdMaterialTemplate


TEMPLATES: list[AdMaterialTemplate] = [
    AdMaterialTemplate(
        id="hero-product-clean",
        name="商品主图质感展示",
        category="商品主图",
        description="适合白底商品图、详情页主图视频和电商首屏展示。",
        industry_tags=["美妆", "3C", "家居", "食品"],
        supported_ratios=["9:16", "1:1", "3:4", "16:9"],
        default_ratio="9:16",
        default_duration=8,
        default_resolution="720p",
        default_generate_audio=False,
        slots=[
            {"key": "product_image", "type": "image", "required": True, "label": "商品图片"},
            {"key": "product_name", "type": "text", "required": True, "label": "商品名称"},
            {"key": "selling_points", "type": "text", "required": True, "label": "核心卖点"},
        ],
    ),
    AdMaterialTemplate(
        id="viral-ad-cuts",
        name="爆款投流快切",
        category="爆款投流",
        description="快节奏展示商品卖点，适合抖音、视频号投流素材。",
        industry_tags=["美妆", "服饰", "食品", "数码"],
        supported_ratios=["9:16", "3:4"],
        default_ratio="9:16",
        default_duration=11,
        default_resolution="720p",
        default_generate_audio=True,
        slots=[
            {"key": "product_image", "type": "image", "required": True, "label": "商品图片"},
            {"key": "selling_points", "type": "text", "required": True, "label": "投流卖点"},
            {"key": "reference_audio", "type": "audio", "required": False, "label": "节奏参考音频"},
        ],
    ),
    AdMaterialTemplate(
        id="virtual-host-demo",
        name="虚拟达人讲解",
        category="达人口播",
        description="虚拟人像手持或展示商品，输出带台词的口播素材。",
        industry_tags=["美妆", "保健", "家居", "母婴"],
        supported_ratios=["9:16", "16:9"],
        default_ratio="9:16",
        default_duration=11,
        default_resolution="720p",
        default_generate_audio=True,
        slots=[
            {"key": "avatar", "type": "avatar", "required": False, "label": "虚拟人像 asset"},
            {"key": "product_image", "type": "image", "required": True, "label": "商品图片"},
            {"key": "selling_points", "type": "text", "required": True, "label": "口播卖点"},
        ],
    ),
    AdMaterialTemplate(
        id="product-replace-edit",
        name="爆款视频商品替换",
        category="视频编辑",
        description="上传参考视频和新商品图，保持原动作和运镜，替换视频中的商品。",
        industry_tags=["通用"],
        supported_ratios=["adaptive", "9:16", "16:9", "1:1"],
        default_ratio="adaptive",
        default_duration=8,
        default_resolution="720p",
        default_generate_audio=True,
        slots=[
            {"key": "reference_video", "type": "video", "required": True, "label": "参考视频"},
            {"key": "product_image", "type": "image", "required": True, "label": "新商品图片"},
        ],
    ),
]


def list_templates() -> list[AdMaterialTemplate]:
    return TEMPLATES


def get_template(template_id: str) -> AdMaterialTemplate | None:
    tid = (template_id or "").strip()
    return next((tpl for tpl in TEMPLATES if tpl.id == tid), None)
