/** Module location owns the deployment base: works at / and /Cinema/. */
export const siteBase = new URL('../', import.meta.url).pathname;
export const siteURL = (path) => siteBase + path.replace(/^\/+/, '');
export function localPath(pathname = location.pathname) {
  if (!pathname.startsWith(siteBase)) return null;
  return '/' + pathname.slice(siteBase.length).replace(/\/$/, '');
}
