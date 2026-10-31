import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excelPath = process.argv[2];
if (!excelPath) {
  console.error('Cách dùng: node tools/build-data.mjs /đường/dẫn/CSDL_V4.xlsx');
  process.exit(2);
}
const parsed = spawnSync('python3', [path.join(root, 'tools/read_excel.py'), excelPath], {
  encoding: 'utf8', maxBuffer: 15 * 1024 * 1024,
});
if (parsed.status !== 0) {
  console.error('Không đọc được CSDL V4:', parsed.stderr.trim());
  process.exit(1);
}
const { records, contacts, phones, history, aliases, issues } = JSON.parse(parsed.stdout);

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd').trim().replace(/\s+/g, ' ');
}
function exactKey(s) {
  return String(s || '').normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}
const streets = new Set(records.map(r => norm(r.street)));
const aliasesByNormalizedName = {};
for (const [name, target] of Object.entries(aliases)) {
  const key = norm(name);
  if (!streets.has(norm(target))) throw new Error(`Alias ${name} trỏ tới tên đường không có trong Master Data.`);
  if (streets.has(key) && key !== norm(target)) {
    throw new Error(`Alias ${name} đè lên tên một đường khác.`);
  }
  if (aliasesByNormalizedName[key] && aliasesByNormalizedName[key] !== target) {
    throw new Error(`Alias ${name} trỏ tới hai đường khác nhau.`);
  }
  aliasesByNormalizedName[key] = target;
  if (key.startsWith('duong ')) aliasesByNormalizedName[key.slice(6)] = target;
}
for (const r of records) {
  if (!contacts[r.tdp]) throw new Error(`Dòng ${r.id}: TDP ${r.tdp} chưa có liên hệ.`);
  if (!['Chẵn', 'Lẻ', 'Toàn bộ', 'Không xác định'].includes(r.parity)) {
    throw new Error(`Dòng ${r.id}: chẵn/lẻ không hợp lệ: ${r.parity}.`);
  }
}
// Chỉ các khoảng thuần số được kiểm tra giao nhau tự động. Hẻm/lô/hậu tố
// giữ đúng logic tra cứu hiện hành và cần quy tắc riêng khi chỉnh sau này.
const matches = new Map();
for (const r of records) {
  const m = String(r.range).match(/^(\d+)\s*[–—−-]\s*(\d+)$/);
  if (!m || !['Chẵn','Lẻ'].includes(r.parity)) continue;
  const lo = +m[1], hi = +m[2];
  if (lo > hi) throw new Error(`Dòng ${r.id}: khoảng đảo chiều.`);
  if ((lo % 2) !== (hi % 2) || (lo % 2) !== (r.parity === 'Chẵn' ? 0 : 1)) {
    throw new Error(`Dòng ${r.id}: khoảng không khớp chẵn/lẻ.`);
  }
  for (let n = lo; n <= hi; n += 2) {
    const key = `${n} ${exactKey(r.street)}`;
    if (!matches.has(key)) matches.set(key, new Set());
    matches.get(key).add(r.tdp);
  }
}
const allowed = new Set(['57 nguyễn chánh', '6 phan chu trinh', '72 trần cao vân',
  '25 đặng trần côn', '27 đặng trần côn']);
const clashes = [...matches].filter(([, tdps]) => tdps.size > 1).map(([key]) => key);
const unexpected = clashes.filter(key => !allowed.has(key));
if (unexpected.length) throw new Error(`Khoảng số thuộc nhiều TDP ngoài danh sách giữ nguyên: ${unexpected.slice(0, 12).join(', ')}`);
if (issues.length !== new Set(issues).size) throw new Error('Trùng vấn đề chờ xác minh.');

function secretFromTerminal() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error('Cần chạy trong terminal để nhập mật khẩu mã hóa SĐT.'));
      return;
    }
    let value = '';
    process.stdout.write('Nhập mật khẩu chung để mã hóa SĐT: ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = buf => {
      for (const str of buf.toString('utf8')) {
        if (str === '\r' || str === '\n') {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (str === '\u0003') {
          process.stdin.setRawMode(false);
          reject(new Error('Đã hủy'));
          return;
        }
        if (str === '\u007f') value = value.slice(0, -1);
        else value += str;
      }
    };
    process.stdin.on('data', onData);
  });
}
const passphrase = await secretFromTerminal();
if (!passphrase) throw new Error('Mật khẩu không được để trống.');
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const keyMaterial = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(passphrase),
  'PBKDF2', false, ['deriveKey']);
const iterations = 600_000;
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
  keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key,
  new TextEncoder().encode(JSON.stringify(phones)));
const b64 = bytes => Buffer.from(bytes).toString('base64');
const file = {
  version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA-256',
  iterations, salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext),
};
const dir = path.join(root, 'data');
await fs.mkdir(dir, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(dir, 'records.json'), JSON.stringify({ records })),
  fs.writeFile(path.join(dir, 'contacts.json'), JSON.stringify(contacts)),
  fs.writeFile(path.join(dir, 'history.json'), JSON.stringify(history)),
  fs.writeFile(path.join(dir, 'aliases.json'), JSON.stringify(aliasesByNormalizedName)),
  fs.writeFile(path.join(dir, 'phones.enc.json'), JSON.stringify(file)),
]);
console.log(`Đã tạo dữ liệu web: ${records.length} bản ghi, ${streets.size} đường, ${Object.keys(contacts).length} liên hệ, ${issues.length} vấn đề giữ nguyên.`);
