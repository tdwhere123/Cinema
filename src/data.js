/** Club summaries are independent overviews; sources are linked on each film page. */
import { interviews } from './interviews.js';
const entries = [
  {
    id: 'possible-love',
    title: '可能的爱',
    year: '2026',
    // Venice world premiere, September 2026.
    released: '2026-09',
    cast: ['全度妍', '薛景求', '赵汝贞', '赵寅成'],
    runtime: '167 分钟',
    genre: '关系剧情',
    source:
      'https://www.netflix.com/tudum/articles/possible-love-cast-release-date-photos',
    summary:
      '焊工浩锡失业已经两年。那场罢工结束后，他几乎不再说话，酒越喝越多，连为被解雇工人开设的心理辅导也坐不下去。妻子美玉守着这个家，和年幼的儿子哲一起，过着平静却紧绷的日子。',
    story: [
      '一场葬礼让他们遇见了另一对夫妻：正在拍摄失业工人纪录片的导演艺智，和她富有、笑意难以捉摸的丈夫尚宇。美玉答应走到镜头前，浩锡也勉强接受了采访。',
      '拍摄一天天推进，两个家庭的生活越缠越紧。美玉与艺智日渐亲近，又不由自主地被尚宇吸引；在采访与回忆之间，浩锡在那场罢工里留下的伤一点点浮现。压抑的情感、隐秘的欲望与阶层的落差，在记录与被记录之间慢慢失去了界线。',
    ],
    writers: ['李沧东', '吴贞美'],
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
    context: [
      '《可能的爱》是李沧东继 2018 年《燃烧》之后相隔八年的长片，由他与《燃烧》的合作编剧吴贞美共同编剧，Netflix 出品。影片于 2026 年 9 月在第 83 届威尼斯国际电影节主竞赛单元世界首映，获评审团大奖银狮奖；9 月 23 日在韩国院线上映，11 月 6 日于 Netflix 全球上线，并被选为韩国角逐第 99 届奥斯卡最佳国际影片的代表作。',
      '故事的起点更早。十多年前，李沧东就写好了一个关于被解雇工人的剧本，进入前期筹备后又将它搁置。他不确定自己是否有资格讲述这些人的故事，也不确定能否如实呈现他们的生活。直到吴贞美提议让一对拍纪录片的夫妻进入故事，他才找到切入的位置：借一个讲述他人故事的人，去追问讲述本身的伦理与姿态。',
      '片中虚构的 SP 重工罢工，与 2009 年双龙汽车平泽工厂工人长达 77 天的占厂罢工高度相似：大规模裁员、工会拒绝、工人封锁厂区，最终被警察强行驱散。李沧东只说灵感来自“十年前一家大公司的罢工”。现实中，被解雇的工人多年难以再就业，最后一批 35 人直到 2020 年才回到岗位，距罢工开始已过去 11 年。',
      '这也是李沧东与全度妍（《密阳》）、薛景求（《薄荷糖》《绿洲》）的重逢。他说彼此早有信任，这次拍摄几乎没有需要碰撞的地方；而看着全度妍的表演，他重新认识了美玉这个人物。',
    ],
    contextSources: [
      {
        label: 'Netflix Tudum',
        url: 'https://www.netflix.com/tudum/articles/possible-love-cast-release-date-photos',
      },
      {
        label: 'Korea Herald',
        url: 'https://www.koreaherald.com/article/10889220',
      },
      {
        label: '体育京乡',
        url: 'https://sports.khan.co.kr/en/article/202611061314007',
      },
      {
        label: 'Korea Times',
        url: 'https://www.koreatimes.co.kr/entertainment/films/20260903/tangled-gazes-lee-chang-dong-explores-desire-and-class-in-possible-love',
      },
    ],
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
    // South Korean theatrical release.
    released: '2010-05-13',
    cast: ['尹静姬', '李大卫'],
    runtime: '139 分钟',
    genre: '剧情',
    source: 'https://www.festival-cannes.com/en/f/poetry/',
    summary:
      '六十多岁的美子住在汉江边的一座小城，独自带着读初中的外孙宗旭。她靠给一位中风的老人做护工补贴家用，总戴着花帽、穿着得体，对世界保有少女般的好奇。',
    story: [
      '一次偶然，她报名了文化馆的诗歌课。老师说，写诗最要紧的是“好好地看”。于是美子开始端详苹果、树影与花，在习以为常的日常里寻找第一行诗句。也是在这时，医生告诉她，她出现了阿尔茨海默病的早期症状。',
      '一名女中学生投江自尽。美子渐渐得知，宗旭和另外五个男孩牵涉其中。男孩们的父亲们打算凑钱与女孩的母亲私下和解，也要美子拿出她的那一份。在筹钱、上课与遗忘之间，她要为这份重量写出一首诗。',
    ],
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
      {
        award: '最佳影片 · 最佳女主角',
        event: '第 47 届韩国大钟奖',
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
    context: [
      '《诗》由李沧东编剧并执导，是他继《密阳》之后的第五部长片，摄影为金铉锡。影片入围 2010 年第 63 届戛纳电影节主竞赛单元并获最佳编剧奖；同年在韩国大钟奖拿下包括最佳影片在内的四个奖项，尹静姬获最佳女主角。',
      '故事起于一桩真实的案件：韩国一座小城里，一群未成年人性侵了一名少女。李沧东想讲这件事，却不愿走寻常的路，让受害者艰难维权，或让记者、警察去追查真相。直到一个六十多岁、第一次想写诗、却面对阿尔茨海默病的女人出现在他脑中，故事才真正成形。片名则是他在日本旅行时，看着酒店电视里河流、飞鸟与撒网渔夫的风景画面，忽然想到的。',
      '美子由尹静姬饰演。她是 1960、70 年代韩国影坛最具代表性的女演员之一，《诗》是她自 1994 年后相隔十六年重返银幕之作。李沧东说，美子少女般的天真，也正是尹静姬本人的特质；后来他才知道，尹静姬的本名就叫美子，在韩语里，这个名字含着“美”的意思。',
      '戛纳官方简介这样形容美子：她在花帽与盛装之下保有好奇心，学着留意那些原本习焉不察的日常事物，却在生活的裂隙中，面对超出想象的现实重量。',
    ],
    contextSources: [
      {
        label: 'Festival de Cannes',
        url: 'https://www.festival-cannes.com/en/f/poetry/',
      },
      {
        label: 'Electric Sheep',
        url: 'https://www.electricsheepmagazine.co.uk/2011/07/27/poetry-interview-with-lee-chang-dong/',
      },
      {
        label: 'HanCinema',
        url: 'https://www.hancinema.net/-poetry-sweeps-47th-daejong-film-awards-25749.html',
      },
    ],
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
const resolve = (path) => new URL('..' + path, import.meta.url).href;
// Resolve only asset fields, not arbitrary strings or external URLs.
// Films read in release order; ISO dates (or their prefixes) sort as strings.
export const catalogue = entries
  .map((f) => ({
    ...f,
    interview: interviews[f.id] || null,
    ...Object.fromEntries(
      ['art', 'still', 'secondStill', 'poster', 'vector']
        .filter((k) => f[k])
        .map((k) => [k, resolve(f[k])]),
    ),
  }))
  .sort((a, b) => a.released.localeCompare(b.released));

/**
 * Selections not yet announced: a blank disc in the gallery, without a page of its own.
 * Revealing one means moving it into `entries` with its real data.
 */
export const upcoming = [
  { id: 'tba-1', tba: true, art: resolve('/assets/tba/disc.webp') },
];
