from __future__ import annotations

from app.ad_materials.schemas import AdMaterialInputAsset, CreateAdMaterialTaskRequest
from app.ad_materials.service import build_prompt, build_seedance_payload
from app.ad_materials.templates import get_template


def test_byte_camera_template_builds_seedance_video_reference_payload() -> None:
    template = get_template("byte-camera-renewal")
    assert template is not None
    assert template.theme_categories == ["电商带货", "产品展示", "视频编辑"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/17_2.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185116-9zhtg",
                label="@视频1",
            )
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "以【视频 1】中的相机为参考" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185116-9zhtg"},
            "role": "reference_video",
        },
    ]


def test_byte_makeup_cut_join_template_builds_two_video_reference_payload() -> None:
    template = get_template("byte-makeup-cut-join")
    assert template is not None
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-timeline-06-01__result01__QIGKb0.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260408151837-4dqnp",
                label="@视频1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260408151837-jcjgb",
                label="@视频2",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "【视频 1】中的人物化妆，涂粉底、修容、眼影、裸色口红几个步骤快速切镜头，接【视频 2】"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260408151837-4dqnp"},
            "role": "reference_video",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260408151837-jcjgb"},
            "role": "reference_video",
        },
    ]


def test_byte_gift_cream_replace_template_builds_image_then_video_payload() -> None:
    template = get_template("byte-gift-cream-replace")
    assert template is not None
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/39_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185114-9ld2t",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185114-gkn4w",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "将【视频 1】礼盒中的香水替换成【图片 1】中的面霜，运镜不变"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185114-9ld2t"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185114-gkn4w"},
            "role": "reference_video",
        },
    ]


def test_byte_dogfood_package_replace_template_builds_image_then_video_payload() -> None:
    template = get_template("byte-dogfood-package-replace")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-timeline-06-04__result01__KY0QbX.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185116-rnww2",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185116-ltclw",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "狗粮包装袋统一替换为【图片 1】中的新包装样式" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185116-rnww2"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185116-ltclw"},
            "role": "reference_video",
        },
    ]


def test_byte_house_blue_snow_edit_template_builds_image_then_video_payload() -> None:
    template = get_template("byte-house-blue-snow-edit")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.theme_categories == ["视频编辑", "建筑空间", "风格迁移"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/46_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-dg62w",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185115-6x477",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "将【视频 1】中的房子外立面墙壁刷成蓝色，天气和光线参考【图片 1】的雪天"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-dg62w"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185115-6x477"},
            "role": "reference_video",
        },
    ]


def test_byte_perfume_light_sweep_template_builds_two_video_reference_payload() -> None:
    template = get_template("byte-perfume-light-sweep")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-edit-02-03__result01__OHVEbO.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260408151818-pw4ks",
                label="@视频1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260408151818-sjckn",
                label="@视频2",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "保持【视频 1】香水主体不变，氛围感不变，产品级光线，将光线运动修改为，从左到右扫光，丁达尔效应"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260408151818-pw4ks"},
            "role": "reference_video",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260408151818-sjckn"},
            "role": "reference_video",
        },
    ]


def test_byte_apple_tea_fpv_ad_template_builds_image_image_video_audio_payload() -> None:
    template = get_template("byte-apple-tea-fpv-ad")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/32_6.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-857xj",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-m98j4",
                label="@图片2",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185115-nxqsl",
                label="@视频1",
            ),
            AdMaterialInputAsset(
                type="audio",
                role="reference_audio",
                url="asset://asset-20260224185115-vgw76",
                label="@音频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "seedance牌「苹苹安安」苹果果茶限定款" in prompt
    assert "全程使用【音频 1】作为背景音乐" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-857xj"},
            "role": "reference_image",
        },
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-m98j4"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185115-nxqsl"},
            "role": "reference_video",
        },
        {
            "type": "audio_url",
            "audio_url": {"url": "asset://asset-20260224185115-vgw76"},
            "role": "reference_audio",
        },
    ]


