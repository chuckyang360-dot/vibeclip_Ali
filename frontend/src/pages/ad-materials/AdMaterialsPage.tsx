import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';
import { createFreeCreationProject, type FreeCreationInputAsset } from '../../services/freeCreationApi';
import { listAdMaterialTemplates, type AdMaterialTemplate } from '../../services/adMaterialsApi';

const byteCameraTemplatePrompt =
  '以【视频 1】中的相机为参考，复制相同的外观设计、尺寸比例、颜色和材质，生成一个一模一样但全新的相机。机身干净光滑，没有任何划痕、磨损或使用痕迹。除机身变新外，不改变镜头位置、构图、光线、背景和拍摄角度。';

const byteMakeupCutJoinPrompt =
  '【视频 1】中的人物化妆，涂粉底、修容、眼影、裸色口红几个步骤快速切镜头，接【视频 2】';

const byteGiftCreamReplacePrompt =
  '将【视频 1】礼盒中的香水替换成【图片 1】中的面霜，运镜不变';

const byteDogfoodPackageReplacePrompt =
  '将【视频 1】中所有出现的狗粮包装袋统一替换为【图片 1】中的新包装样式。自动识别并跟踪视频内每一帧中的所有狗粮袋（包括前景、中景、远景、不同角度、运动状态、遮挡状态），对其进行完整替换。新包装需严格匹配原始位置、大小、透视角度、光影方向、运动轨迹与遮挡关系，实现自然贴合与真实融合。仅替换包装外观（图案/颜色/品牌/造型），保持原有动作、人物、环境、镜头运动、节奏与其他所有元素完全不变。禁止改变背景、构图、光线、景深、摄像机运动或新增/删除物体。整体效果真实自然、无穿帮、无漂移、无闪烁、无风格变化。';

const bytePerfumeLightSweepPrompt =
  '保持【视频 1】香水主体不变，氛围感不变，产品级光线，将光线运动修改为，从左到右扫光，丁达尔效应';

const byteAppleTeaFpvAdPrompt =
  '全程使用【视频 1】的第一视角构图，全程使用【音频 1】作为背景音乐。第一人称视角果茶宣传广告，seedance牌「苹苹安安」苹果果茶限定款；首帧为【图片 1】，你的手摘下一颗带晨露的阿克苏红苹果，轻脆的苹果碰撞声；2-4 秒：快速切镜，你的手将苹果块投入雪克杯，加入冰块与茶底，用力摇晃，冰块碰撞声与摇晃声卡点轻快鼓点，背景音：「鲜切现摇」；4-6 秒：第一人称成品特写，分层果茶倒入透明杯，你的手轻挤奶盖在顶部铺展，在杯身贴上粉红包标，镜头拉近看奶盖与果茶的分层纹理；6-8 秒：第一人称手持举杯，你将【图片 2】中的果茶举到镜头前（模拟递到观众面前的视角），杯身标签清晰可见，背景音「来一口鲜爽」，尾帧定格为【图片 2】。背景声音统一为女生音色。';

const byteGlassesModelReplacePrompt =
  '将眼镜电商带货【视频 1】中的模特换成欧美人，参考【图片 1】，语言改成英语，人物动作和运镜不变';

const byteAnimeFireworksColorFixPrompt =
  '【视频 1】是一段日本花火大会的动漫片段，帮我修复视频的色彩';

const bytePixelFightReferencePrompt =
  '参考【视频 1】的人物动作和镜头语言，生成【图片 1】和【图片 2】的打斗场面，打斗背景是【图片 3】，打斗的过程模仿《魂斗罗》像素游戏，背景音乐是【音频 1】中的音乐，随着打斗动作还有打斗音效。';

const byteLionBulletTimeExtendPrompt =
  '续写【视频 1】，狮子突然加速冲刺、压低身体蓄力起跳，猛然跃向空中扑向羚羊。在狮子腾空瞬间进入子弹时间（bullet time slow motion），时间几乎静止：尘土颗粒悬浮在空气中，鬃毛与四肢定格展开。镜头360度环绕狮子与羚羊一圈，从侧面到正面再到背面，展示力量与张力的动态雕塑感。随后时间恢复正常速度，动物继续向前奔跑，镜头拉远至超大全景，草原再次恢复宁静辽阔。';

