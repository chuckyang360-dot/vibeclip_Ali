export interface DemoCase {
  id: string;
  genre: string;
  industry: string;
  market: string;
  title: string;
  desc: string;
  duration: string;
  platform: string;
  style: string;
  color: string;
  img: string;
  create: {
    projectName: string;
    duration: string;
    format: string;
    plotStyles: string[];
    visualStyle: string;
    ratio: string;
  };
  step1: {
    productName: string;
    brandName: string;
    category: string;
    targetMarket: string[];
    targetUser: string;
    sellingPoints: string[];
    useScene: string;
    brandTone: string;
    parsedSummary: string;
    parsedSellingPoints: string[];
    parsedSceneKeywords: string[];
    parsedStyleKeywords: string[];
    imgs: string[];
  };
  step2: {
    title: string;
    premise: string;
    hook: string;
    conflict: string;
    twist: string;
    resolution: string;
    segments: Array<{
      id: number;
      name: string;
      goal: string;
      duration: string;
      productPlacement: string;
      synopsis: string;
      color: string;
    }>;
  };
  step3: {
    characters: Array<{
      id: number;
      name: string;
      role: string;
      desc: string;
      tags: string[];
      voice: string;
      img: string;
      images?: string[];
    }>;
    scenes: Array<{
      id: number;
      name: string;
      type: string;
      desc: string;
      lighting?: string;
      mood?: string;
      camera?: string;
      segment?: string;
      img: string;
      images?: string[];
    }>;
    products: Array<{
      id: number;
      name: string;
      placement: string;
      cameraHint: string;
      style?: string;
      segment?: string;
      img: string;
      images?: string[];
    }>;
  };
  overview: {
    duration: string;
    format: string;
    ratio: string;
    style: string;
    visual: string;
    market: string;
    plotSummary: string;
    segments: Array<{
      id: number;
      name: string;
      duration: string;
      color: string;
      img: string;
    }>;
    finalImg: string;
    resolution: string;
    fps: string;
  };
}