def test_byte_glasses_model_replace_template_builds_image_then_video_payload() -> None:
    template = get_template("byte-glasses-model-replace")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/40_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-j7xjt",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185115-rcs4v",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "将眼镜电商带货【视频 1】中的模特换成欧美人，参考【图片 1】，语言改成英语，人物动作和运镜不变"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-j7xjt"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185115-rcs4v"},
            "role": "reference_video",
        },
    ]


def test_byte_anime_fireworks_color_fix_template_builds_video_payload() -> None:
    template = get_template("byte-anime-fireworks-color-fix")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/12_2.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185116-whcxg",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "【视频 1】是一段日本花火大会的动漫片段，帮我修复视频的色彩"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185116-whcxg"},
            "role": "reference_video",
        },
    ]


def test_byte_pixel_fight_reference_template_builds_three_image_video_audio_payload() -> None:
    template = get_template("byte-pixel-fight-reference")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == ""
    assert template.cover_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/30_2.png"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-jkxvm",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-5776n",
                label="@图片2",
            ),
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-zd5pg",
                label="@图片3",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185115-6qwld",
                label="@视频1",
            ),
            AdMaterialInputAsset(
                type="audio",
                role="reference_audio",
                url="asset://asset-20260224185115-bs8l6",
                label="@音频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "参考【视频 1】的人物动作和镜头语言，生成【图片 1】和【图片 2】的打斗场面，打斗背景是【图片 3】，打斗的过程模仿《魂斗罗》像素游戏，背景音乐是【音频 1】中的音乐，随着打斗动作还有打斗音效。"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-jkxvm"},
            "role": "reference_image",
        },
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-5776n"},
            "role": "reference_image",
        },
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-zd5pg"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185115-6qwld"},
            "role": "reference_video",
        },
        {
            "type": "audio_url",
            "audio_url": {"url": "asset://asset-20260224185115-bs8l6"},
            "role": "reference_audio",
        },
    ]


def test_byte_lion_bullet_time_extend_template_builds_video_payload() -> None:
    template = get_template("byte-lion-bullet-time-extend")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/22_2.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185117-8v2sq",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "续写【视频 1】，狮子突然加速冲刺" in prompt
    assert "bullet time slow motion" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185117-8v2sq"},
            "role": "reference_video",
        },
    ]


def test_byte_woodcut_horse_motion_template_builds_image_then_video_payload() -> None:
    template = get_template("byte-woodcut-horse-motion")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/31_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185114-ww95m",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185114-5zp94",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "参考【图片 1】的版画风格" in prompt
    assert "马上有福" in prompt
    assert "画面中除了“马上有福”四字无其他文字" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185114-ww95m"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185114-5zp94"},
            "role": "reference_video",
        },
    ]


def test_byte_runway_clothes_replace_template_builds_image_then_video_payload() -> None:
    template = get_template("byte-runway-clothes-replace")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/44_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(
                type="image",
                role="reference_image",
                url="asset://asset-20260224185115-g2cjw",
                label="@图片1",
            ),
            AdMaterialInputAsset(
                type="video",
                role="reference_video",
                url="asset://asset-20260224185115-b9mnv",
                label="@视频1",
            ),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "将【视频 1】中模特走秀穿着的衣服换成【图片 1】中的衣服"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": "asset://asset-20260224185115-g2cjw"},
            "role": "reference_image",
        },
        {
            "type": "video_url",
            "video_url": {"url": "asset://asset-20260224185115-b9mnv"},
            "role": "reference_video",
        },
    ]


def test_byte_revenge_chess_anime_template_builds_seven_image_audio_payload() -> None:
    template = get_template("byte-revenge-chess-anime")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/36_10.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-jtzz8", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-dpcnt", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-f894x", label="@图片3"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-n6ntn", label="@图片4"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-t4rd2", label="@图片5"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-lcfd4", label="@图片6"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-vvdhh", label="@图片7"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185115-scvln", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "8秒智性博弈式战斗动漫片段" in prompt
    assert "女主声音参考【音频 1】中的御姐音色" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-jtzz8"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-dpcnt"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-f894x"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-n6ntn"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-t4rd2"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-lcfd4"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-vvdhh"}, "role": "reference_image"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185115-scvln"}, "role": "reference_audio"},
    ]


