import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
try {
  await fs.access(path.join(root, 'index.html'));
} catch {
  console.error('Chưa có bản xem thử. Hãy chạy npm run build trước.');
  process.exit(1);
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!target.startsWith(root + path.sep)) throw new Error('Bad path');
    const data = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(4174, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4174/'));
