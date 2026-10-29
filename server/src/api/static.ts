import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};
const API_PREFIXES = ['/api/', '/f/', '/webhooks/', '/healthz'];

/** Serve the built web app from the same origin as the API (no CORS, cookies just work). SPA uses hash routes, so only "/" needs index.html. */
export function serveStatic(app: FastifyInstance, dir: string): boolean {
  const root = resolve(dir);
  if (!existsSync(join(root, 'index.html'))) return false;
  app.setNotFoundHandler((req, reply) => {
    const path = decodeURIComponent((req.url.split('?')[0]) || '/');
    if (req.method !== 'GET' || API_PREFIXES.some((p) => path.startsWith(p))) return reply.code(404).send({ error: 'not_found' });
    let file = resolve(root, '.' + normalize('/' + path));
    if (file !== root && !file.startsWith(root + sep)) return reply.code(404).send({ error: 'not_found' }); // path traversal guard
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    const immutable = file.includes(`${sep}assets${sep}`);
    return reply.header('content-type', MIME[extname(file)] ?? 'application/octet-stream')
      .header('cache-control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache').send(readFileSync(file));
  });
  return true;
}