def test_byte_caterpillar_cocoon_prequel_template_builds_video_payload() -> None:
    template = get_template("byte-caterpillar-cocoon-prequel")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/18_2.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-2wwbd", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "结合【视频 1】，补全视频前置镜头，毛毛虫变成蝶蛹，画面风格保持一致"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-2wwbd"}, "role": "reference_video"},
    ]


def test_byte_window_spring_extension_template_builds_video_payload() -> None:
    template = get_template("byte-window-spring-extension")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-timeline-04-03__result01__D6yIbJ.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151837-jqgxn", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "向后延长【视频 1】:窗外景色丝滑变为春天，阳光明媚，画面变为暖色调，特写女生面部惊讶表情。"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151837-jqgxn"}, "role": "reference_video"},
    ]


def test_byte_kdrama_restaurant_noodle_template_builds_two_image_video_payload() -> None:
    template = get_template("byte-kdrama-restaurant-noodle")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/1_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-lxmhw", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-j68n4", label="@图片2"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185116-5nd7q", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "韩剧生活氛围感短片" in prompt
    assert "动作参考【视频 1】" in prompt
    assert "천천히 먹어. 아무도 안 뺏어." in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-lxmhw"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-j68n4"}, "role": "reference_image"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185116-5nd7q"}, "role": "reference_video"},
    ]


def test_byte_fpv_apple_pie_baking_template_builds_three_image_payload() -> None:
    template = get_template("byte-fpv-apple-pie-baking")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/5_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-chsbs", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-gcrtw", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-g4px5", label="@图片3"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "第一视角厨房烘焙 vlog" in prompt
    assert "视角参考【图片 1】" in prompt
    assert "苹果派参考【图片 3】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-chsbs"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-gcrtw"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-g4px5"}, "role": "reference_image"},
    ]


def test_byte_war_elephant_battlefield_template_builds_four_image_payload() -> None:
    template = get_template("byte-war-elephant-battlefield")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/6_5.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-xbqvs", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-2zwkz", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-vdhjg", label="@图片3"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-2nbbj", label="@图片4"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "史诗级电影感战场视频" in prompt
    assert "风格参考【图片 4】" in prompt
    assert "士兵穿着参考【图片 3】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-xbqvs"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-2zwkz"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-vdhjg"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-2nbbj"}, "role": "reference_image"},
    ]


def test_byte_flower_arrangement_timeline_template_builds_two_video_payload() -> None:
    template = get_template("byte-flower-arrangement-timeline")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/27_3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-99lcv", label="@视频1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-qvn6q", label="@视频2"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert prompt == "从【视频 1】到【视频 2】，生成这个女孩插花过程的视频"
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-99lcv"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-qvn6q"}, "role": "reference_video"},
    ]


def test_byte_boy_hug_grandpa_colorize_template_builds_two_image_video_payload() -> None:
    template = get_template("byte-boy-hug-grandpa-colorize")
    assert template is not None
    assert template.category == "参考生成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/3_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-fl8q5", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-rjhp6", label="@图片2"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185116-44pxt", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "3D动画电影风格叙事短片" in prompt
    assert "拥抱动作参考【视频 1】" in prompt
    assert "I missed you so much" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-fl8q5"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-rjhp6"}, "role": "reference_image"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185116-44pxt"}, "role": "reference_video"},
    ]


def test_byte_horse_red_envelope_prequel_template_builds_video_audio_payload() -> None:
    template = get_template("byte-horse-red-envelope-prequel")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/cn_3_3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-2z85l", label="@视频1"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185117-8gtr9", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "向前延长【视频 1】" in prompt
    assert "背景音乐为【音频 1】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-2z85l"}, "role": "reference_video"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185117-8gtr9"}, "role": "reference_audio"},
    ]


