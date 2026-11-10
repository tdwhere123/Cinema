/** True static hosting: Python's file server has no SPA rewrite or app routing. */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp = await mkdtemp(path.join(os.tmpdir(), 'cinema-static-'));
async function run(command, args, env = {}) {
  await new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    p.on('error', reject);
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
try {
  for (const [i, base] of ['/', '/Cinema/'].entries()) {
    await run(process.execPath, ['scripts/build.mjs'], { BASE_PATH: base });
    const root = path.join(temp, String(i));
    await mkdir(root);
    await cp('dist', base === '/' ? root : path.join(root, 'Cinema'), {
      recursive: true,
    });
    const port = 4280 + i;
    const origin = `http://127.0.0.1:${port}`;
    const server = spawn(
      'python3',
      [
        '-m',
        'http.server',
        String(port),
        '--bind',
        '127.0.0.1',
        '--directory',
        root,
      ],
      { stdio: 'ignore' },
    );
    try {
      for (let j = 0; j < 50; j++) {
        try {
          await fetch(origin + base);
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.equal(
        (await fetch(origin + base + 'not-a-route')).status,
        404,
        'no SPA fallback',
      );
      for (const file of [
        '.git/config',
        '.codegraph/metadata.json',
        '.do-it/诗.png',
        'tests/project.test.mjs',
        'AGENTS.md',
        'server.mjs',
        'docs/restoration.md',
        'scripts/build.mjs',
      ])
        assert.equal((await fetch(origin + base + file)).status, 404, file);
      for (const suite of ['restoration', 'fidelity', 'content', 'redesign'])
        await run(process.execPath, [`tests/${suite}.browser.mjs`], {
          CINEMA_URL: origin + base.replace(/\/$/, ''),
          STATIC_HOST: '1',
        });
    } finally {
      server.kill();
    }
  }
  console.log(
    'PASS: root and /Cinema/ dist on plain file hosting (no rewrites).',
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