export const DEMO_CASES: DemoCase[] = [
  // ── 01 家具品牌广告 ──────────────────────────────────────────────
  {
    id: "case-01",
    genre: "品牌广告",
    industry: "家具品牌",
    market: "欧洲市场",
    title: "《新家第一天》",
    desc: "围绕搬家场景打造情绪化短剧，展示北欧风格家具在不同空间的自然融入，Hook 率提升 3.2x",
    duration: "60s",
    platform: "Meta & YouTube",
    style: "情绪流",
    color: "#B45309",
    img: "https://readdy.ai/api/search-image?query=elegant%20scandinavian%20minimalist%20furniture%20cozy%20living%20room%20warm%20ambient%20lighting%20cinematic%20wide%20shot%20professional%20photography%20beige%20white%20tones%20premium%20home%20decor%20advertisement%20clean%20background&width=480&height=300&seq=sdcase01&orientation=landscape",
    create: {
      projectName: "北欧家居欧洲市场短剧",
      duration: "60s",
      format: "single",
      plotStyles: ["emotion", "twist"],
      visualStyle: "cinematic",
      ratio: "9:16",
    },
    step1: {
      productName: "Fjord 实木餐桌",
      brandName: "NordHome",
      category: "家居生活",
      targetMarket: ["欧洲"],
      targetUser: "25-40岁欧洲都市家庭",
      sellingPoints: ["天然实木，可持续材料认证", "北欧设计师联名款", "60天免费退换", "模块化组装"],
      useScene: "周末家庭聚餐、北欧风居家改造、搬入新家",
      brandTone: "温暖、自然、克制、可持续、高级感",
      parsedSummary: "北欧极简风格家居品牌，主打天然木质材料与斯堪的纳维亚设计语言，目标消费群体为 25-40 岁欧洲高收入家庭。",
      parsedSellingPoints: ["天然实木，可持续材料认证", "北欧设计师联名款", "60天免费退换服务", "模块化组装，适配多种空间"],
      parsedSceneKeywords: ["温暖家居", "北欧光线", "简洁空间", "自然纹理", "日式侘寂感"],
      parsedStyleKeywords: ["情绪化", "生活方式", "高级感", "温暖克制"],
      imgs: [
        "https://readdy.ai/api/search-image?query=minimalist%20scandinavian%20wooden%20furniture%20product%20shot%20white%20background%20clean%20professional%20light%20oak%20texture%20table%20chair%20lifestyle%20interior%20design%20brand%20product%20photography%20natural%20material&width=160&height=160&seq=s1img01&orientation=squarish",
        "https://readdy.ai/api/search-image?query=cozy%20nordic%20home%20interior%20decor%20warm%20lighting%20wooden%20shelves%20plants%20minimalist%20living%20room%20lifestyle%20photography%20professional%20advertisement%20clean%20elegant&width=160&height=160&seq=s1img02&orientation=squarish",
        "https://readdy.ai/api/search-image?query=scandinavian%20bedroom%20furniture%20details%20close%20up%20wood%20grain%20texture%20natural%20material%20premium%20product%20craftsmanship%20white%20background%20studio%20photography&width=160&height=160&seq=s1img03&orientation=squarish",
      ],
    },
    step2: {
      title: "《新家第一天》",
      premise: "一位年轻女性独自搬入新公寓，面对空荡荡的空间感到迷茫，最终通过精心挑选的北欧家具找到了属于自己的生活节奏。",
      hook: "女主凌晨三点独坐空荡荡的新公寓地板，手机里播放着前男友发来的嘲讽消息：「你一个人能怎么办」",
      conflict: "面对陌生的城市、空荡荡的房间和内心的自我怀疑，女主试图用家具填满空间，却始终觉得哪里不对——是缺少家的感觉，还是缺少某个人？",
      twist: "朋友来访惊呼「你这里怎么这么美」，女主看着满室温暖的北欧木质光影，第一次意识到：原来家不是某个人，而是你对生活的态度。",
      resolution: "女主在日落时分泡一杯咖啡，坐在餐桌旁发出去一条消息：「我过得很好。」镜头拉远，整个公寓在暖光中完整呈现。",
      segments: [
        { id: 1, name: "Hook", goal: "制造情绪共鸣，引发观众好奇", duration: "0-12s", productPlacement: "隐性 / 空间背景", synopsis: "深夜独坐空房，手机通知，情绪低落，强烈代入感", color: "#B45309" },
        { id: 2, name: "Conflict", goal: "强化情绪冲突，建立产品需求感", duration: "12-40s", productPlacement: "产品选购过程自然植入", synopsis: "探索家居市场，对比不同风格，价值观碰撞与选择困惑", color: "#DC2626" },
        { id: 3, name: "Resolution", goal: "产品价值揭示，情绪正向升华", duration: "40-60s", productPlacement: "全品类完整亮相", synopsis: "朋友惊讶，女主意识到转变，品牌价值主张自然呈现", color: "#047857" },
      ],
    },
    step3: {
      characters: [
        { id: 1, name: "林晓", role: "主角", desc: "26岁独立设计师，刚搬入新公寓，性格细腻、有品位，内心渴望建立属于自己的生活空间", tags: ["情绪型演员", "写实风格", "25-30岁女性"], voice: "温柔知性", img: "https://readdy.ai/api/search-image?query=young%20chinese%20professional%20woman%20confident%20elegant%20modern%20outfit%20neutral%20expression%20studio%20portrait%20clean%20white%20background%20cinematic%20lighting%20lifestyle%20advertisement%20commercial%20photography%20realistic&width=200&height=260&seq=char01&orientation=portrait", images: ["https://readdy.ai/api/search-image?query=young%20chinese%20professional%20woman%20confident%20elegant%20modern%20outfit%20neutral%20expression%20studio%20portrait%20clean%20white%20background%20cinematic%20lighting%20lifestyle%20advertisement%20commercial%20photography%20realistic&width=200&height=260&seq=char01&orientation=portrait", "https://readdy.ai/api/search-image?query=young%20asian%20woman%20designer%20casual%20home%20wear%20relaxed%20natural%20light%20indoor%20lifestyle%20photography%20authentic%20expression%20warm%20background%20editorial%20portrait&width=200&height=260&seq=char01b&orientation=portrait"] },
        { id: 2, name: "Sarah", role: "配角", desc: "林晓的闺蜜，活泼外向，是剧情中重要的情绪反馈角色，负责触发 Twist 段落的高光反应", tags: ["配角", "欧洲风格", "自然表演"], voice: "活泼亮丽", img: "https://readdy.ai/api/search-image?query=european%20young%20woman%20friend%20casual%20cheerful%20genuine%20smile%20natural%20lifestyle%20portrait%20warm%20lighting%20clean%20background%20commercial%20advertisement%20photography%20authentic%20expression&width=200&height=260&seq=char02&orientation=portrait" },
      ],
      scenes: [
        { id: 101, name: "空旷公寓", type: "室内 · 夜晚", lighting: "冷白人工光", mood: "孤独 · 期待", camera: "广角全景 · 慢推镜头", segment: "Segment 1 · Hook段落", desc: "全空的新公寓，只有地板和窗帘，冷白色调，强调孤独感", img: "https://readdy.ai/api/search-image?query=empty%20minimalist%20apartment%20interior%20night%20cold%20white%20light%20bare%20wooden%20floor%20large%20windows%20city%20lights%20outside%20cinematic%20lonely%20atmosphere%20wide%20angle%20shot%20realistic%20photography&width=320&height=200&seq=scene01&orientation=landscape", images: ["https://readdy.ai/api/search-image?query=empty%20minimalist%20apartment%20interior%20night%20cold%20white%20light%20bare%20wooden%20floor%20large%20windows%20city%20lights%20outside%20cinematic%20lonely%20atmosphere%20wide%20angle%20shot%20realistic%20photography&width=320&height=200&seq=scene01&orientation=landscape", "https://readdy.ai/api/search-image?query=empty%20apartment%20hallway%20night%20minimal%20bare%20concrete%20floor%20cold%20artificial%20light%20cinematic%20shadows%20atmosphere%20urban%20living%20photography%20wide&width=320&height=200&seq=scene01b&orientation=landscape"] },
        { id: 102, name: "家居展厅", type: "室内 · 日间", lighting: "大量自然光", mood: "探索 · 惊喜", camera: "跟随拍摄 · 货架特写", segment: "Segment 2 · Conflict段落", desc: "北欧风格家具展厅，大量自然光，产品展示区", img: "https://readdy.ai/api/search-image?query=scandinavian%20furniture%20showroom%20interior%20natural%20daylight%20wooden%20furniture%20display%20clean%20bright%20minimalist%20lifestyle%20store%20wide%20shot%20professional%20photography%20elegant%20retail%20space&width=320&height=200&seq=scene02&orientation=landscape" },
        { id: 103, name: "完整新家", type: "室内 · 黄金时段", lighting: "暖橙色自然光", mood: "温暖 · 满足感", camera: "正面全景 · 环绕拍摄", segment: "Segment 3 · Resolution", desc: "完成布置的温暖公寓，暖橙色调，北欧家具全貌", img: "https://readdy.ai/api/search-image?query=cozy%20nordic%20home%20interior%20golden%20hour%20light%20warm%20wooden%20furniture%20complete%20living%20room%20atmospheric%20lifestyle%20photography%20cinematic%20amber%20tones%20elegant%20comfortable%20premium%20home%20decor&width=320&height=200&seq=scene03&orientation=landscape" },
      ],
      products: [
        { id: 201, name: "Fjord 实木餐桌", placement: "餐厅主视觉", cameraHint: "45° 俯拍 + 特写木纹", style: "北欧极简 · 自然橡木材质", segment: "Segment 2 · Segment 3", img: "https://readdy.ai/api/search-image?query=scandinavian%20natural%20wood%20dining%20table%20clean%20white%20background%20product%20photography%20oak%20grain%20detail%20minimalist%20nordic%20design%20premium%20furniture%20studio%20lighting&width=240&height=180&seq=prod01&orientation=landscape" },
        { id: 202, name: "Lund 布艺沙发", placement: "客厅焦点", cameraHint: "正面全景 + 材质特写", style: "亚麻织物 · 哑光灰米色", segment: "Segment 2 · Segment 3", img: "https://readdy.ai/api/search-image?query=modern%20scandinavian%20fabric%20sofa%20clean%20background%20product%20shot%20linen%20texture%20nordic%20minimalist%20furniture%20professional%20studio%20photography%20warm%20light%20elegant&width=240&height=180&seq=prod02&orientation=landscape" },
      ],
    },
    overview: {
      duration: "60s", format: "单条广告", ratio: "9:16", style: "情绪 · 反转", visual: "写实电影感", market: "欧洲",
      plotSummary: "年轻女性独自搬入新公寓，面对孤独与自我怀疑，通过精心挑选北欧家具，最终找到属于自己的生活态度——家不是某个人，而是你对生活的态度。",
      segments: [
        { id: 1, name: "S1 · Hook", duration: "12s", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20film%20frame%20empty%20apartment%20night%20woman%20sitting%20lonely%20dramatic%20moody%20vertical%20advertisement&width=240&height=420&seq=ov01&orientation=portrait" },
        { id: 2, name: "S2 · Conflict", duration: "28s", color: "#DC2626", img: "https://readdy.ai/api/search-image?query=cinematic%20furniture%20showroom%20woman%20browsing%20nordic%20interior%20warm%20daylight%20vertical%20commercial%20advertisement&width=240&height=420&seq=ov02&orientation=portrait" },
        { id: 3, name: "S3 · Resolution", duration: "20s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20golden%20hour%20cozy%20nordic%20home%20woman%20smiling%20warm%20living%20room%20vertical%20brand%20advertisement%20lifestyle&width=240&height=420&seq=ov03&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20short%20film%20nordic%20home%20advertisement%20complete%20final%20composed%20video%20frame%20golden%20hour%20interior%20vertical%20portrait%20brand%20commercial&width=180&height=320&seq=final01&orientation=portrait",
      resolution: "1080 × 1920", fps: "24fps",
    },
  },
  {
    id: "case-02",
    genre: "品牌广告",
    industry: "女装品牌",
    market: "TikTok 全球",
    title: "《第一次约会》",
    desc: "以反转剧情展现穿搭提升自信的故事，搭配女主角情绪弧线，完播率 68%，ROAS 4.8",
    duration: "45s",
    platform: "TikTok",
    style: "反转冲突",
    color: "#DC2626",
    img: "https://readdy.ai/api/search-image?query=fashionable%20woman%20elegant%20modern%20clothing%20brand%20advertisement%20cinematic%20dramatic%20portrait%20lighting%20warm%20studio%20sophisticated%20high%20end%20fashion%20commercial%20natural%20confident%20expression%20clean%20background&width=480&height=300&seq=sdcase02&orientation=landscape",
    create: { projectName: "女装品牌TikTok全球短剧", duration: "45s", format: "single", plotStyles: ["twist", "conflict"], visualStyle: "premium_ad", ratio: "9:16" },
    step1: {
      productName: "Lumière 春季连衣裙系列",
      brandName: "Lumière Paris",
      category: "女装服饰",
      targetMarket: ["北美", "欧洲"],
      targetUser: "22-35岁时尚都市女性",
      sellingPoints: ["法式优雅剪裁", "可持续面料", "多场景穿搭", "限量设计师款"],
      useScene: "约会、商务午餐、周末出行、派对",
      brandTone: "优雅、自信、法式浪漫、现代独立",
      parsedSummary: "法式轻奢女装品牌，以优雅剪裁和可持续面料为核心卖点，目标用户为追求品质生活的都市独立女性。",
      parsedSellingPoints: ["法式优雅剪裁", "可持续环保面料", "多场景穿搭适配", "限量设计师联名款"],
      parsedSceneKeywords: ["巴黎街头", "咖啡馆", "约会场景", "自然光线", "城市美学"],
      parsedStyleKeywords: ["法式浪漫", "轻奢质感", "自信独立", "现代优雅"],
      imgs: [
        "https://readdy.ai/api/search-image?query=elegant%20french%20fashion%20dress%20product%20photography%20clean%20white%20background%20studio%20lighting%20premium%20clothing%20brand%20advertisement%20sophisticated%20style&width=160&height=160&seq=s1img04&orientation=squarish",
        "https://readdy.ai/api/search-image?query=fashion%20model%20wearing%20elegant%20dress%20paris%20street%20style%20natural%20light%20editorial%20photography%20lifestyle%20brand%20advertisement&width=160&height=160&seq=s1img05&orientation=squarish",
      ],
    },
    step2: {
      title: "《第一次约会》",
      premise: "职场女性因为一件连衣裙，从自我怀疑到重拾自信，在约会中展现真实的自己。",
      hook: "女主对着镜子换了第七件衣服，手机响起约会提醒，她叹气：「我根本不知道自己是谁」",
      conflict: "闺蜜推荐了一件法式连衣裙，女主犹豫：「这不像我」。闺蜜反问：「你知道自己像什么吗？」",
      twist: "穿上裙子走进餐厅，约会对象起身时的眼神，让女主第一次感受到——不是裙子改变了她，是她终于允许自己发光。",
      resolution: "餐厅外，女主对着手机自拍，发了一条朋友圈：「今天，我很喜欢自己。」",
      segments: [
        { id: 1, name: "Hook", goal: "制造焦虑共鸣，引发女性代入", duration: "0-10s", productPlacement: "衣橱背景隐性植入", synopsis: "换衣焦虑，自我怀疑，强烈情绪共鸣", color: "#DC2626" },
        { id: 2, name: "Conflict", goal: "建立产品与自信的情感连接", duration: "10-30s", productPlacement: "产品试穿自然展示", synopsis: "闺蜜推荐，犹豫试穿，情绪转折", color: "#B45309" },
        { id: 3, name: "Resolution", goal: "品牌价值升华，情绪正向收尾", duration: "30-45s", productPlacement: "完整穿搭亮相", synopsis: "约会现场，自信绽放，品牌价值呈现", color: "#047857" },
      ],
    },
    step3: {
      characters: [
        { id: 1, name: "Amélie", role: "主角", desc: "28岁广告策划，外表精致内心敏感，习惯用完美掩盖不安全感，渴望被真实看见", tags: ["情绪型", "时尚感", "都市女性"], voice: "温柔坚定", img: "https://readdy.ai/api/search-image?query=young%20french%20woman%20elegant%20fashion%20model%20confident%20portrait%20studio%20clean%20background%20commercial%20advertisement%20sophisticated%20style%20natural%20beauty&width=200&height=260&seq=char03&orientation=portrait" },
        { id: 2, name: "Chloe", role: "闺蜜", desc: "Amélie的好友，直率洒脱，是推动剧情转折的关键角色", tags: ["配角", "活泼", "推动剧情"], voice: "爽朗直接", img: "https://readdy.ai/api/search-image?query=young%20woman%20friend%20casual%20cheerful%20confident%20portrait%20warm%20lighting%20clean%20background%20lifestyle%20commercial%20photography%20natural%20expression&width=200&height=260&seq=char04&orientation=portrait" },
      ],
      scenes: [
        { id: 101, name: "卧室衣橱前", type: "室内 · 日间", lighting: "柔和自然光", mood: "焦虑 · 迷茫", camera: "镜子反射 · 特写表情", segment: "Segment 1 · Hook", desc: "整洁的卧室，大衣橱，镜子前的女主，衣服散落一地", img: "https://readdy.ai/api/search-image?query=woman%20bedroom%20wardrobe%20mirror%20trying%20clothes%20morning%20light%20natural%20soft%20cinematic%20lifestyle%20photography%20fashion%20editorial%20clean%20interior&width=320&height=200&seq=scene04&orientation=landscape" },
        { id: 102, name: "精品服装店", type: "室内 · 日间", lighting: "暖白精品店灯光", mood: "期待 · 惊喜", camera: "试衣间特写 · 全身镜", segment: "Segment 2 · Conflict", desc: "法式风格精品服装店，试衣间，全身镜，暖光氛围", img: "https://readdy.ai/api/search-image?query=elegant%20french%20boutique%20fashion%20store%20interior%20warm%20lighting%20fitting%20room%20mirror%20premium%20retail%20space%20clean%20minimal%20style&width=320&height=200&seq=scene05&orientation=landscape" },
        { id: 103, name: "高档餐厅", type: "室内 · 夜晚", lighting: "暖黄烛光", mood: "自信 · 浪漫", camera: "入场全景 · 情绪特写", segment: "Segment 3 · Resolution", desc: "精致法式餐厅，烛光氛围，女主自信入场", img: "https://readdy.ai/api/search-image?query=elegant%20french%20restaurant%20interior%20candlelight%20warm%20romantic%20atmosphere%20fine%20dining%20premium%20luxury%20ambiance%20cinematic%20photography&width=320&height=200&seq=scene06&orientation=landscape" },
      ],
      products: [
        { id: 201, name: "Lumière 春季连衣裙", placement: "试穿 + 约会全程", cameraHint: "全身镜 + 细节特写", style: "法式优雅 · 轻盈飘逸", segment: "Segment 2 · Segment 3", img: "https://readdy.ai/api/search-image?query=elegant%20french%20spring%20dress%20product%20photography%20clean%20white%20background%20studio%20lighting%20premium%20fashion%20brand%20sophisticated%20style%20floral&width=240&height=180&seq=prod04&orientation=landscape" },
      ],
    },
    overview: {
      duration: "45s", format: "单条广告", ratio: "9:16", style: "反转 · 冲突", visual: "高级广告感", market: "TikTok 全球",
      plotSummary: "职场女性因为一件连衣裙，从自我怀疑到重拾自信，在约会中展现真实的自己——不是裙子改变了她，是她终于允许自己发光。",
      segments: [
        { id: 1, name: "S1 · Hook", duration: "10s", color: "#DC2626", img: "https://readdy.ai/api/search-image?query=cinematic%20woman%20bedroom%20mirror%20trying%20clothes%20anxious%20emotional%20vertical%20fashion%20advertisement%20tiktok&width=240&height=420&seq=ov04&orientation=portrait" },
        { id: 2, name: "S2 · Conflict", duration: "20s", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20fashion%20boutique%20woman%20trying%20dress%20mirror%20elegant%20vertical%20commercial%20advertisement&width=240&height=420&seq=ov05&orientation=portrait" },
        { id: 3, name: "S3 · Resolution", duration: "15s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20elegant%20restaurant%20woman%20confident%20smiling%20beautiful%20dress%20vertical%20brand%20advertisement%20lifestyle&width=240&height=420&seq=ov06&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20fashion%20advertisement%20final%20frame%20elegant%20woman%20confident%20dress%20restaurant%20vertical%20portrait%20brand%20commercial&width=180&height=320&seq=final02&orientation=portrait",
      resolution: "1080 × 1920", fps: "30fps",
    },
  },
  {
    id: "case-03",
    genre: "种草短剧",
    industry: "美妆品牌",
    market: "海外种草",
    title: "《她的秘密》",
    desc: "悬疑风种草短剧，通过朋友追问引出产品，自然植入产品使用场景，互动率提升 210%",
    duration: "30s",
    platform: "Instagram Reels",
    style: "悬疑种草",
    color: "#047857",
    img: "https://readdy.ai/api/search-image?query=beauty%20cosmetics%20luxury%20skincare%20product%20advertisement%20cinematic%20close%20up%20dramatic%20moody%20lighting%20elegant%20woman%20applying%20makeup%20premium%20brand%20commercial%20soft%20shadows%20professional%20studio&width=480&height=300&seq=sdcase03&orientation=landscape",
    create: { projectName: "美妆品牌Instagram种草短剧", duration: "30s", format: "single", plotStyles: ["suspense", "emotion"], visualStyle: "premium_ad", ratio: "9:16" },
    step1: {
      productName: "Luminos 精华液",
      brandName: "Luminos Beauty",
      category: "美妆护肤",
      targetMarket: ["北美", "欧洲", "东南亚"],
      targetUser: "20-35岁注重护肤的都市女性",
      sellingPoints: ["72小时深层补水", "专利玻尿酸矩阵", "皮肤科医生推荐", "30天可见效果"],
      useScene: "早晚护肤、出差旅行、换季护肤",
      brandTone: "科学、温柔、高效、可信赖",
      parsedSummary: "高端护肤品牌，以专利玻尿酸矩阵技术为核心，主打72小时深层补水，目标用户为注重科学护肤的都市女性。",
      parsedSellingPoints: ["72小时深层补水技术", "专利玻尿酸矩阵", "皮肤科医生临床推荐", "30天可见效果保证"],
      parsedSceneKeywords: ["浴室镜前", "晨间护肤", "肌肤特写", "水润光泽", "科技感"],
      parsedStyleKeywords: ["科学护肤", "高端质感", "温柔可信", "效果导向"],
      imgs: [
        "https://readdy.ai/api/search-image?query=luxury%20skincare%20serum%20product%20photography%20clean%20white%20background%20studio%20lighting%20premium%20beauty%20brand%20sophisticated%20packaging%20glass%20bottle&width=160&height=160&seq=s1img06&orientation=squarish",
        "https://readdy.ai/api/search-image?query=skincare%20routine%20morning%20bathroom%20mirror%20woman%20applying%20serum%20natural%20light%20lifestyle%20photography%20beauty%20brand%20advertisement&width=160&height=160&seq=s1img07&orientation=squarish",
      ],
    },
    step2: {
      title: "《她的秘密》",
      premise: "朋友们都在追问同一个问题：你的皮肤怎么变得这么好？",
      hook: "聚会上，三个朋友同时盯着女主的脸，异口同声：「你到底用了什么？」女主神秘一笑。",
      conflict: "女主回忆起一个月前，皮肤干燥暗沉，试遍各种产品都没效果，直到遇见了这瓶精华液。",
      twist: "镜头切回聚会，女主从包里掏出精华液，朋友们瞬间围上来——「这就是你的秘密？」",
      resolution: "女主对着镜头：「不是秘密了。」产品特写，品牌信息呈现。",
      segments: [
        { id: 1, name: "Hook", goal: "制造悬念，引发好奇", duration: "0-8s", productPlacement: "无，纯情绪铺垫", synopsis: "朋友追问，神秘微笑，强烈好奇心", color: "#047857" },
        { id: 2, name: "Flashback", goal: "建立产品使用场景，展示效果", duration: "8-22s", productPlacement: "产品使用过程完整展示", synopsis: "回忆护肤历程，产品使用，效果对比", color: "#B45309" },
        { id: 3, name: "Reveal", goal: "产品揭晓，品牌信息呈现", duration: "22-30s", productPlacement: "产品正面特写亮相", synopsis: "掏出产品，朋友反应，品牌收尾", color: "#DC2626" },
      ],
    },
    step3: {
      characters: [{ id: 1, name: "Mia", role: "主角", desc: "27岁时尚博主，皮肤状态是她的核心资产，对护肤有深度研究和独到见解", tags: ["KOL风格", "护肤达人", "自然美"], voice: "温柔神秘", img: "https://readdy.ai/api/search-image?query=young%20asian%20woman%20beauty%20blogger%20glowing%20skin%20natural%20makeup%20portrait%20studio%20clean%20background%20commercial%20advertisement%20skincare%20lifestyle&width=200&height=260&seq=char05&orientation=portrait" }],
      scenes: [
        { id: 101, name: "时尚聚会", type: "室内 · 夜晚", lighting: "暖黄派对灯光", mood: "神秘 · 好奇", camera: "特写表情 · 朋友反应", segment: "Segment 1 · Hook", desc: "精致的家庭聚会，暖光氛围，朋友们围坐", img: "https://readdy.ai/api/search-image?query=elegant%20home%20party%20gathering%20friends%20warm%20lighting%20interior%20cozy%20atmosphere%20lifestyle%20photography%20social%20gathering%20premium&width=320&height=200&seq=scene07&orientation=landscape" },
        { id: 102, name: "浴室护肤台", type: "室内 · 晨间", lighting: "柔和自然光", mood: "专注 · 仪式感", camera: "镜前特写 · 产品细节", segment: "Segment 2 · Flashback", desc: "整洁的浴室，大镜子，护肤台，晨间柔光", img: "https://readdy.ai/api/search-image?query=clean%20modern%20bathroom%20vanity%20mirror%20morning%20light%20skincare%20routine%20lifestyle%20photography%20premium%20interior%20white%20minimal&width=320&height=200&seq=scene08&orientation=landscape" },
      ],
      products: [{ id: 201, name: "Luminos 精华液", placement: "护肤台 + 聚会揭晓", cameraHint: "玻璃瓶特写 + 滴落质感", style: "高端玻璃瓶 · 金色细节", segment: "Segment 2 · Segment 3", img: "https://readdy.ai/api/search-image?query=luxury%20skincare%20serum%20glass%20bottle%20product%20photography%20clean%20white%20background%20studio%20lighting%20premium%20beauty%20brand%20gold%20details%20close%20up&width=240&height=180&seq=prod05&orientation=landscape" }],
    },
    overview: {
      duration: "30s", format: "单条广告", ratio: "9:16", style: "悬疑 · 种草", visual: "高级广告感", market: "Instagram 全球",
      plotSummary: "朋友们都在追问同一个问题：你的皮肤怎么变得这么好？通过悬疑叙事自然引出产品，展示真实使用效果，最终揭晓秘密。",
      segments: [
        { id: 1, name: "S1 · Hook", duration: "8s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20beauty%20party%20friends%20asking%20question%20mysterious%20smile%20vertical%20instagram%20reels%20advertisement&width=240&height=420&seq=ov07&orientation=portrait" },
        { id: 2, name: "S2 · Flashback", duration: "14s", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20skincare%20routine%20bathroom%20mirror%20morning%20light%20woman%20applying%20serum%20vertical%20beauty%20advertisement&width=240&height=420&seq=ov08&orientation=portrait" },
        { id: 3, name: "S3 · Reveal", duration: "8s", color: "#DC2626", img: "https://readdy.ai/api/search-image?query=cinematic%20beauty%20product%20reveal%20serum%20bottle%20close%20up%20glowing%20skin%20vertical%20brand%20advertisement&width=240&height=420&seq=ov09&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20beauty%20skincare%20advertisement%20final%20frame%20glowing%20skin%20serum%20product%20vertical%20portrait%20brand%20commercial&width=180&height=320&seq=final03&orientation=portrait",
      resolution: "1080 × 1920", fps: "30fps",
    },
  },
  {
    id: "case-04",
    genre: "网络剧集",
    industry: "内容创作",
    market: "国内平台",
    title: "《深夜食堂》第一集",
    desc: "都市情感系列短剧，以深夜小馆为舞台，讲述城市人的孤独与温暖，首集播放量破千万",
    duration: "8min",
    platform: "抖音 & 快手",
    style: "情感治愈",
    color: "#334155",
    img: "https://readdy.ai/api/search-image?query=cozy%20late%20night%20small%20restaurant%20izakaya%20warm%20amber%20lighting%20intimate%20atmosphere%20urban%20city%20night%20food%20bar%20counter%20cinematic%20moody%20photography&width=480&height=300&seq=sdcase04&orientation=landscape",
    create: { projectName: "深夜食堂都市情感短剧", duration: "60s", format: "series", plotStyles: ["emotion", "comedy"], visualStyle: "cinematic", ratio: "9:16" },
    step1: {
      productName: "深夜食堂 IP 系列",
      brandName: "暖光影视",
      category: "食品饮料",
      targetMarket: ["全球"],
      targetUser: "22-40岁都市独居青年",
      sellingPoints: ["真实情感共鸣", "治愈系叙事", "城市孤独议题", "美食情感双线"],
      useScene: "深夜独处、情感低谷、寻找温暖",
      brandTone: "温暖、真实、治愈、有烟火气",
      parsedSummary: "以深夜小馆为舞台的都市情感短剧，聚焦城市独居青年的孤独与温暖，通过美食与人情味构建情感共鸣。",
      parsedSellingPoints: ["真实都市情感共鸣", "治愈系叙事风格", "美食与情感双线叙事", "城市孤独议题深度挖掘"],
      parsedSceneKeywords: ["深夜小馆", "昏黄灯光", "城市夜景", "热气腾腾", "独处时刻"],
      parsedStyleKeywords: ["治愈温暖", "烟火气息", "真实质感", "情感共鸣"],
      imgs: [
        "https://readdy.ai/api/search-image?query=late%20night%20restaurant%20food%20ramen%20noodles%20warm%20steam%20close%20up%20cinematic%20photography%20cozy%20atmosphere&width=160&height=160&seq=s1img08&orientation=squarish",
        "https://readdy.ai/api/search-image?query=small%20izakaya%20bar%20counter%20warm%20amber%20light%20bottles%20glasses%20night%20atmosphere%20cozy%20interior%20photography&width=160&height=160&seq=s1img09&orientation=squarish",
      ],
    },
    step2: {
      title: "《深夜食堂》第一集：「一碗拉面」",
      premise: "凌晨一点，失业的程序员走进一家深夜小馆，遇见了同样在深夜寻找慰藉的陌生人们。",
      hook: "程序员盯着手机上的离职通知，抬头看见小馆门口的灯牌：「深夜食堂，只要你来，就有热的」",
      conflict: "小馆里坐着各种各样的人：失恋的女孩、加班的护士、刚吵完架的夫妻……每个人都在用食物填补某种空缺。",
      twist: "老板端上一碗拉面，说：「今天的汤底，是我妈的配方。」程序员第一次在陌生的城市，感受到了家的味道。",
      resolution: "程序员离开时，老板说：「明天还来吗？」他回头笑了：「来。」",
      segments: [
        { id: 1, name: "开场", goal: "建立场景，引入主角困境", duration: "0-2min", productPlacement: "小馆外景，灯牌特写", synopsis: "深夜城市，失业通知，走进小馆", color: "#334155" },
        { id: 2, name: "群像", goal: "展现各色人物，建立情感层次", duration: "2-6min", productPlacement: "美食特写，人物互动", synopsis: "小馆众生相，各自的故事，美食连接", color: "#B45309" },
        { id: 3, name: "治愈", goal: "情感高潮，主题升华", duration: "6-8min", productPlacement: "拉面特写，情感收尾", synopsis: "老板的拉面，家的味道，温暖收尾", color: "#047857" },
      ],
    },
    step3: {
      characters: [
        { id: 1, name: "陈默", role: "主角", desc: "29岁程序员，刚被裁员，独自在城市漂泊，外表冷漠内心渴望连接", tags: ["都市青年", "内敛型", "情感型"], voice: "低沉内敛", img: "https://readdy.ai/api/search-image?query=young%20chinese%20man%20programmer%20casual%20outfit%20tired%20expression%20urban%20lifestyle%20portrait%20clean%20background%20cinematic%20photography%20authentic&width=200&height=260&seq=char06&orientation=portrait" },
        { id: 2, name: "老板", role: "配角", desc: "50岁小馆老板，话不多但温暖，是整个故事的情感锚点", tags: ["中年男性", "温暖型", "智慧"], voice: "沉稳温厚", img: "https://readdy.ai/api/search-image?query=middle%20aged%20chinese%20man%20restaurant%20owner%20warm%20expression%20apron%20kitchen%20portrait%20authentic%20lifestyle%20photography&width=200&height=260&seq=char07&orientation=portrait" },
      ],
      scenes: [
        { id: 101, name: "深夜小馆外", type: "室外 · 深夜", lighting: "暖黄灯牌光", mood: "孤独 · 温暖召唤", camera: "仰拍灯牌 · 人物剪影", segment: "Segment 1 · 开场", desc: "城市深夜，小馆门口，暖黄灯牌，雨后湿润的街道", img: "https://readdy.ai/api/search-image?query=small%20restaurant%20exterior%20night%20warm%20light%20sign%20rain%20wet%20street%20urban%20city%20atmosphere%20cinematic%20moody%20photography&width=320&height=200&seq=scene09&orientation=landscape" },
        { id: 102, name: "小馆内部", type: "室内 · 深夜", lighting: "昏黄暖光", mood: "温暖 · 烟火气", camera: "全景 + 人物特写", segment: "Segment 2 · 群像", desc: "小而温馨的馆内，木质吧台，各色顾客，热气腾腾", img: "https://readdy.ai/api/search-image?query=cozy%20small%20restaurant%20interior%20warm%20amber%20lighting%20wooden%20counter%20bar%20stools%20customers%20eating%20night%20atmosphere%20cinematic&width=320&height=200&seq=scene10&orientation=landscape" },
      ],
      products: [{ id: 201, name: "招牌拉面", placement: "情感高潮道具", cameraHint: "热气特写 + 汤底细节", style: "传统手工 · 家的味道", segment: "Segment 3 · 治愈", img: "https://readdy.ai/api/search-image?query=japanese%20ramen%20noodles%20bowl%20steam%20close%20up%20warm%20light%20cinematic%20food%20photography%20authentic%20traditional%20restaurant&width=240&height=180&seq=prod06&orientation=landscape" }],
    },
    overview: {
      duration: "8min", format: "系列短剧", ratio: "9:16", style: "情感 · 治愈", visual: "写实电影感", market: "国内平台",
      plotSummary: "凌晨一点，失业的程序员走进深夜小馆，遇见了同样在深夜寻找慰藉的陌生人们，一碗拉面让他在陌生城市感受到了家的温暖。",
      segments: [
        { id: 1, name: "S1 · 开场", duration: "2min", color: "#334155", img: "https://readdy.ai/api/search-image?query=cinematic%20night%20city%20street%20man%20walking%20alone%20urban%20lonely%20atmosphere%20vertical%20drama%20series&width=240&height=420&seq=ov10&orientation=portrait" },
        { id: 2, name: "S2 · 群像", duration: "4min", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20restaurant%20interior%20people%20eating%20night%20warm%20atmosphere%20vertical%20drama%20series%20emotional&width=240&height=420&seq=ov11&orientation=portrait" },
        { id: 3, name: "S3 · 治愈", duration: "2min", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20ramen%20bowl%20steam%20warm%20light%20man%20eating%20emotional%20healing%20vertical%20drama%20series&width=240&height=420&seq=ov12&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20drama%20series%20final%20frame%20warm%20restaurant%20night%20man%20eating%20ramen%20emotional%20vertical%20portrait&width=180&height=320&seq=final04&orientation=portrait",
      resolution: "1080 × 1920", fps: "24fps",
    },
  },
  {
    id: "case-05",
    genre: "独立电影",
    industry: "影视创作",
    market: "国际电影节",
    title: "《候鸟》预告片",
    desc: "独立电影预告片制作，以候鸟迁徙为隐喻，讲述移民二代的身份认同困境，入围三大电影节",
    duration: "90s",
    platform: "YouTube & 电影节",
    style: "艺术电影",
    color: "#6B7280",
    img: "https://readdy.ai/api/search-image?query=cinematic%20art%20film%20birds%20migration%20sky%20dramatic%20clouds%20golden%20hour%20silhouette%20poetic%20atmospheric%20photography%20independent%20film%20aesthetic&width=480&height=300&seq=sdcase05&orientation=landscape",
    create: { projectName: "候鸟独立电影预告片", duration: "60s", format: "single", plotStyles: ["emotion", "suspense"], visualStyle: "cinematic", ratio: "16:9" },
    step1: {
      productName: "《候鸟》独立电影",
      brandName: "候鸟影业",
      category: "家居生活",
      targetMarket: ["欧洲", "北美"],
      targetUser: "25-45岁文艺青年、移民群体、电影爱好者",
      sellingPoints: ["真实移民故事改编", "国际获奖导演执导", "双语叙事结构", "诗意视觉语言"],
      useScene: "电影节展映、流媒体平台、艺术院线",
      brandTone: "诗意、深沉、真实、跨文化",
      parsedSummary: "以候鸟迁徙为核心隐喻的独立电影，探讨移民二代的身份认同困境，采用双语叙事和诗意视觉语言，目标受众为文艺青年和移民群体。",
      parsedSellingPoints: ["真实移民故事改编", "国际获奖导演执导", "双语叙事创新结构", "诗意视觉语言风格"],
      parsedSceneKeywords: ["候鸟迁徙", "两种文化", "边界地带", "记忆碎片", "身份困境"],
      parsedStyleKeywords: ["诗意电影", "跨文化叙事", "深沉真实", "艺术美学"],
      imgs: [
        "https://readdy.ai/api/search-image?query=birds%20flock%20migration%20sky%20dramatic%20golden%20hour%20silhouette%20cinematic%20art%20film%20photography%20poetic&width=160&height=160&seq=s1img10&orientation=squarish",
        "https://readdy.ai/api/search-image?query=immigrant%20family%20portrait%20two%20cultures%20identity%20documentary%20style%20photography%20authentic%20emotional&width=160&height=160&seq=s1img11&orientation=squarish",
      ],
    },
    step2: {
      title: "《候鸟》预告片",
      premise: "移民二代在两种文化之间寻找自己的位置，如同候鸟，永远在迁徙，永远找不到真正的家。",
      hook: "一群候鸟飞过灰色天空，画外音：「我妈说，家在那边。我爸说，家在这边。我不知道家在哪里。」",
      conflict: "主角在两种语言、两种文化、两种期待之间撕裂——在父母的故乡是外国人，在自己的出生地也是外国人。",
      twist: "候鸟不是没有家，候鸟的家，是整个天空。",
      resolution: "主角站在两国边界，第一次不再选择，而是张开双臂——「我是候鸟。」",
      segments: [
        { id: 1, name: "序幕", goal: "建立诗意氛围，引入核心隐喻", duration: "0-30s", productPlacement: "候鸟意象贯穿", synopsis: "候鸟飞翔，画外音，身份困境引入", color: "#6B7280" },
        { id: 2, name: "冲突", goal: "展现文化撕裂，情感张力", duration: "30-75s", productPlacement: "双文化场景对比", synopsis: "两种文化碰撞，家庭矛盾，身份迷失", color: "#B45309" },
        { id: 3, name: "顿悟", goal: "主题升华，情感释放", duration: "75-90s", productPlacement: "候鸟意象回归", synopsis: "边界顿悟，接受自我，候鸟宣言", color: "#047857" },
      ],
    },
    step3: {
      characters: [{ id: 1, name: "林明", role: "主角", desc: "25岁移民二代，在中美两种文化之间长大，外表平静内心充满矛盾，正在寻找自己的身份认同", tags: ["移民二代", "双文化", "内省型"], voice: "平静深沉", img: "https://readdy.ai/api/search-image?query=young%20asian%20american%20man%20thoughtful%20expression%20portrait%20cinematic%20lighting%20identity%20cultural%20duality%20authentic%20photography&width=200&height=260&seq=char08&orientation=portrait" }],
      scenes: [
        { id: 101, name: "候鸟迁徙天空", type: "室外 · 黄昏", lighting: "金色黄昏光", mood: "诗意 · 自由", camera: "仰拍 · 慢镜头", segment: "Segment 1 · 序幕", desc: "大片天空，候鸟群飞，金色黄昏，诗意开场", img: "https://readdy.ai/api/search-image?query=birds%20flock%20migration%20dramatic%20sky%20golden%20hour%20sunset%20silhouette%20cinematic%20wide%20shot%20poetic%20atmospheric%20art%20film%20photography&width=320&height=200&seq=scene11&orientation=landscape" },
        { id: 102, name: "两个家的对比", type: "室内 · 日间", lighting: "对比光线", mood: "撕裂 · 矛盾", camera: "分屏 · 对比剪辑", segment: "Segment 2 · 冲突", desc: "两个不同文化风格的家庭空间，对比剪辑", img: "https://readdy.ai/api/search-image?query=two%20different%20cultural%20home%20interiors%20contrast%20split%20screen%20chinese%20american%20family%20living%20room%20cinematic%20photography&width=320&height=200&seq=scene12&orientation=landscape" },
      ],
      products: [{ id: 201, name: "候鸟意象", placement: "核心视觉符号", cameraHint: "慢镜头 + 仰拍 + 剪影", style: "诗意自然 · 自由象征", segment: "全片贯穿", img: "https://readdy.ai/api/search-image?query=birds%20silhouette%20flight%20sky%20dramatic%20cinematic%20art%20photography%20poetic%20symbol%20freedom%20migration&width=240&height=180&seq=prod07&orientation=landscape" }],
    },
    overview: {
      duration: "90s", format: "单条预告片", ratio: "16:9", style: "诗意 · 艺术", visual: "写实电影感", market: "国际电影节",
      plotSummary: "移民二代在两种文化之间寻找自己的位置，如同候鸟，永远在迁徙。候鸟不是没有家，候鸟的家，是整个天空。",
      segments: [
        { id: 1, name: "S1 · 序幕", duration: "30s", color: "#6B7280", img: "https://readdy.ai/api/search-image?query=cinematic%20birds%20sky%20golden%20hour%20dramatic%20art%20film%20vertical%20portrait%20poetic&width=240&height=420&seq=ov13&orientation=portrait" },
        { id: 2, name: "S2 · 冲突", duration: "45s", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20young%20man%20two%20cultures%20identity%20conflict%20emotional%20portrait%20vertical%20art%20film&width=240&height=420&seq=ov14&orientation=portrait" },
        { id: 3, name: "S3 · 顿悟", duration: "15s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20man%20arms%20open%20border%20freedom%20birds%20sky%20vertical%20art%20film%20emotional%20climax&width=240&height=420&seq=ov15&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20independent%20film%20final%20frame%20birds%20sky%20man%20silhouette%20vertical%20portrait%20art%20film&width=180&height=320&seq=final05&orientation=portrait",
      resolution: "1920 × 1080", fps: "24fps",
    },
  },
  {
    id: "case-06",
    genre: "个人播客",
    industry: "内容创作",
    market: "小红书 & 播客平台",
    title: "《一个人的城市》",
    desc: "个人播客视频化改造，将音频内容转化为情绪短视频，订阅量增长 340%，单集播放破50万",
    duration: "3min",
    platform: "小红书 & Spotify",
    style: "个人叙事",
    color: "#7C3AED",
    img: "https://readdy.ai/api/search-image?query=podcast%20recording%20studio%20microphone%20warm%20lighting%20intimate%20personal%20space%20cozy%20aesthetic%20creator%20content%20minimal%20desk%20setup&width=480&height=300&seq=sdcase06&orientation=landscape",
    create: { projectName: "个人播客视频化改造", duration: "60s", format: "series", plotStyles: ["emotion"], visualStyle: "cinematic", ratio: "9:16" },
    step1: {
      productName: "《一个人的城市》播客",
      brandName: "林夏播客",
      category: "食品饮料",
      targetMarket: ["全球"],
      targetUser: "22-35岁独居都市青年",
      sellingPoints: ["真实个人经历", "情感共鸣叙事", "城市孤独议题", "治愈系内容"],
      useScene: "通勤、睡前、独处时刻",
      brandTone: "真实、温柔、有力量、不孤单",
      parsedSummary: "以个人真实经历为素材的播客内容，聚焦都市独居青年的孤独与成长，通过情感共鸣建立忠实听众群体。",
      parsedSellingPoints: ["真实个人经历分享", "情感共鸣叙事风格", "城市孤独议题深度", "治愈系内容定位"],
      parsedSceneKeywords: ["城市夜景", "独居空间", "咖啡馆", "通勤路上", "窗边时光"],
      parsedStyleKeywords: ["真实温柔", "个人叙事", "情感共鸣", "治愈力量"],
      imgs: [
        "https://readdy.ai/api/search-image?query=podcast%20microphone%20desk%20setup%20warm%20lighting%20cozy%20creator%20space%20minimal%20aesthetic%20recording&width=160&height=160&seq=s1img12&orientation=squarish",
        "https://readdy.ai/api/search-image?query=city%20night%20view%20window%20alone%20urban%20lifestyle%20photography%20cozy%20interior%20warm%20light&width=160&height=160&seq=s1img13&orientation=squarish",
      ],
    },
    step2: {
      title: "《一个人的城市》EP.23：「孤独不是病」",
      premise: "一个人住在城市里，不是因为没有选择，而是因为选择了自己。",
      hook: "画面：城市夜景，一盏灯。声音：「你有没有想过，孤独其实是一种能力？」",
      conflict: "回忆：刚来城市时的恐惧，不敢一个人吃饭，不敢一个人看电影，觉得孤独是一种失败。",
      twist: "某一天，一个人看完电影走出来，发现自己笑了——不是因为有人陪，而是因为那个故事只属于自己。",
      resolution: "「孤独不是病，是你和自己在一起的方式。」城市灯光，一个人，但不孤单。",
      segments: [
        { id: 1, name: "引入", goal: "建立情感共鸣，引发思考", duration: "0-1min", productPlacement: "城市夜景，个人空间", synopsis: "城市夜景，孤独命题引入，情感铺垫", color: "#7C3AED" },
        { id: 2, name: "回忆", goal: "展现成长历程，建立情感层次", duration: "1-2.5min", productPlacement: "城市场景，个人时刻", synopsis: "孤独恐惧，慢慢接受，关键转折", color: "#B45309" },
        { id: 3, name: "顿悟", goal: "主题升华，给听众力量", duration: "2.5-3min", productPlacement: "城市全景，个人特写", synopsis: "电影院顿悟，孤独新定义，治愈收尾", color: "#047857" },
      ],
    },
    step3: {
      characters: [{ id: 1, name: "林夏", role: "主播/主角", desc: "27岁独居女生，播客主理人，用声音记录城市生活，真实、温柔、有力量", tags: ["播客主播", "独居女生", "内容创作者"], voice: "温柔有力", img: "https://readdy.ai/api/search-image?query=young%20chinese%20woman%20podcast%20creator%20content%20creator%20portrait%20warm%20lighting%20authentic%20natural%20expression%20lifestyle%20photography&width=200&height=260&seq=char09&orientation=portrait" }],
      scenes: [
        { id: 101, name: "录音室", type: "室内 · 夜晚", lighting: "暖黄台灯光", mood: "专注 · 真实", camera: "麦克风特写 · 人物侧脸", segment: "Segment 1 · 引入", desc: "小而温馨的录音空间，麦克风，台灯，城市夜景窗外", img: "https://readdy.ai/api/search-image?query=podcast%20recording%20setup%20microphone%20warm%20desk%20lamp%20night%20window%20city%20view%20cozy%20intimate%20creator%20space&width=320&height=200&seq=scene13&orientation=landscape" },
        { id: 102, name: "城市街头", type: "室外 · 夜晚", lighting: "城市霓虹", mood: "孤独 · 自由", camera: "跟拍 · 城市全景", segment: "Segment 2 · 回忆", desc: "城市夜晚街头，霓虹灯光，一个人行走", img: "https://readdy.ai/api/search-image?query=city%20street%20night%20neon%20lights%20woman%20walking%20alone%20urban%20lifestyle%20photography%20cinematic%20moody%20atmosphere&width=320&height=200&seq=scene14&orientation=landscape" },
      ],
      products: [{ id: 201, name: "播客麦克风", placement: "录音场景核心道具", cameraHint: "特写 + 声波可视化", style: "专业简约 · 创作者美学", segment: "Segment 1 · Segment 3", img: "https://readdy.ai/api/search-image?query=podcast%20microphone%20close%20up%20warm%20light%20minimal%20desk%20setup%20creator%20aesthetic%20professional%20recording%20equipment&width=240&height=180&seq=prod08&orientation=landscape" }],
    },
    overview: {
      duration: "3min", format: "系列播客视频", ratio: "9:16", style: "个人叙事 · 情感", visual: "写实电影感", market: "小红书 & 播客平台",
      plotSummary: "一个人住在城市里，不是因为没有选择，而是因为选择了自己。孤独不是病，是你和自己在一起的方式。",
      segments: [
        { id: 1, name: "S1 · 引入", duration: "1min", color: "#7C3AED", img: "https://readdy.ai/api/search-image?query=cinematic%20podcast%20creator%20recording%20night%20city%20view%20warm%20light%20vertical%20personal%20content&width=240&height=420&seq=ov16&orientation=portrait" },
        { id: 2, name: "S2 · 回忆", duration: "1.5min", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20woman%20city%20street%20night%20alone%20walking%20urban%20lifestyle%20vertical%20personal%20narrative&width=240&height=420&seq=ov17&orientation=portrait" },
        { id: 3, name: "S3 · 顿悟", duration: "30s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20woman%20city%20lights%20night%20window%20alone%20peaceful%20healing%20vertical%20personal%20content&width=240&height=420&seq=ov18&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20podcast%20personal%20content%20final%20frame%20woman%20city%20night%20warm%20light%20vertical%20portrait&width=180&height=320&seq=final06&orientation=portrait",
      resolution: "1080 × 1920", fps: "24fps",
    },
  },
  {
    id: "case-07",
    genre: "动漫短片",
    industry: "动漫创作",
    market: "B站 & 海外",
    title: "《小狐狸的城市》",
    desc: "2D动漫风格短片，以小狐狸为主角讲述城市适应故事，B站首发播放量破200万，弹幕密度极高",
    duration: "5min",
    platform: "B站 & YouTube",
    style: "动漫治愈",
    color: "#EA580C",
    img: "https://readdy.ai/api/search-image?query=cute%20anime%20fox%20character%20city%20urban%20adventure%20illustration%202d%20animation%20style%20colorful%20vibrant%20japanese%20anime%20aesthetic%20kawaii&width=480&height=300&seq=sdcase07&orientation=landscape",
    create: { projectName: "小狐狸城市动漫短片", duration: "60s", format: "series", plotStyles: ["comedy", "emotion"], visualStyle: "animation", ratio: "16:9" },
    step1: {
      productName: "《小狐狸的城市》动漫 IP",
      brandName: "橙光动画",
      category: "宠物用品",
      targetMarket: ["全球"],
      targetUser: "15-30岁动漫爱好者、都市青年",
      sellingPoints: ["原创 IP 形象", "治愈系叙事", "城市适应主题", "高质量 2D 动画"],
      useScene: "B站追番、YouTube 观看、IP 衍生品",
      brandTone: "可爱、治愈、有深度、温暖",
      parsedSummary: "以小狐狸为主角的原创动漫 IP，通过城市适应故事传递治愈与温暖，目标受众为动漫爱好者和都市青年。",
      parsedSellingPoints: ["原创可爱 IP 形象", "治愈系城市叙事", "高质量 2D 动画制作", "深度情感共鸣内容"],
      parsedSceneKeywords: ["城市街头", "便利店", "地铁站", "公园", "屋顶"],
      parsedStyleKeywords: ["日系动漫", "治愈温暖", "可爱深度", "城市美学"],
      imgs: [
        "https://readdy.ai/api/search-image?query=cute%20fox%20character%202d%20animation%20illustration%20colorful%20city%20background%20anime%20style%20kawaii&width=160&height=160&seq=s1img14&orientation=squarish",
        "https://readdy.ai/api/search-image?query=anime%20city%20street%20scene%20illustration%20colorful%20vibrant%20urban%20background%202d%20animation%20style&width=160&height=160&seq=s1img15&orientation=squarish",
      ],
    },
    step2: {
      title: "《小狐狸的城市》第一集：「第一天」",
      premise: "来自森林的小狐狸第一次来到城市，一切都是新奇的，也是令人困惑的。",
      hook: "小狐狸站在城市入口，眼睛睁得大大的，背包上写着：「我来了，城市。」",
      conflict: "地铁、便利店、红绿灯……每一样都让小狐狸困惑，但每一次困惑都遇见了善意的人类。",
      twist: "小狐狸在屋顶看城市夜景，突然明白：城市不是森林，但城市里也有温暖。",
      resolution: "小狐狸在日记本上写：「第一天，我喜欢这里。」",
      segments: [
        { id: 1, name: "到达", goal: "建立角色，引入城市世界", duration: "0-1.5min", productPlacement: "城市场景全景展示", synopsis: "小狐狸到达城市，第一印象，好奇探索", color: "#EA580C" },
        { id: 2, name: "探索", goal: "展现城市生活，喜剧冲突", duration: "1.5-4min", productPlacement: "各种城市场景", synopsis: "地铁冒险，便利店奇遇，善意相遇", color: "#B45309" },
        { id: 3, name: "顿悟", goal: "情感升华，主题呈现", duration: "4-5min", productPlacement: "城市夜景，温暖收尾", synopsis: "屋顶夜景，城市理解，日记收尾", color: "#047857" },
      ],
    },
    step3: {
      characters: [
        { id: 1, name: "小狐狸", role: "主角", desc: "来自森林的小狐狸，好奇心旺盛，善良纯真，用动物的视角观察城市生活", tags: ["原创 IP", "动漫角色", "治愈系"], voice: "清脆可爱", img: "https://readdy.ai/api/search-image?query=cute%20fox%20character%20illustration%202d%20animation%20style%20colorful%20kawaii%20anime%20portrait%20clean%20background&width=200&height=260&seq=char10&orientation=portrait" },
        { id: 2, name: "便利店阿姨", role: "配角", desc: "便利店的中年女性，第一个对小狐狸展示善意的城市人", tags: ["配角", "善意代表", "城市人"], voice: "温和亲切", img: "https://readdy.ai/api/search-image?query=anime%20style%20middle%20aged%20woman%20convenience%20store%20worker%20kind%20expression%20illustration%202d%20animation&width=200&height=260&seq=char11&orientation=portrait" },
      ],
      scenes: [
        { id: 101, name: "城市入口", type: "室外 · 日间", lighting: "明亮阳光", mood: "好奇 · 期待", camera: "全景 + 小狐狸特写", segment: "Segment 1 · 到达", desc: "繁华城市入口，高楼大厦，小狐狸站在路口", img: "https://readdy.ai/api/search-image?query=anime%20city%20entrance%20illustration%20colorful%20vibrant%20urban%20skyline%202d%20animation%20style%20bright%20daylight&width=320&height=200&seq=scene15&orientation=landscape" },
        { id: 102, name: "便利店", type: "室内 · 日间", lighting: "便利店白光", mood: "困惑 · 惊喜", camera: "货架视角 + 表情特写", segment: "Segment 2 · 探索", desc: "明亮的便利店，各种商品，小狐狸困惑地看着", img: "https://readdy.ai/api/search-image?query=anime%20convenience%20store%20interior%20illustration%20colorful%20products%20shelves%202d%20animation%20style%20bright%20interior&width=320&height=200&seq=scene16&orientation=landscape" },
        { id: 103, name: "城市屋顶", type: "室外 · 夜晚", lighting: "城市夜景灯光", mood: "感悟 · 温暖", camera: "全景城市 + 小狐狸剪影", segment: "Segment 3 · 顿悟", desc: "城市屋顶，夜景全景，小狐狸坐在边缘看城市", img: "https://readdy.ai/api/search-image?query=anime%20rooftop%20city%20night%20view%20illustration%20colorful%20lights%202d%20animation%20style%20fox%20silhouette&width=320&height=200&seq=scene17&orientation=landscape" },
      ],
      products: [{ id: 201, name: "小狐狸背包", placement: "角色标志性道具", cameraHint: "特写 + 背包细节", style: "可爱森林风 · 原创设计", segment: "全片贯穿", img: "https://readdy.ai/api/search-image?query=cute%20fox%20backpack%20illustration%202d%20animation%20style%20colorful%20kawaii%20design%20product&width=240&height=180&seq=prod09&orientation=landscape" }],
    },
    overview: {
      duration: "5min", format: "系列动漫", ratio: "16:9", style: "动漫 · 治愈", visual: "动画风格", market: "B站 & YouTube",
      plotSummary: "来自森林的小狐狸第一次来到城市，在好奇与困惑中遇见善意，最终在屋顶夜景中明白：城市不是森林，但城市里也有温暖。",
      segments: [
        { id: 1, name: "S1 · 到达", duration: "1.5min", color: "#EA580C", img: "https://readdy.ai/api/search-image?query=anime%20fox%20character%20city%20arrival%20illustration%20colorful%20vertical%202d%20animation&width=240&height=420&seq=ov19&orientation=portrait" },
        { id: 2, name: "S2 · 探索", duration: "2.5min", color: "#B45309", img: "https://readdy.ai/api/search-image?query=anime%20fox%20convenience%20store%20adventure%20illustration%20colorful%20vertical%202d%20animation&width=240&height=420&seq=ov20&orientation=portrait" },
        { id: 3, name: "S3 · 顿悟", duration: "1min", color: "#047857", img: "https://readdy.ai/api/search-image?query=anime%20fox%20rooftop%20city%20night%20view%20illustration%20colorful%20vertical%202d%20animation%20healing&width=240&height=420&seq=ov21&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=anime%20fox%20character%20city%20night%20final%20frame%20illustration%20colorful%20vertical%20portrait%202d%20animation&width=180&height=320&seq=final07&orientation=portrait",
      resolution: "1920 × 1080", fps: "24fps",
    },
  },
  {
    id: "case-08",
    genre: "运动广告",
    industry: "运动品牌",
    market: "全球市场",
    title: "《破界》",
    desc: "运动品牌励志短片，以马拉松选手突破极限为主线，激励内容完播率 82%，品牌搜索量提升 5x",
    duration: "60s",
    platform: "YouTube & Instagram",
    style: "励志激励",
    color: "#0F766E",
    img: "https://readdy.ai/api/search-image?query=athlete%20running%20marathon%20dramatic%20cinematic%20sports%20photography%20motion%20blur%20determination%20powerful%20energy%20sunrise%20dramatic%20sky%20professional%20advertisement&width=480&height=300&seq=sdcase08&orientation=landscape",
    create: { projectName: "运动品牌全球励志短片", duration: "60s", format: "single", plotStyles: ["conflict", "emotion"], visualStyle: "cinematic", ratio: "16:9" },
    step1: {
      productName: "APEX 竞速跑鞋",
      brandName: "APEX Sports",
      category: "运动健康",
      targetMarket: ["北美", "欧洲", "全球"],
      targetUser: "18-40岁运动爱好者、马拉松跑者",
      sellingPoints: ["碳纤维底板技术", "超轻量设计", "专业马拉松认证", "突破个人极限"],
      useScene: "马拉松比赛、日常训练、极限挑战",
      brandTone: "激励、专业、突破、无畏",
      parsedSummary: "专业竞速跑鞋品牌，以碳纤维底板技术为核心，主打超轻量设计和专业马拉松认证，目标用户为追求突破极限的运动爱好者。",
      parsedSellingPoints: ["碳纤维底板专利技术", "超轻量 180g 设计", "专业马拉松赛事认证", "突破个人极限理念"],
      parsedSceneKeywords: ["马拉松赛道", "日出晨跑", "极限冲刺", "汗水特写", "终点线"],
      parsedStyleKeywords: ["激励专业", "突破无畏", "运动美学", "力量感"],
      imgs: [
        "https://readdy.ai/api/search-image?query=running%20shoes%20product%20photography%20clean%20white%20background%20studio%20lighting%20premium%20sports%20brand%20carbon%20fiber%20sole&width=160&height=160&seq=s1img16&orientation=squarish",
        "https://readdy.ai/api/search-image?query=marathon%20runner%20feet%20close%20up%20running%20shoes%20motion%20blur%20track%20sports%20photography&width=160&height=160&seq=s1img17&orientation=squarish",
      ],
    },
    step2: {
      title: "《破界》",
      premise: "每个人都有一道墙，那道墙叫做「我做不到」。",
      hook: "马拉松第 38 公里，选手停下来，双手撑膝，画外音：「我的身体在说停下来。」",
      conflict: "闪回：训练时的伤痛，家人的担心，朋友的质疑，所有人都说「你不行」。",
      twist: "选手抬起头，看见终点线的方向，脚下的跑鞋发出轻微的碳纤维声——「但我的脚，还在动。」",
      resolution: "冲过终点线，选手跪地，不是因为痛，而是因为感谢。品牌 Slogan：「APEX. 破界。」",
      segments: [
        { id: 1, name: "极限时刻", goal: "制造紧张感，引发共鸣", duration: "0-15s", productPlacement: "跑鞋隐性植入", synopsis: "第38公里，极限边缘，内心独白", color: "#0F766E" },
        { id: 2, name: "闪回", goal: "建立情感背景，强化动机", duration: "15-45s", productPlacement: "训练场景跑鞋展示", synopsis: "训练伤痛，质疑声音，坚持动机", color: "#B45309" },
        { id: 3, name: "突破", goal: "情感高潮，品牌价值呈现", duration: "45-60s", productPlacement: "跑鞋特写 + 品牌收尾", synopsis: "重新起跑，冲过终点，品牌升华", color: "#047857" },
      ],
    },
    step3: {
      characters: [{ id: 1, name: "Marcus", role: "主角", desc: "32岁业余马拉松选手，普通上班族，用跑步对抗生活压力，正在挑战人生第一个全马", tags: ["业余选手", "普通人", "励志型"], voice: "坚定有力", img: "https://readdy.ai/api/search-image?query=male%20marathon%20runner%20athletic%20determined%20expression%20portrait%20sports%20photography%20cinematic%20lighting%20authentic&width=200&height=260&seq=char12&orientation=portrait" }],
      scenes: [
        { id: 101, name: "马拉松赛道", type: "室外 · 日出", lighting: "金色日出光", mood: "紧张 · 坚持", camera: "跟拍 · 低角度", segment: "Segment 1 · 极限时刻", desc: "城市马拉松赛道，日出金光，选手在极限边缘", img: "https://readdy.ai/api/search-image?query=marathon%20race%20city%20street%20sunrise%20golden%20light%20runners%20dramatic%20cinematic%20sports%20photography%20wide%20shot&width=320&height=200&seq=scene18&orientation=landscape" },
        { id: 102, name: "训练场", type: "室外 · 清晨", lighting: "清晨蓝调光", mood: "痛苦 · 坚持", camera: "特写汗水 · 动作慢镜", segment: "Segment 2 · 闪回", desc: "训练场，清晨，汗水，伤痛，坚持的身影", img: "https://readdy.ai/api/search-image?query=athlete%20training%20track%20morning%20blue%20hour%20sweat%20determination%20close%20up%20sports%20photography%20cinematic&width=320&height=200&seq=scene19&orientation=landscape" },
        { id: 103, name: "终点线", type: "室外 · 日间", lighting: "强烈阳光", mood: "释放 · 升华", camera: "慢镜冲线 · 仰拍", segment: "Segment 3 · 突破", desc: "马拉松终点线，人群欢呼，选手冲线瞬间", img: "https://readdy.ai/api/search-image?query=marathon%20finish%20line%20crossing%20athlete%20triumph%20crowd%20cheering%20dramatic%20cinematic%20sports%20photography%20slow%20motion&width=320&height=200&seq=scene20&orientation=landscape" },
      ],
      products: [{ id: 201, name: "APEX 竞速跑鞋", placement: "脚部特写 + 冲线瞬间", cameraHint: "低角度特写 + 碳纤维细节", style: "专业竞速 · 碳纤维科技", segment: "Segment 1 · Segment 3", img: "https://readdy.ai/api/search-image?query=professional%20running%20shoes%20carbon%20fiber%20sole%20product%20photography%20clean%20background%20sports%20brand%20premium%20athletic%20footwear&width=240&height=180&seq=prod10&orientation=landscape" }],
    },
    overview: {
      duration: "60s", format: "单条广告", ratio: "16:9", style: "励志 · 激励", visual: "写实电影感", market: "全球市场",
      plotSummary: "每个人都有一道墙，那道墙叫做「我做不到」。马拉松第38公里，选手在极限边缘，脚下的跑鞋还在动——APEX. 破界。",
      segments: [
        { id: 1, name: "S1 · 极限", duration: "15s", color: "#0F766E", img: "https://readdy.ai/api/search-image?query=cinematic%20marathon%20runner%20extreme%20limit%20sunrise%20dramatic%20vertical%20sports%20advertisement&width=240&height=420&seq=ov22&orientation=portrait" },
        { id: 2, name: "S2 · 闪回", duration: "30s", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20athlete%20training%20sweat%20determination%20flashback%20vertical%20sports%20advertisement&width=240&height=420&seq=ov23&orientation=portrait" },
        { id: 3, name: "S3 · 突破", duration: "15s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20marathon%20finish%20line%20triumph%20athlete%20crossing%20vertical%20sports%20brand%20advertisement&width=240&height=420&seq=ov24&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20sports%20brand%20advertisement%20final%20frame%20athlete%20triumph%20finish%20line%20vertical%20portrait&width=180&height=320&seq=final08&orientation=portrait",
      resolution: "1920 × 1080", fps: "60fps",
    },
  },
  {
    id: "case-09",
    genre: "产品发布",
    industry: "科技品牌",
    market: "全球科技市场",
    title: "《未来已来》",
    desc: "AI 智能手表发布短片，以未来感叙事展示产品功能，发布当日播放量破千万，预购量超预期 3x",
    duration: "90s",
    platform: "YouTube & 官网",
    style: "科技未来感",
    color: "#1D4ED8",
    img: "https://readdy.ai/api/search-image?query=futuristic%20smartwatch%20technology%20product%20advertisement%20cinematic%20dark%20background%20glowing%20interface%20premium%20tech%20brand%20sophisticated%20minimal%20design&width=480&height=300&seq=sdcase09&orientation=landscape",
    create: { projectName: "AI智能手表全球发布短片", duration: "60s", format: "single", plotStyles: ["suspense", "emotion"], visualStyle: "3d", ratio: "16:9" },
    step1: {
      productName: "NEXUS Watch Pro",
      brandName: "NEXUS Tech",
      category: "3C 数码",
      targetMarket: ["北美", "欧洲", "日本/韩国"],
      targetUser: "25-45岁科技爱好者、商务人士",
      sellingPoints: ["AI 健康预测引擎", "72小时续航", "钛合金表壳", "实时翻译功能"],
      useScene: "商务会议、运动健康、日常生活",
      brandTone: "未来感、精准、智能、突破边界",
      parsedSummary: "AI 驱动的智能手表品牌，以健康预测引擎和实时翻译为核心功能，目标用户为追求科技生活方式的商务人士和科技爱好者。",
      parsedSellingPoints: ["AI 健康预测引擎", "72小时超长续航", "航空级钛合金表壳", "实时多语言翻译"],
      parsedSceneKeywords: ["未来城市", "科技界面", "健康数据", "商务场景", "极简美学"],
      parsedStyleKeywords: ["科技未来感", "精准智能", "突破边界", "极简高端"],
      imgs: [
        "https://readdy.ai/api/search-image?query=smartwatch%20product%20photography%20dark%20background%20glowing%20interface%20premium%20tech%20brand%20titanium%20case%20minimal%20design&width=160&height=160&seq=s1img18&orientation=squarish",
        "https://readdy.ai/api/search-image?query=smartwatch%20wrist%20wearing%20business%20man%20dark%20background%20technology%20advertisement%20premium&width=160&height=160&seq=s1img19&orientation=squarish",
      ],
    },
    step2: {
      title: "《未来已来》",
      premise: "你的手腕上，有一个比你更了解你的 AI。",
      hook: "黑屏，一个心跳声，屏幕亮起：「检测到异常心率，建议休息。」画外音：「它知道，在你知道之前。」",
      conflict: "主角在高压工作中忽视身体信号，直到手表的 AI 预警让他意识到：科技不是冷漠的，科技是关心你的。",
      twist: "会议室里，手表实时翻译日语对话，主角第一次感受到：语言不再是边界，世界变小了。",
      resolution: "产品全貌展示，Slogan：「NEXUS Watch Pro. 未来已来。」",
      segments: [
        { id: 1, name: "悬念引入", goal: "制造科技感悬念，引发好奇", duration: "0-20s", productPlacement: "手表界面特写", synopsis: "心跳声，AI 预警，科技感引入", color: "#1D4ED8" },
        { id: 2, name: "功能展示", goal: "展示核心功能，建立产品价值", duration: "20-70s", productPlacement: "各功能场景展示", synopsis: "健康预测，实时翻译，商务场景", color: "#B45309" },
        { id: 3, name: "品牌收尾", goal: "品牌价值升华，预购引导", duration: "70-90s", productPlacement: "产品全貌 + 品牌信息", synopsis: "产品展示，Slogan，预购 CTA", color: "#047857" },
      ],
    },
    step3: {
      characters: [{ id: 1, name: "Alex", role: "主角", desc: "35岁跨国公司高管，高压工作，追求效率，是 NEXUS 手表的理想用户", tags: ["商务人士", "科技爱好者", "高效型"], voice: "沉稳专业", img: "https://readdy.ai/api/search-image?query=business%20executive%20man%20professional%20portrait%20dark%20background%20technology%20advertisement%20sophisticated%20confident%20expression&width=200&height=260&seq=char13&orientation=portrait" }],
      scenes: [
        { id: 101, name: "未来感办公室", type: "室内 · 日间", lighting: "冷白科技光", mood: "高效 · 专注", camera: "特写手表 · 全景办公", segment: "Segment 1 · 悬念引入", desc: "极简未来感办公室，大屏幕，冷白光线，科技氛围", img: "https://readdy.ai/api/search-image?query=futuristic%20minimal%20office%20interior%20cold%20white%20light%20large%20screens%20technology%20atmosphere%20cinematic%20photography&width=320&height=200&seq=scene21&orientation=landscape" },
        { id: 102, name: "国际会议室", type: "室内 · 日间", lighting: "专业会议灯光", mood: "专业 · 突破", camera: "手表翻译界面特写", segment: "Segment 2 · 功能展示", desc: "国际会议室，多国人士，手表实时翻译场景", img: "https://readdy.ai/api/search-image?query=international%20business%20meeting%20room%20professional%20people%20conference%20technology%20smartwatch%20translation%20scene%20cinematic&width=320&height=200&seq=scene22&orientation=landscape" },
      ],
      products: [{ id: 201, name: "NEXUS Watch Pro", placement: "全片核心主角", cameraHint: "表盘特写 + 界面动效 + 佩戴全貌", style: "钛合金极简 · 科技感界面", segment: "全片贯穿", img: "https://readdy.ai/api/search-image?query=smartwatch%20titanium%20case%20dark%20background%20glowing%20interface%20product%20photography%20premium%20tech%20brand%20minimal%20design%20close%20up&width=240&height=180&seq=prod11&orientation=landscape", images: ["https://readdy.ai/api/search-image?query=smartwatch%20titanium%20case%20dark%20background%20glowing%20interface%20product%20photography%20premium%20tech%20brand%20minimal%20design%20close%20up&width=240&height=180&seq=prod11&orientation=landscape", "https://readdy.ai/api/search-image?query=smartwatch%20wrist%20wearing%20business%20man%20dark%20background%20technology%20advertisement%20premium%20side%20view&width=240&height=180&seq=prod11b&orientation=landscape"] }],
    },
    overview: {
      duration: "90s", format: "单条广告", ratio: "16:9", style: "科技 · 未来感", visual: "3D 渲染", market: "全球科技市场",
      plotSummary: "你的手腕上，有一个比你更了解你的 AI。NEXUS Watch Pro 以 AI 健康预测和实时翻译突破边界——未来已来。",
      segments: [
        { id: 1, name: "S1 · 悬念", duration: "20s", color: "#1D4ED8", img: "https://readdy.ai/api/search-image?query=cinematic%20smartwatch%20screen%20heartbeat%20alert%20dark%20background%20technology%20vertical%20advertisement&width=240&height=420&seq=ov25&orientation=portrait" },
        { id: 2, name: "S2 · 功能", duration: "50s", color: "#B45309", img: "https://readdy.ai/api/search-image?query=cinematic%20smartwatch%20features%20health%20data%20translation%20business%20vertical%20technology%20advertisement&width=240&height=420&seq=ov26&orientation=portrait" },
        { id: 3, name: "S3 · 品牌", duration: "20s", color: "#047857", img: "https://readdy.ai/api/search-image?query=cinematic%20smartwatch%20product%20reveal%20brand%20slogan%20dark%20background%20vertical%20technology%20advertisement&width=240&height=420&seq=ov27&orientation=portrait" },
      ],
      finalImg: "https://readdy.ai/api/search-image?query=cinematic%20tech%20product%20advertisement%20final%20frame%20smartwatch%20dark%20background%20vertical%20portrait%20brand%20commercial&width=180&height=320&seq=final09&orientation=portrait",
      resolution: "1920 × 1080", fps: "60fps",
    },
  },
];

export type DemoCaseConfig = DemoCase;
export const demoCases = DEMO_CASES;