def test_byte_cloud_ice_cream_cabin_template_builds_three_image_audio_payload() -> None:
    template = get_template("byte-cloud-ice-cream-cabin")
    assert template is not None
    assert template.category == "参考合成"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/38_6.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185114-qmg8h", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185114-gclt8", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185114-xvvwv", label="@图片3"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185114-565c8", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "以【图片 1】为首帧" in prompt
    assert "缓缓变形为【图片 2】中的冰淇淋" in prompt
    assert "视频配音为【音频 1】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185114-qmg8h"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185114-gclt8"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185114-xvvwv"}, "role": "reference_image"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185114-565c8"}, "role": "reference_audio"},
    ]


def test_byte_wuxia_sword_duel_extension_template_builds_video_payload() -> None:
    template = get_template("byte-wuxia-sword-duel-extension")
    assert template is not None
    assert template.category == "时序补全"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-timeline-04-02__result01__AVESbx.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151837-zhtzj", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "向后延长【视频 1】" in prompt
    assert "双剑精准相撞" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151837-zhtzj"}, "role": "reference_video"},
    ]


def test_byte_fpv_drone_flight_edit_template_builds_video_payload() -> None:
    template = get_template("byte-fpv-drone-flight-edit")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-edit-03-02__result01__IhllbG.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151818-z58cv", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "平缓滑行的普通无人机运镜" in prompt
    assert "FPV 穿越机竞技视角" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151818-z58cv"}, "role": "reference_video"},
    ]


def test_byte_female_anchor_opening_template_builds_image_audio_payload() -> None:
    template = get_template("byte-female-anchor-opening")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/15_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-s5nfl", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-jw64c", label="@图片1"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185116-l8q68", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "女主播" in prompt
    assert "台词为【音频 1】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-s5nfl"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-jw64c"}, "role": "reference_image"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185116-l8q68"}, "role": "reference_audio"},
    ]


def test_byte_new_year_one_take_extension_template_builds_video_audio_payload() -> None:
    template = get_template("byte-new-year-one-take-extension")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["生活方式", "国风艺术", "时序补全", "运镜特效"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/48_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185115-kdtp2", label="@视频1"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185115-p2cdz", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "10秒一镜到底运镜" in prompt
    assert "新春快乐，阖家幸福，马年吉祥" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185115-kdtp2"}, "role": "reference_video"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185115-p2cdz"}, "role": "reference_audio"},
    ]


def test_byte_gallery_painting_transition_template_builds_three_video_payload() -> None:
    template = get_template("byte-gallery-painting-transition")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["国风艺术", "微电影", "时序补全", "运镜特效"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/23_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-krtsr", label="@视频1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-rbfz9", label="@视频2"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-4z4wc", label="@视频3"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "拱形窗户打开" in prompt
    assert "镜头进入画内" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-krtsr"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-rbfz9"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-4z4wc"}, "role": "reference_video"},
    ]


def test_byte_clay_pancake_style_edit_template_builds_video_payload() -> None:
    template = get_template("byte-clay-pancake-style-edit")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.theme_categories == ["3D动漫", "生活方式", "食品饮品", "视频修复"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-edit-01-04__result01__XpIhbd.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151817-q5fnw", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "摊煎饼" in prompt
    assert "3D 粘土动画风格" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151817-q5fnw"}, "role": "reference_video"},
    ]


def test_byte_camera_crew_removal_audio_replace_template_builds_video_audio_payload() -> None:
    template = get_template("byte-camera-crew-removal-audio-replace")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.theme_categories == ["视频修复", "生活方式", "运镜特效"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/45_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185115-x9qsd", label="@视频1"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185115-zsdrw", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "摄像穿帮" in prompt
    assert "背景音替换成【音频 1】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185115-x9qsd"}, "role": "reference_video"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185115-zsdrw"}, "role": "reference_audio"},
    ]


def test_byte_story_prequel_extension_template_builds_video_payload() -> None:
    template = get_template("byte-story-prequel-extension")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["微电影", "情绪叙事", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/19_2.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-x4qh7", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "前半部分故事情节" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-x4qh7"}, "role": "reference_video"},
    ]


