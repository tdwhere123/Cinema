import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { catalogue, upcoming } from '../src/data.js';
import { clubChapters } from '../src/club-page.js';
import { clamp, damp, layout, easeOut } from '../src/math.js';
const root = new URL('../', import.meta.url);
test('two unique club selections and no reference templates', () => {
  assert.equal(catalogue.length, 2);
  assert.equal(new Set(catalogue.map((f) => f.id)).size, 2);
  assert.ok(catalogue.every((f) => f.category === 'films'));
});
test('films are listed in release order', () => {
  for (const f of catalogue)
    assert.match(f.released, /^\d{4}(-\d{2}){0,2}$/, f.id);
  assert.deepEqual(
    catalogue.map((f) => f.id),
    ['poetry', 'possible-love'],
  );
});
test('unannounced selections are a blank disc with no title or page', async () => {
  assert.equal(upcoming.length, 1);
  for (const u of upcoming) {
    assert.equal(u.tba, true);
    assert.equal(u.title, undefined);
    assert.ok(!catalogue.some((f) => f.id === u.id));
    await access(new URL(u.art));
  }
});
test('story and background are multi-paragraph and every background source is linked', () => {
  const esc = (v) => String(v);
  for (const f of catalogue) {
    assert.ok(f.story.length >= 2, f.id);
    assert.ok(Array.isArray(f.context) && f.context.length >= 3, f.id);
    assert.ok(f.contextSources.length >= 2, f.id);
    const html = clubChapters(f, esc);
    for (const s of f.contextSources) {
      assert.equal(new URL(s.url).protocol, 'https:');
      assert.ok(html.includes(s.url), s.url);
    }
    assert.equal(
      (html.match(/class="story-more/g) || []).length,
      f.story.length,
    );
  }
});
test('interviews are cited and render as one chapter before the poster', () => {
  const esc = (v) => String(v);
  for (const f of catalogue) {
    const v = f.interview;
    assert.ok(v, `${f.id} has an interview`);
    assert.equal(new URL(v.url).protocol, 'https:');
    for (const k of ['outlet', 'author', 'date', 'title', 'translation'])
      assert.ok(v[k], `${f.id}:${k}`);
    assert.ok(v.qa.length >= 4 && v.qa.every((x) => x.q.length && x.a.length));
    assert.ok(v.pull.after < v.qa.length);
    const html = clubChapters(f, esc);
    const names = [...html.matchAll(/data-chapter="([^"]+)"/g)].map(
      (m) => m[1],
    );
    assert.deepEqual(names, ['故事', '背景', '剧照', '访谈', '海报']);
    assert.ok(html.includes(v.url));
    assert.equal((html.match(/class="pull-quote"/g) || []).length, 1);
    assert.doesNotMatch(html, /data-mark|data-reveal-text/);
  }
});
test('every production has usable fields and local assets', async () => {
  for (const f of catalogue) {
    for (const k of ['id', 'title', 'summary', 'source', 'art', 'still'])
      assert.ok(f[k], `${f.id}:${k}`);
    for (const k of [
      'directors',
      'cast',
      'writers',
      'reviews',
      'awards',
      'actions',
    ])
      assert.ok(Array.isArray(f[k]));
    for (const k of ['art', 'still', 'secondStill', 'vector'])
      if (f[k]) await access(new URL(f[k]));
    assert.equal(new URL(f.source).protocol, 'https:');
    if (f.category === 'films') {
      assert.equal(f.trailer, null);
      assert.deepEqual(f.reviews, []);
      assert.ok(f.poster);
    }
    if (f.trailer) assert.ok(new URL(f.trailer).hostname.includes('youtu'));
    for (const a of f.actions) assert.equal(new URL(a.url).protocol, 'https:');
  }
});
test('damping stays bounded and is frame-rate independent', () => {
  assert.equal(clamp(-1, 0, 11), 0);
  assert.equal(clamp(12, 0, 11), 11);
  let a = 0,
    b = 0;
  for (let i = 0; i < 60; i++) a = damp(a, 10, 8, 1 / 60);
  for (let i = 0; i < 120; i++) b = damp(b, 10, 8, 1 / 120);
  assert.ok(Math.abs(a - b) < 1e-10);
  assert.ok(a < 10 && a > 9);
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
});
test('layout finite across both categories and viewport modes', () => {
  for (const mobile of [true, false])
    for (let d = -12; d <= 12; d += 0.1) {
      const p = layout(d, mobile);
      for (const n of Object.values(p)) assert.ok(Number.isFinite(n));
      assert.ok(p.scale > 0);
    }
});
test('documentation and library license are bundled', async () => {
  for (const name of [
    'README.md',
    'NOTICE.md',
    'assets/fonts/OFL.txt',
    'vendor/THREE-LICENSE.txt',
    'assets/film-stills-sources.json',
  ])
    assert.ok((await readFile(new URL(name, root))).length);
});
test('HTTP server serves deep links/assets and returns missing file 404', async () => {
  const port = 14839;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server timeout')), 5000);
      child.once('error', reject);
      child.stdout.once('data', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    for (const route of [
      '/',
      ...catalogue.map((f) => '/production/' + f.id),
      '/src/app.js',
    ]) {
      const r = await fetch(`http://127.0.0.1:${port}${route}`);
      assert.equal(r.status, 200, route);
    }
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/no-such-file`)).status,
      404,
    );
  } finally {
    child.kill();
  }
});
