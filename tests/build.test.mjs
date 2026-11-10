import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, access } from 'node:fs/promises';
import { catalogue } from '../src/data.js';
test('static build has explicit root/subpath entrypoints and only intended runtime directories', async () => {
  for (const base of ['/', '/Cinema/']) {
    execFileSync(process.execPath, ['scripts/build.mjs'], {
      env: { ...process.env, BASE_PATH: base },
    });
    assert.deepEqual(
      (await readdir('dist')).sort(),
      [
        '.nojekyll',
        '404.html',
        'NOTICE.md',
        'assets',
        'index.html',
        'production',
        'src',
        'vendor',
      ].sort(),
    );
    for (const entry of [
      'index.html',
      '404.html',
      ...catalogue.map((f) => `production/${f.id}/index.html`),
    ]) {
      const html = await readFile(`dist/${entry}`, 'utf8');
      assert.ok(html.includes(`<base href="${base}">`));
      assert.ok(html.includes('src="src/app.js"'));
      assert.ok(!html.includes('study-dialog'));
    }
    for (const f of catalogue)
      for (const key of ['art', 'poster', 'still', 'secondStill', 'vector'])
        if (f[key])
          await access(
            'dist/assets/' + new URL(f[key]).pathname.split('/assets/')[1],
          );
  }
  assert.throws(() =>
    execFileSync(process.execPath, ['scripts/build.mjs'], {
      env: { ...process.env, BASE_PATH: '//evil.example/' },
      stdio: 'pipe',
    }),
  );
});