const byteWoodcutHorseMotionPrompt =
  '参考【图片 1】的版画风格，镜头从 “马上有福” 藏书票的局部细节开始，随后缓缓向后拉远，完整展现黑白木刻风格的骏马。随着镜头拉开，骏马开始流畅地迈步前行，鬃毛与鞍鞯随之轻微摆动，背景的牡丹花纹随画面放大而逐渐清晰。整个过程保持着版画的高对比度黑白块面与密集排线肌理，营造出传统艺术在动态中复活的视觉体验。0-2秒：特写，聚焦木刻版画中骏马的眼睛与鬃毛细节，黑白高对比，密集排线纹理清晰可见。2-5秒：拉镜头，从局部逐渐拉远，完整展现骏马的头部与牡丹花，线条硬朗，块面分明。5-8秒：继续拉远，露出整匹骏马与波浪形边框，骏马开始缓慢迈步，四肢呈现交替运动的流畅动画，鬃毛与鞍鞯随步伐轻微摆动。拉到全景，完整显示 “马上有福” 字样，骏马持续行走，背景的平行排线随镜头移动产生轻微的视差效果，画面渐暗结束。整体参考【视频 1】的拉镜头运镜，画面中除了“马上有福”四字无其他文字。';

const byteRunwayClothesReplacePrompt =
  '将【视频 1】中模特走秀穿着的衣服换成【图片 1】中的衣服';

const byteRevengeChessAnimePrompt =
  '8秒智性博弈式战斗动漫片段，贴合复仇主题。0-3秒：【图片 1】中女主转身坐下，转镜头，女主下了一步棋子，并说“你输了”，参考【图片 2】的分镜画面，女主声音参考【音频 1】中的御姐音色，背景参考【图片 3】。3-4秒：快速摇镜头，转向对面特写【图片 4】中的男人面部，男人说：“怎么会！”，参考【图片 5】的分镜画面，男人咬牙切齿，对结果很不满。4-6秒：切镜头，俯拍，女人下了一步棋，对面的人们惊叹，参考【图片 6】的分镜画面。6-8秒：镜头迅速向下摇，画面黑屏转场，后画面渐亮，昏暗室内，女人看着窗外月色静静地说“我们走着瞧”，参考【图片 7】的分镜画面。';

const byteCaterpillarCocoonPrequelPrompt =
  '结合【视频 1】，补全视频前置镜头，毛毛虫变成蝶蛹，画面风格保持一致';

const byteWindowSpringExtensionPrompt =
  '向后延长【视频 1】:窗外景色丝滑变为春天，阳光明媚，画面变为暖色调，特写女生面部惊讶表情。';

const byteKdramaRestaurantNoodlePrompt =
  '韩剧生活氛围感短片，温馨自然、轻松甜感、真实日常风格。场景设定在温暖小餐馆内，暖黄色灯光，木质桌椅，窗外傍晚柔光洒入，人群轻微虚化，环境有生活气息与烟火感。镜头1：中远景慢推镜头，餐馆整体环境，人声与碗筷声作为环境音。【图片 1】女生与【图片 2】男生面对面坐在桌旁，气氛轻松。镜头2：桌面对拍中景，两人聊天微笑。热气腾腾的面碗在前景，画面浅景深，背景柔焦。镜头3：近景特写女生低头吃面，动作参考【视频 1】，突然狼吞虎咽大口吸面，脸颊鼓鼓，真实可爱。镜头4：面条晃动、汤汁飞溅一点点，嘴角沾到油渍。轻微慢动作，增加喜剧感。镜头5：半身特写，女生抬头发现男生在看她，愣住，害羞微笑，眼神闪躲。镜头6：男生温柔靠近，轻轻用纸巾替她擦嘴，动作自然细腻，说：“천천히 먹어. 아무도 안 뺏어.”。镜头7：两人对视微笑，气氛安静甜蜜。镜头缓慢拉远，餐馆灯光温暖包围，画面淡出。整体风格：韩剧剧照质感、自然手持跟拍、柔光滤镜、浅景深、暖色调、真实生活感、轻微慢动作、情绪细腻、电影级构图、4K高细节。';