def test_byte_reference_music_mv_template_builds_image_audio_payload() -> None:
    template = get_template("byte-reference-music-mv")
    assert template is not None
    assert template.category == "参考生成"
    assert template.theme_categories == ["商业广告", "3D动漫", "情绪叙事"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/14_3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-67fq6", label="@图片1"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185116-4kqfg", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "画面画风" in prompt
    assert "音乐MV" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-67fq6"}, "role": "reference_image"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185116-4kqfg"}, "role": "reference_audio"},
    ]


def test_byte_passerby_removal_edit_template_builds_video_payload() -> None:
    template = get_template("byte-passerby-removal-edit")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.theme_categories == ["商业广告", "生活方式", "运镜特效"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/edit/43_3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185115-55dm2", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "走过去的路人" in prompt
    assert "视频运镜等不改变" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185115-55dm2"}, "role": "reference_video"},
    ]


def test_byte_hutong_rooftop_parkour_prequel_template_builds_video_payload() -> None:
    template = get_template("byte-hutong-rooftop-parkour-prequel")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["微电影", "动作打斗", "运镜特效", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-timeline-05-03__result01__CjLWbO.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151837-bqf26", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "胡同灰瓦屋面跑酷" in prompt
    assert "最终跳下屋顶接【视频 1】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151837-bqf26"}, "role": "reference_video"},
    ]


def test_byte_apocalyptic_overgrown_city_edit_template_builds_image_video_payload() -> None:
    template = get_template("byte-apocalyptic-overgrown-city-edit")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.theme_categories == ["商业广告", "微电影", "自然纪实", "运镜特效"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-edit-02-01__result01__PRDdbZ.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260408151817-rg4k4", label="@图片1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151817-9cvxf", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "末世废墟" in prompt
    assert "长满绿植效果" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260408151817-rg4k4"}, "role": "reference_image"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151817-9cvxf"}, "role": "reference_video"},
    ]


def test_byte_guofeng_lantern_papercut_horse_transition_template_builds_three_video_payload() -> None:
    template = get_template("byte-guofeng-lantern-papercut-horse-transition")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["国风艺术", "商业广告", "运镜特效", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/cn_2_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-7mdq6", label="@视频1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-9frtz", label="@视频2"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-gwv25", label="@视频3"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "轻柔国风纯音" in prompt
    assert "渐变融合转场" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-7mdq6"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-9frtz"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-gwv25"}, "role": "reference_video"},
    ]


def test_byte_japanese_dialogue_story_extension_template_builds_video_payload() -> None:
    template = get_template("byte-japanese-dialogue-story-extension")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["微电影", "3D动漫", "情绪叙事", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/24_2.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-vm7nm", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "后续发生的故事" in prompt
    assert "人物应该讲日语" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-vm7nm"}, "role": "reference_video"},
    ]


def test_byte_child_dinosaur_drawing_process_template_builds_two_video_payload() -> None:
    template = get_template("byte-child-dinosaur-drawing-process")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["生活方式", "3D动漫", "情绪叙事", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/25_3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-26jbl", label="@视频1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-75gmc", label="@视频2"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "小孩子画恐龙" in prompt
    assert "可以有分镜" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-26jbl"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-75gmc"}, "role": "reference_video"},
    ]


def test_byte_outdoor_hiking_shoe_ad_template_builds_three_image_payload() -> None:
    template = get_template("byte-outdoor-hiking-shoe-ad")
    assert template is not None
    assert template.category == "参考生成"
    assert template.theme_categories == ["商业广告", "产品展示", "生活方式", "自然纪实"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/4_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-zvjlj", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-b4gw8", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185116-lff7w", label="@图片3"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "电影感户外徒步广告片" in prompt
    assert "Step Beyond Limits" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-zvjlj"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-b4gw8"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185116-lff7w"}, "role": "reference_image"},
    ]


def test_byte_captain_robot_handdrawn_replace_template_builds_image_video_payload() -> None:
    template = get_template("byte-captain-robot-handdrawn-replace")
    assert template is not None
    assert template.category == "视频编辑"
    assert template.theme_categories == ["人物替换", "3D动漫", "微电影", "商业广告"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/media/"
        "tpl-doc-20260408150656-edit-01-02__result01__KRr3b3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260408151818-7gw6k", label="@图片1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260408151818-lqqdf", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "船长替换成" in prompt
    assert "2D手绘逐帧质感" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260408151818-7gw6k"}, "role": "reference_image"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260408151818-lqqdf"}, "role": "reference_video"},
    ]


