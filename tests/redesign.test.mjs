import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
test('disc derivatives are full-cover square prints, not inset portrait labels', async () => {
  for (const id of ['possible-love', 'poetry']) {
    const disc = sharp(`assets/${id}/disc.webp`);
    const meta = await disc.metadata();
    assert.equal(meta.width, 768);
    assert.equal(meta.height, 768);
    const { data, info } = await disc
      .resize(32, 32)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const colors = new Set();
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 12; x++)
        colors.add(
          data
            .subarray(
              (y * 32 + x) * info.channels,
              (y * 32 + x) * info.channels + 3,
            )
            .toString('hex'),
        );
    assert.ok(
      colors.size > 80,
      'left side contains printed image detail rather than empty inset-label background',
    );
    const portrait = await sharp(`assets/${id}/poster.webp`).metadata();
    assert.ok(portrait.height > portrait.width);
  }
  const generator = await readFile('scripts/posters.mjs', 'utf8');
  assert.match(generator, /fit: 'cover'/);
  assert.doesNotMatch(generator, /composite/);
});
test('public navigation has only actual topic links and local licensed fonts', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.doesNotMatch(html, /tv-link|href="templates/);
  assert.match(html, /李沧东专题/);
  assert.match(html, /aria-controls="topic-menu"/);
  const css = await readFile('src/style.css', 'utf8');
  assert.doesNotMatch(css, /PPEiko|PPNeue/);
  assert.match(
    await readFile('assets/fonts/OFL.txt', 'utf8'),
    /SIL OPEN FONT LICENSE/,
  );
});

test('local Chinese font assets are bounded genuine WOFF2 with both upstream notices', async () => {
  let bytes = 0;
  for (const name of ['cinema-serif', 'cinema-sans']) {
    const font = await readFile(`assets/fonts/${name}.woff2`);
    assert.equal(font.subarray(0, 4).toString(), 'wOF2');
    bytes += font.length;
  }
  assert.ok(bytes < 250000);
  assert.match(
    await readFile('assets/fonts/Sans-OFL.txt', 'utf8'),
    /SIL OPEN FONT LICENSE/,
  );
});

test('each club film has two attributed real stills distinct from its portrait poster', async () => {
  const sources = JSON.parse(
    await readFile('assets/film-stills-sources.json', 'utf8'),
  );
  for (const id of ['possible-love', 'poetry']) {
    const entries = sources.images.filter((i) => i.film === id);
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.match(entry.sourcePage, /netflix.com\/tudum|festival-cannes.com/);
      assert.match(entry.file, /still-[12]\.webp$/);
      const image = await sharp(entry.file).metadata();
      assert.ok(image.width > image.height && image.width >= 1200);
      assert.match(entry.rights, /not established/);
    }
  }
});