const byteFpvApplePieBakingPrompt =
  '第一视角厨房烘焙 vlog，轻微广角，沉浸式手持感，全程不出现人脸，只看到双手与手臂，视角参考【图片 1】。镜头1：俯视视角，双手在厨房岛台翻开菜谱书，书页内容为【图片 2】，晨光洒入，轻微晃动记录感。镜头2：镜头垂直向下，双手在撒面粉的台面揉面、按压、折叠，面粉飞散，近景质感细节。镜头3：双手将准备好的生苹果派举到镜头前展示，苹果派参考【图片 3】。镜头4：黑屏字幕倒计时，“200°C 30mins”。镜头5：恢复第一视角，双手端起刚出炉冒热气的苹果派，金黄酥皮，暖光氛围。';

const byteWarElephantBattlefieldPrompt =
  '史诗级电影感战场视频。场景设定在广阔的古代战场沙漠，风格参考【图片 4】，士兵穿着参考【图片 3】。尘土飞扬的风掠过地面，天空阴云翻涌，低角度落日光线洒下，整体氛围厚重而压迫。开场为超远景大全景镜头，缓缓展现整齐列阵的大规模军队。队伍最前方矗立着一头巨大的【图片 2】中的装甲战象，【图片 1】中的女战士端坐在象背之上，神情平静而威严，具有统领全军的气场。镜头从远处缓慢推进（推轨/推进镜头），旗帜随风飘动，尘土在空气中漂浮，士兵轻微移动，营造真实战前氛围。切至中景，女战士目视前方，头发与披风被风吹动，画面沉稳有力量。低机位仰拍战象迈步向前，脚步落地震起沙尘，地面微微震动，气势磅礴。最后切到高空航拍大全景，镜头拉远，整支军队在沙漠战场上绵延铺展开来，规模宏大震撼。';

const byteFlowerArrangementTimelinePrompt =
  '从【视频 1】到【视频 2】，生成这个女孩插花过程的视频';

const byteBoyHugGrandpaColorizePrompt =
  '3D动画电影风格叙事短片，温暖夕阳草地或老街广场场景，环境为柔和彩色自然光。【图片 2】中的老人独自站在画面中央，全身黑白灰色（monochrome grayscale），与彩色环境形成强烈对比。远景建立后镜头缓慢推进。【图片 1】中的男孩从画面一侧走入，彩色、有生命力，小心翼翼看向老人轻声说“Papa?”，然后慢慢靠近。随后男孩突然跑过去抱住老人，进入慢动作，拥抱动作参考【视频 1】。两人拥抱时，从接触处开始老人身体颜色从灰色逐渐扩散恢复彩色（smooth warm color transition），从头到脚变回正常色彩。最后两人相拥，中景停顿，男孩眼角含泪说“I missed you so much”，夕阳暖光包围，画面淡出。';

const byteHorseRedEnvelopePrequelPrompt =
  '向前延长【视频 1】，8 秒超清马年红包产品展示视频，画面简洁高级，电影级运镜，暖金红国风色调，柔和柔光打光，无杂乱背景；0-2 秒：俯拍慢推，3 款烫金浮雕马年红包整齐摆放在浅米纹纸背景上，红包烫金骏马纹样细腻有光泽，鎏金纹路反光自然；2-5 秒：手持轻晃红包，纸张质感挺括，边角平整，镜头微跟拍，光影随动作渐变，搭配轻微金属碰撞的清脆音效；5-7 秒：特写红包烫金细节，骏马线条流畅，国风祥云纹路环绕，镜头轻聚焦；最后接【视频 1】，背景音乐为【音频 1】。无人物，无多余元素，氛围感拉满，适配电商产品展示';

