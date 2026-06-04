from __future__ import annotations

import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..short_drama.exceptions import ShortDramaVideoProviderError
from ..short_drama.providers.seedance_video_client import (
    SeedanceVideoClient,
    effective_seedance_video_model,
    extract_last_frame_url,
    extract_task_error,
    extract_task_status,
    extract_video_url,
)
from ..utils.r2_storage import upload_file
from .models import AdMaterialTask
from .schemas import CreateAdMaterialTaskRequest
from .templates import get_template

logger = logging.getLogger(__name__)

_IMAGE_ROLES = {"reference_image", "first_frame", "last_frame"}


def ad_material_task_to_response(row: AdMaterialTask) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "template_id": row.template_id,
        "mode": row.mode,
        "title": row.title,
        "status": row.status,
        "error_message": row.error_message,
        "provider_task_id": row.provider_task_id,
        "provider_video_url": row.provider_video_url,
        "video_url": row.video_url,
        "last_frame_url": row.last_frame_url,
        "prompt": row.prompt,
        "input_assets": row.input_assets_json or [],
        "parameters": row.parameters_json or {},
        "model": row.model,
        "ratio": row.ratio,
        "resolution": row.resolution,
        "duration": row.duration,
        "generate_audio": row.generate_audio,
        "watermark": row.watermark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _replace_vars(template: str, values: dict[str, str]) -> str:
    out = template
    for key, value in values.items():
        out = out.replace("{{" + key + "}}", value)
    return out


