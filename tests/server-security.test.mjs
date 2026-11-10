import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function withServer(port, fn) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
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
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    child.kill();
  }
}

function assertDenied(route, r, body) {
  assert.notEqual(r.status, 200, route);
  assert.ok(
    r.status === 403 || r.status === 404,
    `${route} status ${r.status}`,
  );
  assert.equal(body.includes('a24-local-study'), false, route);
  assert.equal(body.includes('external-root-secret-token'), false, route);
  assert.equal(body.includes('dotfile-secret-token'), false, route);
}

test('HTTP server denies metadata, encoded traversal and symlink escape; serves JS/CSS/images and detail URLs', async () => {
  const port = 14840;
  let fixtureDir;
  let outsideDir;
  try {
    fixtureDir = await mkdtemp(path.join(root, 'assets', 'hygiene-'));
    outsideDir = await mkdtemp(path.join(os.tmpdir(), 'cinema-hygiene-'));
    await writeFile(path.join(fixtureDir, '.env'), 'dotfile-secret-token\n');
    await mkdir(path.join(fixtureDir, '.git'));
    await writeFile(
      path.join(fixtureDir, '.git', 'config'),
      'dotfile-secret-token\n',
    );
    await symlink(
      path.join(root, 'package.json'),
      path.join(fixtureDir, 'inside-link'),
    );
    const outsideFile = path.join(outsideDir, 'secret.txt');
    await writeFile(outsideFile, 'external-root-secret-token\n');
    await symlink(outsideFile, path.join(fixtureDir, 'outside-link'));

    const fixtureUrl = `/assets/${path.basename(fixtureDir)}`;
    await withServer(port, async (base) => {
      const denied = [
        '/package.json',
        '/server.mjs',
        '/AGENTS.md',
        '/.git',
        '/.git/config',
        '/.do-it/PLAN.md',
        '/tests/project.test.mjs',
        '/%2e%2e%2fpackage.json',
        '/src/%2e%2e%2fpackage.json',
        '/assets/%2e%2e%2f.do-it/PLAN.md',
        `${fixtureUrl}/.env`,
        `${fixtureUrl}/.git/config`,
        `${fixtureUrl}/inside-link`,
        `${fixtureUrl}/outside-link`,
      ];
      for (const route of denied) {
        const r = await fetch(`${base}${route}`);
        assertDenied(route, r, await r.text());
      }

      const allowed = {
        '/src/app.js': 'text/javascript',
        '/src/style.css': 'text/css',
        '/assets/grain.svg': 'image/svg+xml',
        '/assets/poetry/disc.webp': 'image/webp',
        '/production/poetry': 'text/html',
      };
      for (const [route, type] of Object.entries(allowed)) {
        const r = await fetch(`${base}${route}`);
        assert.equal(r.status, 200, route);
        assert.equal(r.headers.get('content-type'), type, route);
      }
      assert.equal((await fetch(`${base}/src/no-such-file.js`)).status, 404);
    });
  } finally {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
    if (outsideDir) await rm(outsideDir, { recursive: true, force: true });
  }
});