const byteCloudIceCreamCabinPrompt =
  '以【图片 1】为首帧，画面放大至飞机舷窗外，一团团云朵缓缓飘至画面中，其中一朵为彩色糖豆点缀的云朵，始终在画面中居中，然后缓缓变形为【图片 2】中的冰淇淋，镜头推远回到机舱内，坐在床边的【图片 3】中的角色伸手从窗外拿进冰淇淋，吃了一口，嘴巴上沾满奶油，脸上洋溢出甜蜜的笑容，此时视频配音为【音频 1】';

const byteWuxiaSwordDuelExtensionPrompt =
  '向后延长【视频 1】，二人纵身交锋，剑影交错，白衣旋身避招、反手刺击，黑衣横剑格挡、顺势横扫，竹叶/碎尘飞溅，双剑精准相撞，二人对视发力，眉头紧蹙，镜头定格交锋瞬间，张力拉满。';

const byteFpvDroneFlightEditPrompt =
  '保持原有的高空俯瞰轨迹，要把 【视频 1】 中平缓滑行的普通无人机运镜转换成带有大幅度侧倾、快速俯冲翻转的 FPV 穿越机竞技视角。';

const byteFemaleAnchorOpeningPrompt =
  '【图片 2】中的女主播在图片【图片 1】的场景中说开场词，台词为【音频 1】';

const templateCategories = ['全部', '参考生成', '视频编辑', '时序补全'] as const;
type TemplateCategoryFilter = (typeof templateCategories)[number];
const allThemeCategory = '全部题材';
const preferredThemeCategories = [
  '电商带货',
  '商业广告',
  '微电影',
  '3D动漫',
  '生活方式',
  '国风艺术',
  '自然纪实',
  '产品展示',
  '人物口播',
  '人物替换',
  '食品饮品',
  '美妆个护',
  '动作打斗',
  '运镜特效',
  '时序补全',
];

function categoryForTemplate(template: AdMaterialTemplate): Exclude<TemplateCategoryFilter, '全部'> {
  if (
    template.category === '视频编辑' ||
    template.id === 'byte-camera-renewal' ||
    template.id === 'byte-gift-cream-replace' ||
    template.id === 'byte-perfume-light-sweep' ||
    template.id === 'byte-glasses-model-replace' ||
    template.id === 'byte-anime-fireworks-color-fix' ||
    template.id === 'byte-runway-clothes-replace'
  ) {
    return '视频编辑';
  }
  if (template.category === '时序补全' || template.id === 'byte-makeup-cut-join' || template.id === 'byte-dogfood-package-replace') {
    return '时序补全';
  }
  return '参考生成';
}

function promptForTemplate(template: AdMaterialTemplate): string {
  if (template.id === 'byte-camera-renewal') return byteCameraTemplatePrompt;
  if (template.id === 'byte-makeup-cut-join') return byteMakeupCutJoinPrompt;
  if (template.id === 'byte-gift-cream-replace') return byteGiftCreamReplacePrompt;
  if (template.id === 'byte-dogfood-package-replace') return byteDogfoodPackageReplacePrompt;
  if (template.id === 'byte-perfume-light-sweep') return bytePerfumeLightSweepPrompt;
  if (template.id === 'byte-apple-tea-fpv-ad') return byteAppleTeaFpvAdPrompt;
  if (template.id === 'byte-glasses-model-replace') return byteGlassesModelReplacePrompt;
  if (template.id === 'byte-anime-fireworks-color-fix') return byteAnimeFireworksColorFixPrompt;
  if (template.id === 'byte-pixel-fight-reference') return bytePixelFightReferencePrompt;
  if (template.id === 'byte-lion-bullet-time-extend') return byteLionBulletTimeExtendPrompt;
  if (template.id === 'byte-woodcut-horse-motion') return byteWoodcutHorseMotionPrompt;
  if (template.id === 'byte-runway-clothes-replace') return byteRunwayClothesReplacePrompt;
  if (template.id === 'byte-revenge-chess-anime') return byteRevengeChessAnimePrompt;
  if (template.id === 'byte-caterpillar-cocoon-prequel') return byteCaterpillarCocoonPrequelPrompt;
  if (template.id === 'byte-window-spring-extension') return byteWindowSpringExtensionPrompt;
  if (template.id === 'byte-kdrama-restaurant-noodle') return byteKdramaRestaurantNoodlePrompt;
  if (template.id === 'byte-fpv-apple-pie-baking') return byteFpvApplePieBakingPrompt;
  if (template.id === 'byte-war-elephant-battlefield') return byteWarElephantBattlefieldPrompt;
  if (template.id === 'byte-flower-arrangement-timeline') return byteFlowerArrangementTimelinePrompt;
  if (template.id === 'byte-boy-hug-grandpa-colorize') return byteBoyHugGrandpaColorizePrompt;
  if (template.id === 'byte-horse-red-envelope-prequel') return byteHorseRedEnvelopePrequelPrompt;
  if (template.id === 'byte-cloud-ice-cream-cabin') return byteCloudIceCreamCabinPrompt;
  if (template.id === 'byte-wuxia-sword-duel-extension') return byteWuxiaSwordDuelExtensionPrompt;
  if (template.id === 'byte-fpv-drone-flight-edit') return byteFpvDroneFlightEditPrompt;
  if (template.id === 'byte-female-anchor-opening') return byteFemaleAnchorOpeningPrompt;
  return `参考模板「${template.name}」生成投流视频。${template.description} 画面高清自然，避免无关 Logo、水印和乱码字幕。`;
}