def build_prompt(body: CreateAdMaterialTaskRequest) -> str:
    raw_prompt = (body.prompt_text or "").strip()
    if body.mode == "product_video" and raw_prompt:
        return raw_prompt
    if body.template_id == "byte-camera-renewal":
        return raw_prompt or (
            "以【视频 1】中的相机为参考，复制相同的外观设计、尺寸比例、颜色和材质，"
            "生成一个一模一样但全新的相机。机身干净光滑，没有任何划痕、磨损或使用痕迹。"
            "除机身变新外，不改变镜头位置、构图、光线、背景和拍摄角度。"
        )
    if body.template_id == "byte-makeup-cut-join":
        return raw_prompt or "【视频 1】中的人物化妆，涂粉底、修容、眼影、裸色口红几个步骤快速切镜头，接【视频 2】"
    if body.template_id == "byte-gift-cream-replace":
        return raw_prompt or "将【视频 1】礼盒中的香水替换成【图片 1】中的面霜，运镜不变"
    if body.template_id == "byte-dogfood-package-replace":
        return raw_prompt or (
            "将【视频 1】中所有出现的狗粮包装袋统一替换为【图片 1】中的新包装样式。"
            "自动识别并跟踪视频内每一帧中的所有狗粮袋（包括前景、中景、远景、不同角度、运动状态、遮挡状态），"
            "对其进行完整替换。新包装需严格匹配原始位置、大小、透视角度、光影方向、运动轨迹与遮挡关系，"
            "实现自然贴合与真实融合。仅替换包装外观（图案/颜色/品牌/造型），"
            "保持原有动作、人物、环境、镜头运动、节奏与其他所有元素完全不变。"
            "禁止改变背景、构图、光线、景深、摄像机运动或新增/删除物体。"
            "整体效果真实自然、无穿帮、无漂移、无闪烁、无风格变化。"
        )
    if body.template_id == "byte-house-blue-snow-edit":
        return raw_prompt or "将【视频 1】中的房子外立面墙壁刷成蓝色，天气和光线参考【图片 1】的雪天"
    if body.template_id == "byte-perfume-light-sweep":
        return raw_prompt or "保持【视频 1】香水主体不变，氛围感不变，产品级光线，将光线运动修改为，从左到右扫光，丁达尔效应"
    if body.template_id == "byte-apple-tea-fpv-ad":
        return raw_prompt or (
            "全程使用【视频 1】的第一视角构图，全程使用【音频 1】作为背景音乐。"
            "第一人称视角果茶宣传广告，seedance牌「苹苹安安」苹果果茶限定款；"
            "首帧为【图片 1】，你的手摘下一颗带晨露的阿克苏红苹果，轻脆的苹果碰撞声；"
            "2-4 秒：快速切镜，你的手将苹果块投入雪克杯，加入冰块与茶底，用力摇晃，"
            "冰块碰撞声与摇晃声卡点轻快鼓点，背景音：「鲜切现摇」；"
            "4-6 秒：第一人称成品特写，分层果茶倒入透明杯，你的手轻挤奶盖在顶部铺展，"
            "在杯身贴上粉红包标，镜头拉近看奶盖与果茶的分层纹理；"
            "6-8 秒：第一人称手持举杯，你将【图片 2】中的果茶举到镜头前（模拟递到观众面前的视角），"
            "杯身标签清晰可见，背景音「来一口鲜爽」，尾帧定格为【图片 2】。背景声音统一为女生音色。"
        )
    if body.template_id == "byte-glasses-model-replace":
        return raw_prompt or "将眼镜电商带货【视频 1】中的模特换成欧美人，参考【图片 1】，语言改成英语，人物动作和运镜不变"
    if body.template_id == "byte-anime-fireworks-color-fix":
        return raw_prompt or "【视频 1】是一段日本花火大会的动漫片段，帮我修复视频的色彩"
    if body.template_id == "byte-pixel-fight-reference":
        return raw_prompt or "参考【视频 1】的人物动作和镜头语言，生成【图片 1】和【图片 2】的打斗场面，打斗背景是【图片 3】，打斗的过程模仿《魂斗罗》像素游戏，背景音乐是【音频 1】中的音乐，随着打斗动作还有打斗音效。"
    if body.template_id == "byte-lion-bullet-time-extend":
        return raw_prompt or "续写【视频 1】，狮子突然加速冲刺、压低身体蓄力起跳，猛然跃向空中扑向羚羊。在狮子腾空瞬间进入子弹时间（bullet time slow motion），时间几乎静止：尘土颗粒悬浮在空气中，鬃毛与四肢定格展开。镜头360度环绕狮子与羚羊一圈，从侧面到正面再到背面，展示力量与张力的动态雕塑感。随后时间恢复正常速度，动物继续向前奔跑，镜头拉远至超大全景，草原再次恢复宁静辽阔。"
    if body.template_id == "byte-woodcut-horse-motion":
        return raw_prompt or "参考【图片 1】的版画风格，镜头从 “马上有福” 藏书票的局部细节开始，随后缓缓向后拉远，完整展现黑白木刻风格的骏马。随着镜头拉开，骏马开始流畅地迈步前行，鬃毛与鞍鞯随之轻微摆动，背景的牡丹花纹随画面放大而逐渐清晰。整个过程保持着版画的高对比度黑白块面与密集排线肌理，营造出传统艺术在动态中复活的视觉体验。0-2秒：特写，聚焦木刻版画中骏马的眼睛与鬃毛细节，黑白高对比，密集排线纹理清晰可见。2-5秒：拉镜头，从局部逐渐拉远，完整展现骏马的头部与牡丹花，线条硬朗，块面分明。5-8秒：继续拉远，露出整匹骏马与波浪形边框，骏马开始缓慢迈步，四肢呈现交替运动的流畅动画，鬃毛与鞍鞯随步伐轻微摆动。拉到全景，完整显示 “马上有福” 字样，骏马持续行走，背景的平行排线随镜头移动产生轻微的视差效果，画面渐暗结束。整体参考【视频 1】的拉镜头运镜，画面中除了“马上有福”四字无其他文字。"
    if body.template_id == "byte-runway-clothes-replace":
        return raw_prompt or "将【视频 1】中模特走秀穿着的衣服换成【图片 1】中的衣服"
    if body.template_id == "byte-revenge-chess-anime":
        return raw_prompt or "8秒智性博弈式战斗动漫片段，贴合复仇主题。0-3秒：【图片 1】中女主转身坐下，转镜头，女主下了一步棋子，并说“你输了”，参考【图片 2】的分镜画面，女主声音参考【音频 1】中的御姐音色，背景参考【图片 3】。3-4秒：快速摇镜头，转向对面特写【图片 4】中的男人面部，男人说：“怎么会！”，参考【图片 5】的分镜画面，男人咬牙切齿，对结果很不满。4-6秒：切镜头，俯拍，女人下了一步棋，对面的人们惊叹，参考【图片 6】的分镜画面。6-8秒：镜头迅速向下摇，画面黑屏转场，后画面渐亮，昏暗室内，女人看着窗外月色静静地说“我们走着瞧”，参考【图片 7】的分镜画面。"
    if body.template_id == "byte-caterpillar-cocoon-prequel":
        return raw_prompt or "结合【视频 1】，补全视频前置镜头，毛毛虫变成蝶蛹，画面风格保持一致"
    if body.template_id == "byte-window-spring-extension":
        return raw_prompt or "向后延长【视频 1】:窗外景色丝滑变为春天，阳光明媚，画面变为暖色调，特写女生面部惊讶表情。"
    if body.template_id == "byte-kdrama-restaurant-noodle":
        return raw_prompt or "韩剧生活氛围感短片，温馨自然、轻松甜感、真实日常风格。场景设定在温暖小餐馆内，暖黄色灯光，木质桌椅，窗外傍晚柔光洒入，人群轻微虚化，环境有生活气息与烟火感。镜头1：中远景慢推镜头，餐馆整体环境，人声与碗筷声作为环境音。【图片 1】女生与【图片 2】男生面对面坐在桌旁，气氛轻松。镜头2：桌面对拍中景，两人聊天微笑。热气腾腾的面碗在前景，画面浅景深，背景柔焦。镜头3：近景特写女生低头吃面，动作参考【视频 1】，突然狼吞虎咽大口吸面，脸颊鼓鼓，真实可爱。镜头4：面条晃动、汤汁飞溅一点点，嘴角沾到油渍。轻微慢动作，增加喜剧感。镜头5：半身特写，女生抬头发现男生在看她，愣住，害羞微笑，眼神闪躲。镜头6：男生温柔靠近，轻轻用纸巾替她擦嘴，动作自然细腻，说：“천천히 먹어. 아무도 안 뺏어.”。镜头7：两人对视微笑，气氛安静甜蜜。镜头缓慢拉远，餐馆灯光温暖包围，画面淡出。整体风格：韩剧剧照质感、自然手持跟拍、柔光滤镜、浅景深、暖色调、真实生活感、轻微慢动作、情绪细腻、电影级构图、4K高细节。"
    if body.template_id == "byte-fpv-apple-pie-baking":
        return raw_prompt or "第一视角厨房烘焙 vlog，轻微广角，沉浸式手持感，全程不出现人脸，只看到双手与手臂，视角参考【图片 1】。镜头1：俯视视角，双手在厨房岛台翻开菜谱书，书页内容为【图片 2】，晨光洒入，轻微晃动记录感。镜头2：镜头垂直向下，双手在撒面粉的台面揉面、按压、折叠，面粉飞散，近景质感细节。镜头3：双手将准备好的生苹果派举到镜头前展示，苹果派参考【图片 3】。镜头4：黑屏字幕倒计时，“200°C 30mins”。镜头5：恢复第一视角，双手端起刚出炉冒热气的苹果派，金黄酥皮，暖光氛围。"
    if body.template_id == "byte-war-elephant-battlefield":
        return raw_prompt or "史诗级电影感战场视频。场景设定在广阔的古代战场沙漠，风格参考【图片 4】，士兵穿着参考【图片 3】。尘土飞扬的风掠过地面，天空阴云翻涌，低角度落日光线洒下，整体氛围厚重而压迫。开场为超远景大全景镜头，缓缓展现整齐列阵的大规模军队。队伍最前方矗立着一头巨大的【图片 2】中的装甲战象，【图片 1】中的女战士端坐在象背之上，神情平静而威严，具有统领全军的气场。镜头从远处缓慢推进（推轨/推进镜头），旗帜随风飘动，尘土在空气中漂浮，士兵轻微移动，营造真实战前氛围。切至中景，女战士目视前方，头发与披风被风吹动，画面沉稳有力量。低机位仰拍战象迈步向前，脚步落地震起沙尘，地面微微震动，气势磅礴。最后切到高空航拍大全景，镜头拉远，整支军队在沙漠战场上绵延铺展开来，规模宏大震撼。"
    if body.template_id == "byte-flower-arrangement-timeline":
        return raw_prompt or "从【视频 1】到【视频 2】，生成这个女孩插花过程的视频"
    if body.template_id == "byte-orange-cat-new-year-timeline":
        return raw_prompt or "核心要求：15 秒电影质感短视频，分 3 个核心场景无缝叙事衔接，以一只奶萌小橘猫全程跑动为视觉主线，从森系秘境→年味古镇→暖居新年，最终跃入小朋友怀中，整体采用电影级运镜 + 光影叙事，色调由冷渐暖层层递进，氛围感拉满，画质 4K/60 帧、HDR 高动态、胶片颗粒感，背景音乐为轻国风管弦乐，节奏贴合镜头动线，无字幕无台词，纯视觉叙事。整体基础设定：主角为一只巴掌大奶橘猫（黄白相间、蓬松短毛、圆眼灵动，跑起来小短腿颠动、尾巴轻扬，毛发纹理清晰有光影质感），全程作为唯一视觉焦点，镜头始终跟拍橘猫（肩背视角 / 侧面跟拍为主），场景转场通过橘猫动线自然衔接，无硬切，整体影调：森林冷调柔光→古镇暖红侧光→屋内暖黄柔光，画面有浅景深电影感，背景虚化突出主体，细节真实有层次。【视频 1】（0-5秒），转场：橘猫跑至森林尽头的青石板路，前爪踏上石板的瞬间，镜头向前推近橘猫爪子，画面光影从冷青渐暖，石板路延伸向远方，自然过渡至【视频 2】（5-10秒）。转场：橘猫跑至古镇巷口朱红木门旁，用脑袋轻蹭铜质门环，镜头特写门环与橘猫脑袋的触碰瞬间，门环轻响，镜头随橘猫推开门的动作向内切，画面瞬间被屋内暖光铺满。接【视频 3】（10-13秒），结尾高光（13-15 秒）：橘猫跑至画面中央的小朋友脚边，镜头慢动作推近，橘猫纵身一跃，小朋友笑着抬手，掌心迎向橘猫，指尖触碰橘猫的瞬间，镜头切至中景特写，小朋友将橘猫抱入怀中，脸颊轻贴橘猫蓬松毛发，橘猫蹭了蹭小朋友下巴，小朋友眉眼带笑，背景家人的模糊身影与暖光形成温馨画框；此时背景音乐轻柔高潮，画面渐暗至暖黄柔光定格，淡淡金色光斑（散景效果）环绕画面，胶片颗粒感轻微加重，氛围感拉满，背景音乐由舒缓变为喜庆。"
    if body.template_id == "byte-ceo-rain-romance-reference":
        return raw_prompt or "清新奶油画风短剧，轻快吉他卡点快切，奶油白主色 + 蜜桃粉高光，画面柔和无特效，靠表情传情。0-2 秒：快切 2 镜「【图片 1】中的霸总不小心撞到穿着【图片 2】的衣服的【图片 3】中的女主（两人错愕对视）+ 霸总扯下自己的西装外套披在女主身上（手部特写）」，背景吉他声起，咖啡杯掉落 / 衣服摩擦的轻柔音效；2-6 秒：快切 3 镜「女主穿霸总外套低头偷笑（脸颊泛红特写）+ 霸总看着女主背影嘴角微扬，说“我们一起走吧”参考【音频 1】（侧颜） + 两人在雨夜共撑一把黑伞，指尖相触快速收回（近景）」，雨天背景为【图片 4】，每镜卡点轻鼓重拍，配雨滴落地 / 伞骨撑开的音效，画面带轻微柔雾质感；6-8 秒：慢放两人对视笑眼，画面右下角出现【图片 5】的文字部分，左下角小字「NEW EP DAILY」，背景飘淡粉色花瓣（极简），BGM 落温柔尾音，画面定格两人同框侧脸。"
    if body.template_id == "byte-ancient-architecture-skywell-reference":
        return raw_prompt or "参考【视频 1】中的旋转运镜，生成从中国古建筑内部向上仰拍的天井。深邃的八角形木质穹顶结构布满了繁复的木雕细节，层叠的梁架与精巧的垂花雕刻在明暗对比中尽显古朴厚重的质感。穹顶中央的开口将澄澈的蓝天与白云框入其中，天空中飞过一群鸟，参考【视频 2】，营造出一种连接天地、静谧悠远的中式美学氛围。"
    if body.template_id == "byte-boy-hug-grandpa-colorize":
        return raw_prompt or "3D动画电影风格叙事短片，温暖夕阳草地或老街广场场景，环境为柔和彩色自然光。【图片 2】中的老人独自站在画面中央，全身黑白灰色（monochrome grayscale），与彩色环境形成强烈对比。远景建立后镜头缓慢推进。【图片 1】中的男孩从画面一侧走入，彩色、有生命力，小心翼翼看向老人轻声说“Papa?”，然后慢慢靠近。随后男孩突然跑过去抱住老人，进入慢动作，拥抱动作参考【视频 1】。两人拥抱时，从接触处开始老人身体颜色从灰色逐渐扩散恢复彩色（smooth warm color transition），从头到脚变回正常色彩。最后两人相拥，中景停顿，男孩眼角含泪说“I missed you so much”，夕阳暖光包围，画面淡出。"
    if body.template_id == "byte-horse-red-envelope-prequel":
        return raw_prompt or "向前延长【视频 1】，8 秒超清马年红包产品展示视频，画面简洁高级，电影级运镜，暖金红国风色调，柔和柔光打光，无杂乱背景；0-2 秒：俯拍慢推，3 款烫金浮雕马年红包整齐摆放在浅米纹纸背景上，红包烫金骏马纹样细腻有光泽，鎏金纹路反光自然；2-5 秒：手持轻晃红包，纸张质感挺括，边角平整，镜头微跟拍，光影随动作渐变，搭配轻微金属碰撞的清脆音效；5-7 秒：特写红包烫金细节，骏马线条流畅，国风祥云纹路环绕，镜头轻聚焦；最后接【视频 1】，背景音乐为【音频 1】。无人物，无多余元素，氛围感拉满，适配电商产品展示"
    if body.template_id == "byte-cloud-ice-cream-cabin":
        return raw_prompt or "以【图片 1】为首帧，画面放大至飞机舷窗外，一团团云朵缓缓飘至画面中，其中一朵为彩色糖豆点缀的云朵，始终在画面中居中，然后缓缓变形为【图片 2】中的冰淇淋，镜头推远回到机舱内，坐在床边的【图片 3】中的角色伸手从窗外拿进冰淇淋，吃了一口，嘴巴上沾满奶油，脸上洋溢出甜蜜的笑容，此时视频配音为【音频 1】"
    if body.template_id == "byte-wuxia-sword-duel-extension":
        return raw_prompt or "向后延长【视频 1】，二人纵身交锋，剑影交错，白衣旋身避招、反手刺击，黑衣横剑格挡、顺势横扫，竹叶/碎尘飞溅，双剑精准相撞，二人对视发力，眉头紧蹙，镜头定格交锋瞬间，张力拉满。"
    if body.template_id == "byte-fpv-drone-flight-edit":
        return raw_prompt or "保持原有的高空俯瞰轨迹，要把 【视频 1】 中平缓滑行的普通无人机运镜转换成带有大幅度侧倾、快速俯冲翻转的 FPV 穿越机竞技视角。"
    if body.template_id == "byte-female-anchor-opening":
        return raw_prompt or "【图片 2】中的女主播在图片【图片 1】的场景中说开场词，台词为【音频 1】"
    if body.template_id == "byte-new-year-one-take-extension":
        return raw_prompt or "延长【视频 1】，10秒一镜到底运镜，全程无剪辑断点，新年喜庆氛围感拉满；开篇【视频 1】画面，自然衔接慢拉镜头匀速穿过厨房门，顺滑过渡到客厅，一对夫妻正在客厅门口贴福字，镜头无缝摇移至贴窗花的客厅窗户处，紧接着慢推镜头从窗户向外穿出，流畅衔接孩子们在室外空地上放烟花的场景；全程运镜丝滑连贯、速度均匀不卡顿，画面融入红灯笼等新年元素，烘托浓厚过年氛围；背景音乐参考【音频 1】，背景语音为：“新春快乐，阖家幸福，马年吉祥”，整体保证一镜到底的视觉连贯性、沉浸感，年味与氛围感双重拉满，人物比例符合现实世界物理规律。"
    if body.template_id == "byte-gallery-painting-transition":
        return raw_prompt or "【视频 1】中的拱形窗户打开，进入美术馆室内，接【视频 2】，之后镜头进入画内，接【视频 3】"
    if body.template_id == "byte-clay-pancake-style-edit":
        return raw_prompt or "彻底改变画面质感，要把视频中 【视频 1】 摊煎饼替换成具有手工捏制纹理、色彩明快的 3D 粘土动画风格。"
    if body.template_id == "byte-camera-crew-removal-audio-replace":
        return raw_prompt or "去除【视频 1】中镜子内和人物旁的摄像穿帮部分，并将【视频 1】中的背景音替换成【音频 1】"
    if body.template_id == "byte-story-prequel-extension":
        return raw_prompt or "生成【视频 1】的前半部分故事情节"
    if body.template_id == "byte-reference-music-mv":
        return raw_prompt or "参考【图片 1】的画面画风，为【音频 1】生成一个音乐MV"
    if body.template_id == "byte-passerby-removal-edit":
        return raw_prompt or "删除【视频 1】镜头前走过去的路人，视频运镜等不改变"
    if body.template_id == "byte-hutong-rooftop-parkour-prequel":
        return raw_prompt or "向前延长【视频 1】:人物在胡同灰瓦屋面跑酷，一镜到底，最终跳下屋顶接【视频 1】"
    if body.template_id == "byte-apocalyptic-overgrown-city-edit":
        return raw_prompt or "复刻的 【视频 1】 全部运镜轨迹、街道路网布局、所有建筑/商铺/公共设施/物体的位置、轮廓、占地面积、镜头高度/角度/焦距，完全不改动原有空间结构，无新增建筑、无删除原有物体、无道路偏移、无任何运镜变化，仅将所有物体的外观状态修改为末世废墟，长满绿植效果"
    if body.template_id == "byte-guofeng-lantern-papercut-horse-transition":
        return raw_prompt or "时长：15s；背景音乐：轻柔国风纯音，古筝 + 琵琶轻奏，节奏随画面递进微扬，无旁白；【视频 1】灯笼光影处渐融，【视频 2】剪纸画面淡入渐变，壁画与剪纸马形轮廓完美重合，接【视频 3】。细节要求：转场：所有元素切换均为渐变融合转场，无切镜，画面衔接丝滑如流水，无卡顿感；动态：所有动态均为慢节奏柔动，无快速画面，契合高级氛围感"
    if body.template_id == "byte-japanese-dialogue-story-extension":
        return raw_prompt or "续写【视频 1】后续发生的故事，如果有台词，人物应该讲日语，下方要有对应的字幕"
    if body.template_id == "byte-child-dinosaur-drawing-process":
        return raw_prompt or "以【视频 1】为开头，【视频 2】为结尾，生成这个小孩子画恐龙的全过程，可以有分镜"
    if body.template_id == "byte-outdoor-hiking-shoe-ad":
        return raw_prompt or "电影感户外徒步广告片。以【图片 1】的群山与空旷山脊为超大全景开场，金色晨雾弥漫，镜头缓慢向前推进。切到【图片 2】中的男人，穿着【图片 3】的登山鞋，大步走在山径上，跟拍镜头随行，风吹动衣物与草丛，自然真实。侧脸特写，浅景深，脸上微微出汗，边缘逆光勾勒轮廓。登山鞋踩入草地与水坑的微距慢动作特写，草叶被压弯，水溅起，镜头轻微环绕展示鞋子多角度细节。最后切到山脊侧面大全景长镜头，人物沿山脊前行，剪影映衬天空。最后画面渐隐黑幕，画面中间出现小字slogan“Step Beyond Limits”"
    if body.template_id == "byte-captain-robot-handdrawn-replace":
        return raw_prompt or "保持原视频中人物说话的节奏和情感，要把 【视频 1】 中的船长替换成 【图片 1】 的机械人，动画风格，2D手绘逐帧质感，水彩+丙烯厚涂结合的柔和笔触，色彩柔和高饱和低对比，空气通透充满呼吸感，阳光穿过空气形成暖金色丁达尔光，可见细微的金粉尘粒/花粉/水汽悬浮，线条柔软无尖锐棱角，所有物体边缘带轻微手绘笔触感，无完美平滑边缘，整体充满温暖治愈的人文气息，细节充满生活化的磨损痕迹，机械/食物/自然均带柔软的温度感"
    if body.template_id == "byte-dark-cyber-sci-fi-prequel":
        return raw_prompt or "向前延长【视频 1】，12秒科幻短片，纯正《爱・死亡与机器人》暗黑赛博科幻风格，粗粝工业质感 + 赛博朋克霓虹撞色，冷调青灰基底 + 猩红 / 电光紫高光，动态镜头高速推拉 + 卡点快切 + 微距特写，重金属电子乐 + 机械轰鸣 / 能量爆破原生音效，无字幕靠画面张力造科幻冲击，3D 建模硬朗棱角 + 细腻纹理，光影明暗强烈对比，融合废土科幻、机械朋克、克苏鲁式未知感，适配科幻动画短片预告 / 科幻内容种草。0-3 秒 开篇悬念・废土科幻基底，高速慢推广角，荒芜星际废土旷野，巨型破损机械战甲残骸斜插焦土，锈迹斑驳的金属表面映着紫蓝色星云，地表裂谷渗着猩红熔岩光，远处悬浮着半毁的环形空间站，重金属电子乐低频起调，搭配战甲金属吱呀的共振声，画面带轻微颗粒感，突出粗粝废土质感。3-7 秒 冲突升级・卡点快切 4 镜（每镜 1 秒）微距特写：机械义眼瞳孔收缩，电光紫光效闪过，金属眼睫齿轮转动，背景是赛博舱体的霓虹管线；高速跟拍：人形生化体从战甲残骸中跃起，流线型机械躯体带蓝色能量流光，脚掌蹬碎焦土，碎石飞溅；俯拍广角：废土地表裂开巨缝，巨型机械触须带着猩红吸盘破土而出，触须金属节段反射霓虹光；怼脸特写：生化体眼部亮起战斗红光，嘴角勾起冷冽弧度，机械手臂弹出锋利能量刃，刃面映出触须逼近的虚影；每镜卡点电子乐重鼓点，叠加机械变形、能量充能的尖锐音效，镜头轻微晃动增强冲击感。7-12 秒 高潮定格・科幻视觉冲击，前 3 秒高速推拉镜头，生化体持能量刃跃起，与机械触须猛烈碰撞，能量爆破炸开青蓝 + 猩红炫光，金属碎片与能量波向镜头飞溅，战甲残骸的金属板被冲击波掀飞；最后接【视频 1】，画面质感：复刻《爱・死亡与机器人》的3D 写实建模 + 手绘质感叠加，金属锈迹、机械纹理、能量光效细腻，粗粝不粗糙，硬核不杂乱；色彩光影：青灰 / 炭黑为基底，猩红、电光紫、电光蓝做撞色高光，明暗对比强烈，无柔光，靠硬光打造工业科幻的冷峻感；镜头节奏：快慢极致反差，高速镜头造冲击，慢放镜头留细节，卡点精准贴合音效，12 秒内完成「悬念 - 冲突 - 高潮」，符合科幻短片的快节奏审美；科幻元素：融合机械战甲、生化体、星际废土、能量武器、巨型机械生物，贴合《爱・死亡与机器人》的多元科幻内核，兼具硬核机械与未知科幻感。"

    product_name = (body.product_name or "商品").strip()
    selling_points = (body.selling_points or "突出商品质感、核心卖点和使用场景").strip()
    channel = (body.channel or "电商投流").strip()
    style = (body.style or "").strip()
    edit_instruction = (body.edit_instruction or "").strip()
    tpl = get_template(body.template_id)

    values = {
        "product_name": product_name,
        "selling_points": selling_points,
        "channel": channel,
        "style": style or "清晰、自然、有质感",
        "edit_instruction": edit_instruction,
    }

    if body.mode == "video_edit" or body.template_id == "product-replace-edit":
        base = (
            "严格编辑视频1，将视频1中的原商品替换成图片1中的商品“{{product_name}}”，"
            "动作、人物、环境、光线和运镜保持不变。{{edit_instruction}} "
            "整体画面真实自然，商品细节清晰，避免生成无关文字、Logo、水印和字幕。"
        )
        return _replace_vars(base, values)

    if body.template_id == "viral-ad-cuts":
        base = (
            "参考图片1中的商品“{{product_name}}”，生成一条适合{{channel}}的电商投流短视频。"
            "镜头1：商品在干净明亮的场景中快速出现，镜头平稳推近，突出第一眼吸引力。"
            "镜头2：快速切换商品细节，突出卖点：{{selling_points}}。"
            "镜头3：商品被自然拿起或摆放到使用场景中，画面节奏轻快。"
            "镜头4：商品居中定格，画面中部出现简洁卖点文字，文字内容使用常用字。"
            "整体风格{{style}}，画面高清，动作连贯，避免无关Logo、水印和乱码字幕。"
        )
        return _replace_vars(base, values)

    if body.template_id == "virtual-host-demo":
        base = (
            "图片1中的虚拟达人在明亮自然的室内场景中，向镜头介绍图片2中的商品“{{product_name}}”。"
            "达人面带自然笑容，先展示商品包装，再展示商品细节，并用亲切自然的语气介绍："
            "“{{selling_points}}”。人物居中，完整展示头部和上半身，商品始终清晰可见。"
            "整体风格{{style}}，画面无字幕，避免无关Logo和水印。"
        )
        return _replace_vars(base, values)

    if tpl:
        base = (
            "参考图片1中的商品“{{product_name}}”，生成一条适合{{channel}}的商品展示视频。"
            "镜头1：商品置于干净明亮的场景中，镜头缓慢推近，突出整体外观。"
            "镜头2：切换到商品细节近景，展示材质、包装和核心质感。"
            "镜头3：围绕卖点“{{selling_points}}”进行视觉表达，画面简洁高级。"
            "镜头4：商品居中定格，形成适合主图视频的结束画面。"
            "整体风格{{style}}，高清、自然、无多余杂物，避免生成无关文字、Logo、水印和字幕。"
        )
        return _replace_vars(base, values)

    base = (
        "参考图片1中的商品“{{product_name}}”，生成一条电商商品短视频。"
        "突出卖点：{{selling_points}}。适合{{channel}}，整体风格{{style}}，"
        "镜头运动平稳，商品细节清晰，避免无关Logo、水印和字幕。"
    )
    return _replace_vars(base, values)


