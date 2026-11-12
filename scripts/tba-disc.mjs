// Maintenance: render the shared blank disc for unannounced selections (assets/tba/disc.webp).
// A plain paper face: one brushed question mark beside the hub and a small vertical label,
// set in the site's own brush subset. Build/test never run this; it needs the dev Playwright browser.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';

const brush = `data:font/woff2;base64,${(
  await readFile('assets/fonts/cinema-brush.woff2')
).toString('base64')}`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Brush; src: url(${brush}) format('woff2'); }
html, body { margin: 0; width: 768px; height: 768px; }
body {
  position: relative; overflow: hidden;
  background:
    radial-gradient(circle at 38% 30%, rgba(255,255,255,.55), transparent 58%),
    radial-gradient(circle at 50% 50%, #ece7dc 0 46%, #e2dccd 100%);
}
/* Faint pressing rings, as on an unprinted disc. */
.rings { position: absolute; inset: 0; background:
  repeating-radial-gradient(circle at 50% 50%, rgba(60,50,35,.035) 0 1px, transparent 1px 7px); }
.grain { position: absolute; inset: 0; opacity: .5; mix-blend-mode: multiply; }
.mark {
  position: absolute; left: 196px; top: 384px;
  font: 440px/1 Brush; color: #1b1915; opacity: .9;
  transform: translate(-50%, -50%);
}
.label {
  position: absolute; left: 590px; top: 384px;
  writing-mode: vertical-rl; letter-spacing: .5em;
  font: 34px/1 Brush; color: #6d665a;
  transform: translate(-50%, -50%);
}
</style>
<div class="rings"></div>
<svg class="grain" width="768" height="768"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .14  0 0 0 .55 0"/></filter><rect width="768" height="768" filter="url(#n)"/></svg>
<div class="mark">？</div>
<div class="label">待揭晓</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  await mkdir('assets/tba', { recursive: true });
  await sharp(png).webp({ quality: 90 }).toFile('assets/tba/disc.webp');
} finally {
  await browser.close();
}