function roleForType(type: FreeCreationInputAsset['type']): string {
  if (type === 'video') return 'reference_video';
  if (type === 'audio') return 'reference_audio';
  return 'reference_image';
}

function labelForType(type: FreeCreationInputAsset['type'], index: number): string {
  if (type === 'video') return `@视频${index}`;
  if (type === 'audio') return `@音频${index}`;
  return `@图片${index}`;
}

function templateAssets(template: AdMaterialTemplate): FreeCreationInputAsset[] {
  let image = 0;
  let video = 0;
  let audio = 0;
  const assets: FreeCreationInputAsset[] = [];
  template.slots.forEach((slot) => {
    const url = typeof slot.default_url === 'string' ? slot.default_url.trim() : '';
    const previewUrl = typeof slot.preview_url === 'string' ? slot.preview_url.trim() : '';
    const type = typeof slot.type === 'string' ? slot.type.trim() : '';
    const fallbackPreviewUrl = type === 'video' && typeof template.preview_video_url === 'string' ? template.preview_video_url.trim() : '';
    if (!url || !['image', 'video', 'audio', 'avatar'].includes(type)) return;

    if (type === 'video') video += 1;
    else if (type === 'audio') audio += 1;
    else image += 1;

    const typed = type as FreeCreationInputAsset['type'];
    const index = type === 'video' ? video : type === 'audio' ? audio : image;
    assets.push({
      type: typed,
      url,
      preview_url: previewUrl || fallbackPreviewUrl || undefined,
      storage_key: `template://${template.id}/${String(slot.key || labelForType(typed, index))}`,
      file_name: typeof slot.label === 'string' ? slot.label : labelForType(typed, index),
      mime_type: type === 'video' ? 'video/asset' : type === 'audio' ? 'audio/asset' : 'image/asset',
      file_size: 0,
      role: roleForType(typed),
      label: labelForType(typed, index),
    });
  });
  return assets;
}

function TemplatePreview({ template }: { template: AdMaterialTemplate }) {
  if (template.preview_video_url) {
    return (
      <video
        src={template.preview_video_url}
        className="aspect-video w-full bg-[#101828] object-cover"
        muted
        loop
        playsInline
        preload="metadata"
        controls
      />
    );
  }
  if (template.cover_url) {
    return <img src={template.cover_url} alt="" className="aspect-video w-full bg-[#101828] object-cover" />;
  }
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-[#F2F4F8] text-[13px] font-bold text-[#8E8E93]">
      暂无预览
    </div>
  );
}

