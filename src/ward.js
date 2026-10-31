import { trackEvent } from './analytics.js';
const app = document.querySelector('.app');
const coming = document.querySelector('#ward-coming');
const banner = document.querySelector('#ward-banner');
const title = document.querySelector('#main-title');
const buttons = [...document.querySelectorAll('[data-switch-ward]')];

function switchWard(ward) {
  if (app.dataset.ward !== ward) trackEvent('switch_area', { ward });
  const isSouth = ward === 'quy-nhon-nam';
  app.dataset.ward = isSouth ? 'quy-nhon-nam' : 'quy-nhon';
  coming.hidden = !isSouth;
  banner.src = isSouth ? './assets/quy-nhon-nam-header-approved.png' : './assets/quy-nhon-header-approved.png';
  banner.width = 2048;
  banner.height = isSouth ? 682 : 688;
  const label = isSouth ? 'Tra cứu Khu phố phường Quy Nhơn Nam' : 'Tra cứu Tổ dân phố phường Quy Nhơn';
  banner.alt = label;
  title.textContent = label;
  document.title = `${label} – V4.0.0`;
  buttons.forEach(button => {
    const active = button.dataset.switchWard === app.dataset.ward;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  window.scrollTo(0, 0);
}
buttons.forEach(button => button.addEventListener('click', () => switchWard(button.dataset.switchWard)));
document.querySelector('.ward-back').addEventListener('click', () => switchWard('quy-nhon'));
