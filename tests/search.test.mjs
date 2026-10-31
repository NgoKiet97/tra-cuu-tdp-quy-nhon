import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createSearchEngine } from '../src/search.js';

const records = JSON.parse(await fs.readFile(new URL('../data/records.json', import.meta.url))).records;
const aliases = JSON.parse(await fs.readFile(new URL('../data/aliases.json', import.meta.url)));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/đ/g,'d').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim();
const endpoint = v => {
  v = norm(v).replace(/\s/g, '');
  const parts = v.split('/'), last = parts.pop() || '';
  const m = last.match(/^(\d+)([a-z]*)$/);
  return { prefix: parts.join('/'), num: m ? +m[1] : null, suffix: m ? m[2] : '', raw: v };
};
const isReview = r => {
  const x = norm([r.status,r.issue,r.note,r.range].join(' '));
  return x.includes('can kiem tra') || x.includes('nguon khong ghi so nha') || norm(r.range) === 'x';
};
const isWhole = r => norm([r.range,r.update,r.note].join(' ')).includes('toan bo') && !isReview(r);
const engine = createSearchEngine(records, { norm, endpoint, isWhole, aliases });

test('Hoàng Cầm: ba đoạn lẻ và không khẳng định số chẵn', () => {
  for (const [n, kp, tdp] of [[1,'KP59','TDP22'],[13,'KP59','TDP22'],
    [15,'KP60','TDP21'],[47,'KP60','TDP21'],
    [49,'KP61','TDP21'],[95,'KP61','TDP21']]) {
    const result = engine.searchAddress(`${n} Hoàng Cầm`);
    assert.equal(result.mode, 'exact');
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].newKp, kp);
    assert.equal(result.rows[0].tdp, tdp);
  }
  assert.equal(engine.searchAddress('2 Hoàng Cầm').mode, 'noParity');
  assert.equal(engine.searchAddress('2 Hoàng Cầm').rows.length, 0);
});
test('Nguyễn Dữ và Nguyễn Du không bị nhập làm một', () => {
  assert.deepEqual(engine.searchAddress('2 Nguyễn Dữ').rows.map(r => r.tdp), ['TDP3']);
  assert.deepEqual(engine.searchAddress('2 Nguyễn Du').rows.map(r => r.tdp), ['TDP5']);
  assert.equal(engine.searchAddress('2 Nguyen Du').mode, 'ambiguousStreet');
});
test('Ngô Quyền ưu tiên số 58A và 58B đã chốt', () => {
  assert.deepEqual(engine.searchAddress('58A Ngô Quyền').rows.map(r => r.tdp), ['TDP7']);
  assert.deepEqual(engine.searchAddress('58B Ngô Quyền').rows.map(r => r.tdp), ['TDP6']);
});
test('Cảnh báo xung đột TDP cũ được giữ', () => {
  assert.deepEqual(new Set(engine.searchAddress('57 Nguyễn Chánh').rows.map(r=>r.tdp)),
    new Set(['TDP10','TDP9']));
});
test('Tên alias tìm đúng tên chính', () => {
  assert.equal(engine.searchAddress('1 Đường 1 Tháng 5').p.street, 'Đường 1/5');
});