def build_seedance_payload(body: CreateAdMaterialTaskRequest, prompt: str) -> dict[str, Any]:
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for asset in body.assets:
        url = (asset.url or "").strip()
        if not url:
            continue
        if asset.type in {"image", "avatar"} or asset.role in _IMAGE_ROLES:
            content.append({"type": "image_url", "image_url": {"url": url}, "role": asset.role})
        elif asset.type == "video":
            content.append({"type": "video_url", "video_url": {"url": url}, "role": "reference_video"})
        elif asset.type == "audio":
            content.append({"type": "audio_url", "audio_url": {"url": url}, "role": "reference_audio"})

    model = (body.model or "").strip() or effective_seedance_video_model()
    payload: dict[str, Any] = {
        "model": model,
        "content": content,
        "generate_audio": bool(body.generate_audio),
        "ratio": (body.ratio or "9:16").strip(),
        "duration": int(body.duration),
        "watermark": bool(body.watermark),
        "resolution": (body.resolution or "720p").strip(),
        "return_last_frame": bool(body.return_last_frame),
    }
    return payload


def _download_to_temp(url: str, suffix: str) -> Path:
    timeout = httpx.Timeout(connect=20.0, read=240.0, write=30.0, pool=10.0)
    fd, tmp_name = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    path = Path(tmp_name)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url)
        if resp.status_code >= 400:
            raise ShortDramaVideoProviderError(f"download HTTP {resp.status_code}: {url}")
        path.write_bytes(resp.content)
        return path
    except Exception:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def _upload_remote_to_r2(*, url: str, key: str, suffix: str) -> str:
    tmp = _download_to_temp(url, suffix)
    try:
        return upload_file(str(tmp.resolve()), key)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def upload_ad_material_file(*, local_path: str, user_id: int | None, file_name: str, asset_type: str) -> tuple[str, str]:
    safe_user = str(user_id or "anonymous")
    ext = Path(file_name or "").suffix.lower()
    if not ext:
        ext = ".mp4" if asset_type == "video" else ".mp3" if asset_type == "audio" else ".png"
    key = f"ad-materials/uploads/{safe_user}/{uuid4().hex}{ext}"
    return upload_file(local_path, key), key


