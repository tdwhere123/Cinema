/** 零依赖开发服务器。支持原站 /production/:slug 路由。 */
import http from 'node:http';
import { realpathSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const realRoot = realpathSync(root);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.md': 'text/plain',
};
const publicFiles = new Set(['/index.html']);
const publicDirs = ['/src/', '/assets/', '/vendor/'];
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '127.0.0.1';

function isInside(parent, file) {
  const rel = path.relative(parent, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function toUrlPath(absPath) {
  return '/' + path.relative(realRoot, absPath).split(path.sep).join('/');
}

function isPublicAsset(urlPath) {
  if (publicFiles.has(urlPath)) return true;
  if (!publicDirs.some((dir) => urlPath.startsWith(dir))) return false;
  return urlPath.split('/').every((seg) => seg === '' || !seg.startsWith('.'));
}

function sitePath(req) {
  let pathname = decodeURIComponent(
    new URL(req.url, 'http://localhost').pathname,
  );
  if (pathname.includes('\0')) return null;
  if (pathname === '/' || /^\/production\/[a-z0-9-]+\/?$/.test(pathname)) {
    return '/index.html';
  }
  const normalized = path.posix.normalize(pathname);
  if (!normalized.startsWith('/') || normalized.includes('\0')) return null;
  return normalized;
}

http
  .createServer(async (req, res) => {
    try {
      const urlPath = sitePath(req);
      if (!urlPath || !isPublicAsset(urlPath)) {
        res.writeHead(404).end('Not found');
        return;
      }
      const file = path.resolve(root, `.${urlPath}`);
      if (!isInside(root, file)) {
        res.writeHead(403).end();
        return;
      }
      const realFile = await realpath(file);
      if (
        !isInside(realRoot, realFile) ||
        !isPublicAsset(toUrlPath(realFile))
      ) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(realFile);
      res
        .writeHead(200, {
          'Content-Type':
            types[path.extname(realFile)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        .end(data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  })
  .listen(port, host, () => console.log(`Open http://localhost:${port}`));
