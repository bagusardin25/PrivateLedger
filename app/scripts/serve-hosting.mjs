// Serves app/dist with the same response headers Firebase Hosting will send
// (read from ../firebase.json), so the Content-Security-Policy can be checked
// locally before a deploy. Not a production server.
//
// Run: npm run build && npm run preview:hosting   (http://localhost:5180)

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(appDir, 'dist');
const hosting = JSON.parse(readFileSync(join(appDir, '..', 'firebase.json'), 'utf8')).hosting;
const port = Number(process.env.PORT ?? 5180);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** Firebase Hosting globs: "**" crosses folders, "*" stays inside one. */
function globToRegExp(glob) {
  const part = (text) => text.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const pattern = glob.replace(/^\//, '').split('**').map(part).join('.*');
  return new RegExp(`^/?${pattern}$`);
}

const rules = (hosting.headers ?? []).map((rule) => ({ test: globToRegExp(rule.source), headers: rule.headers }));

if (!existsSync(join(root, 'index.html'))) {
  console.error('app/dist is missing. Run "npm run build" first.');
  process.exit(1);
}

createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  let filePath = normalize(join(root, urlPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(root, 'index.html');

  const served = `/${filePath.slice(root.length + 1).replace(/\\/g, '/')}`;
  response.setHeader('Content-Type', TYPES[extname(filePath)] ?? 'application/octet-stream');
  for (const rule of rules) {
    if (rule.test.test(served)) for (const header of rule.headers) response.setHeader(header.key, header.value);
  }
  createReadStream(filePath).pipe(response);
}).listen(port, 'localhost', () => {
  console.log(`Serving app/dist with firebase.json headers at http://localhost:${port}`);
});