def create_task_record(db: Session, *, body: CreateAdMaterialTaskRequest, user_id: int | None) -> AdMaterialTask:
    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)
    title = (body.title or body.product_name or "投流素材").strip()
    template = get_template(body.template_id)
    row = AdMaterialTask(
        user_id=user_id,
        template_id=body.template_id or "",
        mode=body.mode,
        title=title,
        status="queued",
        prompt=prompt,
        request_json=payload,
        input_assets_json=[asset.model_dump() for asset in body.assets],
        parameters_json={
            "prompt_text": body.prompt_text,
            "channel": body.channel,
            "product_name": body.product_name,
            "selling_points": body.selling_points,
            "style": body.style,
            "return_last_frame": body.return_last_frame,
            "template_name": template.name if template else "",
        },
        model=str(payload.get("model") or ""),
        ratio=str(payload.get("ratio") or "9:16"),
        resolution=str(payload.get("resolution") or "720p"),
        duration=int(payload.get("duration") or 8),
        generate_audio=bool(payload.get("generate_audio")),
        watermark=bool(payload.get("watermark")),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def run_ad_material_task(task_id: int) -> None:
    db = SessionLocal()
    client = SeedanceVideoClient()
    try:
        row = db.get(AdMaterialTask, task_id)
        if row is None:
            return
        row.status = "running"
        row.error_message = ""
        db.commit()
        payload = dict(row.request_json or {})
        provider_task_id = client.create_generation_task(
            payload=payload,
            log_context={"task_id": row.id, "user_id": row.user_id, "mode": row.mode},
        )
        row.provider_task_id = provider_task_id
        db.commit()

        deadline = time.monotonic() + float(settings.SEEDANCE_TASK_TIMEOUT_SECONDS)
        interval = max(1.0, float(settings.SEEDANCE_TASK_POLL_INTERVAL_SECONDS))
        final: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            data = client.get_video_task(task_id=provider_task_id)
            status = extract_task_status(data)
            row.response_json = data
            db.add(row)
            db.commit()
            if status in {"succeeded", "success", "completed"}:
                final = data
                break
            if status in {"failed", "cancelled", "expired", "error"}:
                row.status = "failed" if status != "expired" else "expired"
                row.error_message = extract_task_error(data) or status
                db.commit()
                return
            time.sleep(interval)

        if final is None:
            row.status = "expired"
            row.error_message = "Seedance task polling timed out"
            db.commit()
            return

        video_url = extract_video_url(final)
        if not video_url:
            row.status = "failed"
            row.error_message = "Seedance task succeeded but video_url is missing"
            db.commit()
            return

        safe_user = str(row.user_id or "anonymous")
        video_key = f"ad-materials/videos/{safe_user}/{row.id}/result.mp4"
        final_video_url = _upload_remote_to_r2(url=video_url, key=video_key, suffix=".mp4")
        row.provider_video_url = video_url
        row.video_url = final_video_url
        row.video_storage_key = video_key

        last_frame = extract_last_frame_url(final)
        if last_frame:
            frame_key = f"ad-materials/images/{safe_user}/{row.id}/last_frame.png"
            try:
                row.last_frame_url = _upload_remote_to_r2(url=last_frame, key=frame_key, suffix=".png")
                row.last_frame_storage_key = frame_key
            except Exception as e:
                logger.exception("[AD_MATERIAL_LAST_FRAME_UPLOAD_FAILED] task_id=%s err=%s", row.id, e)

        row.status = "succeeded"
        row.error_message = ""
        db.commit()
    except Exception as e:
        logger.exception("[AD_MATERIAL_TASK_FAILED] task_id=%s", task_id)
        row = db.get(AdMaterialTask, task_id)
        if row is not None:
            row.status = "failed"
            row.error_message = str(e)[:2000]
            db.commit()
    finally:
        db.close()
