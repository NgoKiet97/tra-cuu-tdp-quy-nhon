import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  await Promise.all(entries.map(entry => {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) return copyDirectory(from, to);
    if (entry.isFile()) return fs.copyFile(from, to);
    throw new Error(`Không hỗ trợ tệp trong source: ${from}`);
  }));
}
const required = ['records.json', 'contacts.json', 'history.json', 'aliases.json', 'phones.enc.json', 'boundaries.geojson'];
for (const name of required) {
  await fs.access(path.join(root, 'data', name));
}
await fs.mkdir(out, { recursive: true });
await Promise.all([
  fs.copyFile(path.join(root, 'index.html'), path.join(out, 'index.html')),
  copyDirectory(path.join(root, 'src'), path.join(out, 'src')),
  copyDirectory(path.join(root, 'assets'), path.join(out, 'assets')),
]);
await fs.mkdir(path.join(out, 'data'), { recursive: true });
for (const name of required) {
  await fs.copyFile(path.join(root, 'data', name), path.join(out, 'data', name));
}
console.log('Đã tạo dist/ cho V4. Không chứa Excel hoặc SĐT dạng rõ.');
