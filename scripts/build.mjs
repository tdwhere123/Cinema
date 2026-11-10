import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { catalogue } from '../src/data.js';
const base = process.env.BASE_PATH || '/';
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
  throw new Error('BASE_PATH must be / or /project/');
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const dir of ['src', 'assets', 'vendor'])
  await cp(dir, `dist/${dir}`, { recursive: true });
for (const file of ['NOTICE.md']) await cp(file, `dist/${file}`);
const html = (await readFile('index.html', 'utf8')).replace(
  '<base href="/">',
  `<base href="${base}">`,
);
for (const route of ['', ...catalogue.map((f) => `production/${f.id}`)]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await writeFile(`dist/${route ? route + '/' : ''}index.html`, html);
}
await writeFile('dist/404.html', html);
await writeFile('dist/.nojekyll', '');
console.log(`Built dist for ${base}`);