def test_byte_dark_cyber_sci_fi_prequel_template_builds_video_payload() -> None:
    template = get_template("byte-dark-cyber-sci-fi-prequel")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["3D动漫", "动作打斗", "微电影", "运镜特效", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/53_3.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185115-f9nfx", label="@视频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "暗黑赛博科幻" in prompt
    assert "最后接【视频 1】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185115-f9nfx"}, "role": "reference_video"},
    ]


def test_byte_orange_cat_new_year_timeline_template_builds_three_video_payload() -> None:
    template = get_template("byte-orange-cat-new-year-timeline")
    assert template is not None
    assert template.category == "时序补全"
    assert template.theme_categories == ["生活方式", "国风艺术", "情绪叙事", "时序补全"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/timeline/cn_1_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-c2r4r", label="@视频1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-l27sd", label="@视频2"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185117-cvbp2", label="@视频3"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "奶萌小橘猫" in prompt
    assert "森系秘境→年味古镇→暖居新年" in prompt
    assert "接【视频 3】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-c2r4r"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-l27sd"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185117-cvbp2"}, "role": "reference_video"},
    ]


def test_byte_ceo_rain_romance_reference_template_builds_images_audio_payload() -> None:
    template = get_template("byte-ceo-rain-romance-reference")
    assert template is not None
    assert template.category == "参考生成"
    assert template.theme_categories == ["微电影", "情绪叙事", "商业广告", "参考生成"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/37_8.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-hnjhb", label="@图片1"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-8gghm", label="@图片2"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-cjkwr", label="@图片3"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-pxbk9", label="@图片4"),
            AdMaterialInputAsset(type="image", role="reference_image", url="asset://asset-20260224185115-2c698", label="@图片5"),
            AdMaterialInputAsset(type="audio", role="reference_audio", url="asset://asset-20260224185115-dp9qm", label="@音频1"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "清新奶油画风短剧" in prompt
    assert "我们一起走吧" in prompt
    assert "NEW EP DAILY" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-hnjhb"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-8gghm"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-cjkwr"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-pxbk9"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260224185115-2c698"}, "role": "reference_image"},
        {"type": "audio_url", "audio_url": {"url": "asset://asset-20260224185115-dp9qm"}, "role": "reference_audio"},
    ]


def test_byte_ancient_architecture_skywell_reference_template_builds_two_video_payload() -> None:
    template = get_template("byte-ancient-architecture-skywell-reference")
    assert template is not None
    assert template.category == "参考生成"
    assert template.theme_categories == ["国风艺术", "微电影", "运镜特效", "参考生成"]
    assert template.preview_video_url == (
        "https://ark-common-storage-prod-cn-beijing.tos-cn-beijing.volces.com/"
        "presets/experience/gen_video/templates/reference/reference/34_4.mp4"
    )

    body = CreateAdMaterialTaskRequest(
        mode="template",
        template_id=template.id,
        assets=[
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185114-hj8nr", label="@视频1"),
            AdMaterialInputAsset(type="video", role="reference_video", url="asset://asset-20260224185114-99dxs", label="@视频2"),
        ],
        ratio=template.default_ratio,
        duration=template.default_duration,
        generate_audio=template.default_generate_audio,
        watermark=False,
        model="doubao-seedance-2-0-260128",
    )

    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)

    assert "旋转运镜" in prompt
    assert "八角形木质穹顶" in prompt
    assert "参考【视频 2】" in prompt
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["ratio"] == "16:9"
    assert payload["duration"] == 11
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    assert payload["content"] == [
        {"type": "text", "text": prompt},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185114-hj8nr"}, "role": "reference_video"},
        {"type": "video_url", "video_url": {"url": "asset://asset-20260224185114-99dxs"}, "role": "reference_video"},
    ]