export function AdMaterialsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<AdMaterialTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategoryFilter>('全部');
  const [themeFilter, setThemeFilter] = useState(allThemeCategory);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listAdMaterialTemplates();
        if (!cancelled) setTemplates(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '模板加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themeCategoryOptions = useMemo(() => {
    const discovered = new Set<string>();
    templates.forEach((template) => {
      template.theme_categories?.forEach((theme) => {
        const trimmed = theme.trim();
        if (trimmed) discovered.add(trimmed);
      });
    });
    const ordered = preferredThemeCategories.filter((theme) => discovered.has(theme));
    const extras = Array.from(discovered).filter((theme) => !preferredThemeCategories.includes(theme)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return [allThemeCategory, ...ordered, ...extras];
  }, [templates]);

  const visibleTemplates = useMemo(
    () =>
      templates.filter((template) => {
        const matchesCategory = categoryFilter === '全部' || categoryForTemplate(template) === categoryFilter;
        const themes = template.theme_categories || [];
        const matchesTheme = themeFilter === allThemeCategory || themes.includes(themeFilter);
        return matchesCategory && matchesTheme;
      }),
    [categoryFilter, templates, themeFilter],
  );

  async function useTemplate(template: AdMaterialTemplate) {
    setError('');
    if (!isAuthenticated) {
      setError('请先登录后再使用模板。');
      return;
    }
    setSubmittingId(template.id);
    try {
      const project = await createFreeCreationProject({
        title: template.name,
        prompt: promptForTemplate(template),
        assets: templateAssets(template),
        template_id: template.id,
        template_preview_video_url: template.preview_video_url || undefined,
        model: 'doubao-seedance-2-0-260128',
        ratio: template.default_ratio === 'adaptive' ? '9:16' : template.default_ratio || '9:16',
        resolution: template.default_resolution || '720p',
        duration: template.default_duration || 8,
        generate_audio: template.default_generate_audio,
        watermark: false,
      });
      navigate(`/free-creation/projects/${project.id}/video`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '模板项目创建失败');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <ShortDramaLayout>
      <main className="min-h-screen bg-[#F7F8FC] px-5 py-8 md:px-10">
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-8">
            <h1 className="text-[34px] font-black text-[#1D1D1F]">模板专区</h1>
            <p className="mt-2 text-[15px] text-[#667085]">选择模板后进入自由创作视频工作台，可继续编辑提示词、素材和生成参数。</p>
          </div>

          {error ? <div className="mb-5 rounded-lg bg-[#FFF2F2] px-3 py-2 text-sm text-[#B42318]">{error}</div> : null}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {templateCategories.map((category) => {
                const active = categoryFilter === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`h-10 rounded-lg border px-4 text-[14px] font-bold transition ${
                      active
                        ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white'
                        : 'border-[#DDE4F2] bg-white text-[#475467] hover:border-[#1D1D1F]'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            <select
              value={themeFilter}
              onChange={(event) => setThemeFilter(event.target.value)}
              className="h-10 min-w-[160px] rounded-lg border border-[#DDE4F2] bg-white px-3 text-[14px] font-bold text-[#475467] outline-none transition hover:border-[#1D1D1F] focus:border-[#1D1D1F]"
            >
              {themeCategoryOptions.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[15px] font-bold text-[#8E8E93]">模板加载中</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {visibleTemplates.map((template) => {
                const busy = submittingId === template.id;
                return (
                  <article key={template.id} className="overflow-hidden rounded-xl border border-[#E1E5EE] bg-white shadow-sm">
                    <TemplatePreview template={template} />
                    <div className="p-5">
                      <h3 className="text-[17px] font-black text-[#1D1D1F]">{template.name}</h3>
                      <div className="mt-2 text-sm text-[#1D1D1F]">{categoryForTemplate(template)} · {template.default_duration}s · {template.default_ratio}</div>
                      <p className="mt-4 min-h-16 text-[15px] leading-7 text-[#1D1D1F]">{template.description}</p>
                      <button
                        onClick={() => void useTemplate(template)}
                        disabled={Boolean(submittingId)}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#9DB7FF] bg-white px-4 py-2 text-[15px] font-bold text-[#1D1D1F] hover:border-[#1D1D1F] disabled:border-[#D0D5DD] disabled:text-[#98A2B3]"
                      >
                        <i className={busy ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'} />
                        {busy ? '创建中' : '使用模板'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </ShortDramaLayout>
  );
}
