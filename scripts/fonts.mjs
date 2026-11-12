// Opt-in network maintenance command; build/test never fetch fonts.
// Local WOFF2 subsets cover current content plus interface labels, with upstream license notices.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
const sources = [
  'index.html',
  ...(await readdir('src'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => `src/${f}`),
];
const BASE =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz·—–“”‘’《》，。、：；？！（）「」';
const charset = async (paths) =>
  [
    ...new Set(
      (await Promise.all(paths.map((path) => readFile(path, 'utf8')))).join(
        '',
      ) + BASE,
    ),
  ]
    .filter((c) => c.codePointAt(0) >= 32)
    .sort()
    .join('');
const characters = await charset(sources);
// The serif is a fallback for interface copy only; interview text is set in kai and sans.
const interfaceCharacters = await charset(
  sources.filter((path) => path !== 'src/interviews.js'),
);
// Latin-only faces: CJK in the request would only lengthen the URL.
const latin = [...characters].filter((c) => c.codePointAt(0) < 0x2100).join('');
/**
 * The Fonts API ignores `text` beyond a URL-length limit, so reading faces are fetched as
 * two files split at a fixed code point; CSS pairs them with matching unicode-range rules.
 */
const SPLIT = 0x6400;
const halves = (text) => [
  ['', [...text].filter((c) => c.codePointAt(0) < SPLIT).join('')],
  ['-2', [...text].filter((c) => c.codePointAt(0) >= SPLIT).join('')],
];
// Brush display face only covers titles, headings and navigation labels.
const { catalogue } = await import('../src/data.js');
const displayLabels =
  'CINEMA 李沧东专题 影片目录 故事 背景 访谈 荣誉 片名 下一部 待揭晓 ？「」“” 观影会 影像与生活 导演 编剧 主演 年份 国家 地区 类型 语言 片长 剧照 海报 0123456789';
const display = [
  ...new Set(
    displayLabels +
      catalogue
        .filter((f) => f.category === 'films')
        .flatMap((f) => [
          f.title,
          f.contextTitle,
          f.interview?.pull?.text ?? '',
        ])
        .join(''),
  ),
]
  .sort()
  .join('');
const agent =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// [family, weights, output name prefix, google/fonts path, license file, license output, characters]
const fonts = [
  [
    'Noto Serif SC',
    [400],
    'cinema-serif',
    'ofl/notoserifsc',
    'OFL.txt',
    'OFL.txt',
    interfaceCharacters,
  ],
  [
    'Noto Sans SC',
    [400],
    'cinema-sans',
    'ofl/notosanssc',
    'OFL.txt',
    'Sans-OFL.txt',
    characters,
    true,
  ],
  [
    'Ma Shan Zheng',
    [400],
    'cinema-brush',
    'ofl/mashanzheng',
    'OFL.txt',
    'Brush-OFL.txt',
    display,
  ],
  [
    'LXGW WenKai TC',
    [400],
    'cinema-kai',
    'ofl/lxgwwenkaitc',
    'OFL.txt',
    'Kai-OFL.txt',
    characters,
    true,
  ],
  [
    'Caveat',
    [400, 700],
    'cinema-hand',
    'ofl/caveat',
    'OFL.txt',
    'Hand-OFL.txt',
    latin,
  ],
  [
    'Rock Salt',
    [400],
    'cinema-marker',
    'apache/rocksalt',
    'LICENSE.txt',
    'Marker-LICENSE.txt',
    latin,
  ],
];
await mkdir('assets/fonts', { recursive: true });
for (const [
  family,
  weights,
  name,
  upstream,
  license,
  output,
  text,
  split = false,
] of fonts) {
  for (const weight of weights)
    for (const [suffix, part] of split ? halves(text) : [['', text]]) {
      const cssURL = `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@${weight}&text=${encodeURIComponent(part)}`;
      const css = await fetch(cssURL, { headers: { 'User-Agent': agent } });
      if (!css.ok) throw new Error(`${family} CSS: ${css.status}`);
      const urls = [...(await css.text()).matchAll(/url\(([^)]+)\)/g)].map(
        (m) => m[1],
      );
      if (urls.length !== 1)
        throw new Error(`${family}: expected one subset, got ${urls.length}`);
      const response = await fetch(urls[0]);
      if (!response.ok)
        throw new Error(`${family} download: ${response.status}`);
      const font = Buffer.from(await response.arrayBuffer());
      if (font.subarray(0, 4).toString() !== 'wOF2' || font.length > 250000)
        throw new Error(`${family}: expected a bounded WOFF2 subset`);
      const file = (weights.length > 1 ? `${name}-${weight}` : name) + suffix;
      await writeFile(`assets/fonts/${file}.woff2`, font);
      console.log(`${family} ${weight}${suffix}: ${font.length} bytes`);
    }
  const notice = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/${upstream}/${license}`,
  );
  if (!notice.ok) throw new Error(`${family} license: ${notice.status}`);
  await writeFile(`assets/fonts/${output}`, await notice.text());
}
