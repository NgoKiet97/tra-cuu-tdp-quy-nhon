import test from 'node:test';
import assert from 'node:assert/strict';
import { copyPhoneNumber } from '../src/phone.js';

test('Sao chép SĐT khi Clipboard API không có hoặc bị từ chối', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let selected;
  const textarea = {
    value: '', style: {}, readOnly: false,
    setAttribute() {}, focus() {}, select() { selected = this.value; }, remove() {},
  };
  const modal = { append(element) { assert.equal(element, textarea); } };
  try {
    Object.defineProperty(globalThis, 'document', {
      configurable: true, value: {
        createElement() { return textarea; },
        execCommand(command) { assert.equal(command, 'copy'); return true; },
      },
    });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal(await copyPhoneNumber('0123456789', modal), true);
    assert.equal(selected, '0123456789');

    globalThis.document.execCommand = () => false;
    globalThis.navigator.clipboard = {
      async writeText(value) { assert.equal(value, '0987654321'); },
    };
    assert.equal(await copyPhoneNumber('0987654321', modal), true);

    globalThis.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    assert.equal(await copyPhoneNumber('0987654321', modal), false);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
