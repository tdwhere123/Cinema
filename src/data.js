/** Club summaries are independent overviews; sources are linked on each film page. */
const entries = [
  {
    id: 'possible-love',
    title: '可能的爱',
    year: '2026',
    cast: ['全度妍', '薛景求', '赵汝贞', '赵寅成'],
    runtime: '167 分钟',
    genre: '关系剧情',
    source:
      'https://www.netflix.com/tudum/articles/possible-love-cast-release-date-photos',
    summary:
      '一位失业工人与妻子，和一位纪录片导演及其伴侣相遇。两对夫妻的生活逐渐交织，隐秘的欲望与阶层差异也随之浮现。李沧东把镜头转向亲密关系中的距离与渴望。',
    writers: ['李沧东'],
    awards: [
      {
        award: '评审团大奖银狮奖',
        event: '2026 威尼斯国际电影节',
      },
      {
        award: '最佳国际影片 · 原创剧本 · 主角提名',
        event: '哥谭独立电影奖',
      },
      {
        award: '最佳国际影片韩国代表作',
        event: '第 99 届奥斯卡金像奖',
      },
      {
        award: '官方展映选片',
        event: '多伦多 · 纽约电影节',
      },
    ],
    category: 'films',
    directors: ['李沧东'],
    languages: '韩语',
    country: '韩国',
    art: '/assets/possible-love/disc.webp',
    poster: '/assets/possible-love/poster.webp',
    still: '/assets/possible-love/still-1.webp',
    secondStill: '/assets/possible-love/still-2.webp',
    stillCredit: 'Netflix Tudum · 官方影片剧照',
    stillCaption1: '美玉与家人在窗前——平静日常里的凝视与距离',
    stillCaption2: '夜色中的露天餐桌——两段生活在交谈与沉默间交汇',
    context:
      '《可能的爱》是李沧东继 2018 年《燃烧》后相隔八年的长片，于 2026 年威尼斯国际电影节世界首映并获评审团大奖银狮奖。Netflix 官方资料将故事起点放在一场葬礼后的重逢与一项关于失业工人的纪录片拍摄：全度妍饰演的美玉与薛景求饰演的丈夫浩石，同赵汝贞饰演的纪录片导演艺智、赵寅成饰演的尚宇形成鲜明对照，记录与被记录的关系逐渐渗入彼此的日常。',
    contextTitle: '在镜头的两侧',
    reviews: [],
    trailer: null,
    actions: [
      {
        label: '影片资料来源 ↗',
        url: 'https://www.netflix.com/tudum/articles/possible-love-cast-release-date-photos',
      },
    ],
  },
  {
    id: 'poetry',
    title: '诗',
    year: '2010',
    cast: ['尹静姬', '李大卫'],
    runtime: '139 分钟',
    genre: '剧情',
    source: 'https://www.festival-cannes.com/en/f/poetry/',
    summary:
      '与外孙相依为命的美子报名参加诗歌课，开始重新端详日常生活中的颜色、形状与细微之美。然而，一件残酷的事打破了她的生活。寻找诗句的过程，也成为她面对现实与责任的过程。',
    writers: ['李沧东'],
    awards: [
      {
        award: '最佳编剧奖',
        event: '2010 戛纳电影节',
      },
      {
        award: '主竞赛单元入围',
        event: '第 63 届戛纳电影节',
      },
    ],
    category: 'films',
    directors: ['李沧东'],
    languages: '韩语',
    country: '韩国',
    art: '/assets/poetry/disc.webp',
    poster: '/assets/poetry/poster.webp',
    still: '/assets/poetry/still-1.webp',
    secondStill: '/assets/poetry/still-2.webp',
    stillCredit: 'Festival de Cannes · 官方影片图集',
    stillCaption1: '汉江畔的日常观察——美子在习以为常的风物里寻找第一行诗句',
    stillCaption2: '静默的室内时刻——对美的凝视与无法回避的现实正面相逢',
    context:
      '《诗》由李沧东编剧并执导，尹静姬饰演美子，李大卫饰演她的外孙宗旭，金铉锡担任摄影。影片入围 2010 年第 63 届戛纳电影节主竞赛单元并获最佳编剧奖。戛纳官方图集与简介记录了美子在花帽与盛装之下的好奇心：她学习留意那些原本习焉不察的日常事物，却在生活的裂隙中面对超出想象的现实重量。',
    contextTitle: '从观看开始写诗',
    reviews: [],
    trailer: null,
    actions: [
      {
        label: '影片资料来源 ↗',
        url: 'https://www.festival-cannes.com/en/f/poetry/',
      },
    ],
  },
];
// Resolve only asset fields, not arbitrary strings or external URLs.
export const catalogue = entries.map((f) => ({
  ...f,
  ...Object.fromEntries(
    ['art', 'still', 'secondStill', 'poster', 'vector']
      .filter((k) => f[k])
      .map((k) => [k, new URL('..' + f[k], import.meta.url).href]),
  ),
}));
