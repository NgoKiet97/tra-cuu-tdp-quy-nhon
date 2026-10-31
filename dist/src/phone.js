// Dữ liệu SĐT gốc không nằm trong các tệp công khai.
const decode = value => Uint8Array.from(atob(value), ch => ch.charCodeAt(0));

async function decryptNumbers(password) {
  if (!globalThis.crypto?.subtle) {
    const error = new Error('Trình duyệt cần kết nối an toàn để giải mã SĐT.');
    error.name = 'InsecureContextError';
    throw error;
  }
  const response = await fetch('./data/phones.enc.json');
  if (!response.ok) throw new Error('Không tải được dữ liệu SĐT.');
  const data = await response.json();
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({
    name: 'PBKDF2', salt: decode(data.salt),
    iterations: data.iterations, hash: 'SHA-256',
  }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(data.iv) }, key, decode(data.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export async function copyPhoneNumber(value, modal) {
  // execCommand runs synchronously during the click, including when the
  // Clipboard API is missing or denied. Keep the textarea inside the dialog.
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.readOnly = true;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
  modal.append(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch { /* Try the modern API below. */ }
  textarea.remove();
  if (!copied && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch { /* The visible number can still be copied manually. */ }
  }
  return copied;
}

export function initPhoneAccess(contacts) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './src/phone.css';
  document.head.append(link);

  const modal = document.createElement('dialog');
  modal.className = 'phone-dialog';
  modal.setAttribute('aria-labelledby', 'phone-title');
  modal.innerHTML = `<form class="phone-form">
    <div class="phone-head"><h2 id="phone-title">Xem SĐT liên hệ</h2>
    <button type="button" class="phone-close" aria-label="Đóng">×</button></div>
    <p class="phone-for" aria-live="polite"></p>
    <label for="phone-password">Mật khẩu</label>
    <div class="phone-password-field"><input id="phone-password" type="password" autocomplete="off" required>
    <button type="button" class="phone-password-toggle" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></div>
    <div class="phone-controls"><button class="primary" type="submit">Xem SĐT</button></div>
    <p class="phone-message" role="status" aria-live="polite"></p>
    <div class="phone-reveal" hidden><span class="phone-number"></span>
    <button type="button" class="action phone-copy">Copy SĐT</button></div>
  </form>`;
  document.body.append(modal);

  let currentTdp = '';
  const password = modal.querySelector('#phone-password');
  const message = modal.querySelector('.phone-message');
  const reveal = modal.querySelector('.phone-reveal');
  const number = modal.querySelector('.phone-number');
  const title = modal.querySelector('.phone-for');
  const toggle = modal.querySelector('.phone-password-toggle');
  const copyButton = modal.querySelector('.phone-copy');
  let copyResetTimer;
  let requestId = 0;

  function resetPassword() {
    password.value = '';
    password.type = 'password';
    toggle.textContent = 'Hiện';
    toggle.setAttribute('aria-label', 'Hiện mật khẩu');
    toggle.setAttribute('aria-pressed', 'false');
  }
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Ẩn' : 'Hiện';
    toggle.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    toggle.setAttribute('aria-pressed', String(visible));
    password.focus();
  });

  function addButton(container, tdp) {
    if (!container || !/^TDP\d+$/.test(tdp) || container.querySelector('.phone-open')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phone-open';
    button.textContent = 'Xem SĐT';
    button.dataset.phoneTdp = tdp;
    container.append(button);
  }
  function sync() {
    document.querySelectorAll('#results .result').forEach(card => {
      addButton(card.querySelector('.contact'), card.querySelector('.tdp')?.textContent.trim() || '');
    });
    const detail = document.querySelector('#p2contact');
    const selected = document.querySelector('#tdpSelect')?.value;
    if (selected && selected !== 'all') addButton(detail, 'TDP' + selected);
    document.querySelectorAll('#allHistoryBody tr').forEach(row => {
      addButton(row.querySelector('.tdp-cell span'), row.querySelector('.tdp-cell strong')?.textContent.trim() || '');
    });
  }
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  sync();

  document.addEventListener('click', event => {
    const button = event.target.closest('.phone-open');
    if (!button) return;
    requestId++;
    currentTdp = button.dataset.phoneTdp;
    title.textContent = `Liên hệ: ${contacts[currentTdp] || '—'} - ${currentTdp}`;
    resetPassword();
    message.textContent = '';
    number.textContent = '';
    reveal.hidden = true;
    clearTimeout(copyResetTimer);
    copyButton.textContent = 'Copy SĐT';
    modal.showModal();
    password.focus();
  });
  function close() {
    requestId++;
    resetPassword();
    number.textContent = '';
    reveal.hidden = true;
    modal.close();
  }
  modal.querySelector('.phone-close').addEventListener('click', close);
  modal.addEventListener('close', () => {
    requestId++;
    resetPassword();
    number.textContent = '';
    reveal.hidden = true;
  });
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const submission = ++requestId;
    const tdp = currentTdp;
    message.textContent = 'Đang kiểm tra…';
    reveal.hidden = true;
    number.textContent = '';
    try {
      const numbers = await decryptNumbers(password.value);
      if (submission !== requestId) return;
      resetPassword();
      if (!numbers[tdp]) throw new Error('Thiếu SĐT');
      number.textContent = numbers[tdp];
      reveal.hidden = false;
      message.textContent = '';
    } catch (error) {
      if (submission !== requestId) return;
      resetPassword();
      message.textContent = error.name === 'OperationError'
        ? 'mật khẩu không đúng'
        : error.name === 'InsecureContextError'
        ? 'Vui lòng mở app bằng HTTPS hoặc localhost để xem SĐT.'
        : 'Không thể hiển thị SĐT. Vui lòng liên hệ Tác giả.';
    }
  });
  copyButton.addEventListener('click', async () => {
    const value = number.textContent.trim();
    if (!value) return;
    if (await copyPhoneNumber(value, modal)) {
      message.textContent = '';
      copyButton.textContent = 'Đã copy';
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => { copyButton.textContent = 'Copy SĐT'; }, 1500);
    } else {
      const selection = document.getSelection();
      const range = document.createRange();
      range.selectNodeContents(number);
      selection?.removeAllRanges();
      selection?.addRange(range);
      message.textContent = 'Không thể copy tự động. SĐT đã được chọn, hãy nhấn Ctrl+C.';
    }
  });
}
