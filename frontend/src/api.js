const BASE = '';

let initData = '';
try {
  if (window.Telegram?.WebApp?.initData) {
    initData = window.Telegram.WebApp.initData;
  }
} catch {}

const headers = () => {
  const h = { 'Content-Type': 'application/json' };
  if (initData) h['X-Telegram-Init-Data'] = initData;
  else h['X-Dev-User-Id'] = '123456789';
  return h;
};

export const api = {
  async get(url) {
    const res = await fetch(BASE + url, { headers: headers() });
    return res.json();
  },
  async post(url, body) {
    const res = await fetch(BASE + url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    return res.json();
  },
  async put(url, body) {
    const res = await fetch(BASE + url, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    return res.json();
  },
  async del(url) {
    const res = await fetch(BASE + url, { method: 'DELETE', headers: headers() });
    return res.json();
  },
  async upload(url, formData) {
    const h = {};
    if (initData) h['X-Telegram-Init-Data'] = initData;
    else h['X-Dev-User-Id'] = '123456789';
    const res = await fetch(BASE + url, { method: 'POST', headers: h, body: formData });
    return res.json();
  }
};

export function getTelegramUser() {
  try {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      return window.Telegram.WebApp.initDataUnsafe.user;
    }
  } catch {}
  return { id: 123456789, first_name: 'Тестовый', last_name: 'Пользователь', username: 'testuser' };
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} • ${hours}:${mins}`;
}

export function initTelegram() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0f0f13');
      tg.setBackgroundColor('#0f0f13');
    }
  } catch {}
}
