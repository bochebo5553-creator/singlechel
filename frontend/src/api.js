const BASE = '';

let initData = '';
try { if (window.Telegram?.WebApp?.initData) initData = window.Telegram.WebApp.initData; } catch {}

const headers = () => {
  const h = { 'Content-Type': 'application/json' };
  if (initData) h['X-Telegram-Init-Data'] = initData;
  const token = window.__SC_TOKEN || localStorage.getItem('sc_token');
  if (token) h['X-Auth-Token'] = token;
  if (!initData && !token) h['X-Dev-User-Id'] = '123456789';
  return h;
};

export const api = {
  async get(url) { const r = await fetch(BASE+url, {headers:headers()}); return r.json(); },
  async post(url, body) { const r = await fetch(BASE+url, {method:'POST',headers:headers(),body:JSON.stringify(body)}); return r.json(); },
  async put(url, body) { const r = await fetch(BASE+url, {method:'PUT',headers:headers(),body:JSON.stringify(body)}); return r.json(); },
  async del(url) { const r = await fetch(BASE+url, {method:'DELETE',headers:headers()}); return r.json(); },
  async upload(url, fd) {
    const h = {};
    if (initData) h['X-Telegram-Init-Data'] = initData;
    const token = window.__SC_TOKEN || localStorage.getItem('sc_token');
    if (token) h['X-Auth-Token'] = token;
    if (!initData && !token) h['X-Dev-User-Id'] = '123456789';
    const r = await fetch(BASE+url, {method:'POST',headers:h,body:fd}); return r.json();
  }
};

export function getTelegramUser() {
  try { if (window.Telegram?.WebApp?.initDataUnsafe?.user) return window.Telegram.WebApp.initDataUnsafe.user; } catch {}
  return { id: 123456789, first_name: 'Тестовый', last_name: 'Пользователь', username: 'testuser' };
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.getDate()} ${months[d.getMonth()]} • ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function initTelegram() {
  try { const tg = window.Telegram?.WebApp; if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#0f0f13'); tg.setBackgroundColor('#0f0f13'); } } catch {}
}
