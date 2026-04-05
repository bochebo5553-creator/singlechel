const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
let db;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function validateTelegramData(initData) {
  if (!initData || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash'); params.delete('hash');
    const arr = []; for (const [k, v] of params.entries()) arr.push(`${k}=${v}`); arr.sort();
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computed = crypto.createHmac('sha256', secret).update(arr.join('\n')).digest('hex');
    if (computed === hash) return JSON.parse(params.get('user') || '{}');
    return null;
  } catch { return null; }
}

function authMW(req, res, next) {
  const d = req.headers['x-telegram-init-data'];
  const u = validateTelegramData(d);
  if (u) req.telegramUser = u;
  else if (req.headers['x-dev-user-id']) req.telegramUser = { id: req.headers['x-dev-user-id'], first_name: 'Dev', username: 'devuser' };
  next();
}
function reqAuth(req, res, next) { if (!req.telegramUser) return res.status(401).json({ error: 'Unauthorized' }); next(); }
function reqAdmin(req, res, next) {
  if (!req.telegramUser) return res.status(401).json({ error: 'Unauthorized' });
  const u = db.prepare('SELECT is_admin FROM users WHERE telegram_id = ?').get(String(req.telegramUser.id));
  if (!u || !u.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}
app.use(authMW);

// ===== AUTH =====
app.post('/api/auth/register', (req, res) => {
  try {
    const { telegram_id, username, full_name, phone, email, country, city_id, consent_data, consent_notifications, avatar_url } = req.body;
    if (!telegram_id || !full_name || !consent_data || !consent_notifications) return res.status(400).json({ error: 'Missing required fields' });
    const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegram_id));
    if (existing) {
      db.prepare('UPDATE users SET full_name=?,phone=?,email=?,country=?,city_id=?,consent_data=1,consent_notifications=1,is_registered=1,avatar_url=COALESCE(?,avatar_url),updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?')
        .run(full_name, phone||null, email||null, country||'Россия', city_id||1, avatar_url||null, String(telegram_id));
      const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegram_id)); db.save();
      return res.json({ user, isNew: false });
    }
    const cnt = db.prepare('SELECT COUNT(*) as c FROM users').get();
    const isFirst = (!cnt || cnt.c === 0) ? 1 : 0;
    db.prepare('INSERT INTO users (telegram_id,username,full_name,phone,email,country,city_id,avatar_url,consent_data,consent_notifications,is_registered,is_admin) VALUES(?,?,?,?,?,?,?,?,1,1,1,?)')
      .run(String(telegram_id), username||null, full_name, phone||null, email||null, country||'Россия', city_id||1, avatar_url||null, isFirst);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(telegram_id)); db.save();
    if (isFirst) console.log('✅ First user auto-promoted to admin:', full_name);
    res.json({ user, isNew: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.telegramUser) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.prepare('SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.telegram_id=?').get(String(req.telegramUser.id));
  res.json({ user: user || null });
});

app.put('/api/users/profile', reqAuth, (req, res) => {
  const { work, interests, social_links, about, phone_visible, city_id } = req.body;
  db.prepare('UPDATE users SET work=?,interests=?,social_links=?,about=?,phone_visible=?,city_id=COALESCE(?,city_id),updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?')
    .run(work||null, interests||null, social_links||null, about||null, phone_visible?1:0, city_id||null, String(req.telegramUser.id));
  const user = db.prepare('SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.telegram_id=?').get(String(req.telegramUser.id));
  db.save(); res.json({ user });
});

app.post('/api/users/photo', reqAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET photo_url=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?').run(url, String(req.telegramUser.id));
  db.save(); res.json({ photo_url: url });
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT id,full_name,username,avatar_url,photo_url,work,interests,social_links,about,phone,phone_visible,city_id,tariff FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (!user.phone_visible) user.phone = null;
  res.json({ user });
});

// ===== EVENTS =====
app.get('/api/events', (req, res) => {
  const cid = parseInt(req.query.city_id) || 1;
  const events = db.prepare("SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as participant_count FROM events e LEFT JOIN cities c ON e.city_id=c.id WHERE e.is_active=1 AND e.city_id=? AND e.date>=datetime('now') ORDER BY e.date ASC").all(cid);
  res.json({ events });
});

app.get('/api/events/:id', (req, res) => {
  const event = db.prepare("SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as participant_count FROM events e LEFT JOIN cities c ON e.city_id=c.id WHERE e.id=?").get(parseInt(req.params.id));
  if (!event) return res.status(404).json({ error: 'Not found' });
  const participants = db.prepare("SELECT u.id,u.full_name,u.username,u.avatar_url,u.photo_url,u.work,u.interests FROM event_participants ep JOIN users u ON ep.user_id=u.id WHERE ep.event_id=? AND ep.status='registered'").all(parseInt(req.params.id));
  res.json({ event, participants });
});

app.post('/api/events/:id/join', reqAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(req.params.id));
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!user) return res.status(401).json({ error: 'Register first' });
  const cnt = db.prepare("SELECT COUNT(*) as c FROM event_participants WHERE event_id=? AND status='registered'").get(event.id);
  if (event.participant_limit > 0 && cnt && cnt.c >= event.participant_limit) return res.status(400).json({ error: 'Все места заняты' });
  const pm = req.body?.payment_method || 'none';
  try { db.prepare('INSERT INTO event_participants (event_id,user_id,payment_method) VALUES(?,?,?)').run(event.id, user.id, pm); db.save(); res.json({ success: true }); }
  catch { res.json({ success: true, message: 'Already registered' }); }
});

app.post('/api/events/:id/leave', reqAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!user) return res.status(401).json({ error: 'Not found' });
  db.prepare("UPDATE event_participants SET status='cancelled' WHERE event_id=? AND user_id=?").run(parseInt(req.params.id), user.id);
  db.save(); res.json({ success: true });
});

app.get('/api/my/events', reqAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!user) return res.json({ events: [] });
  const events = db.prepare("SELECT e.*,c.name as city_name FROM event_participants ep JOIN events e ON ep.event_id=e.id LEFT JOIN cities c ON e.city_id=c.id WHERE ep.user_id=? AND ep.status='registered' AND e.date>=datetime('now') ORDER BY e.date ASC").all(user.id);
  res.json({ events });
});

// ===== PARTICIPANTS CATALOG (improved search) =====
app.get('/api/participants', reqAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!user || user.tariff !== 'tier2') return res.status(403).json({ error: 'Tier2 required' });
  const { city_id, search } = req.query;
  let q = 'SELECT id,full_name,username,avatar_url,photo_url,work,interests,about,city_id FROM users WHERE is_registered=1';
  const params = [];
  if (city_id) { q += ' AND city_id=?'; params.push(parseInt(city_id)); }
  if (search) {
    // Split search into words for flexible matching
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const conditions = words.map(w => {
        const stem = w.length > 3 ? w.substring(0, Math.max(3, w.length - 2)) : w;
        params.push(`%${stem}%`, `%${stem}%`, `%${stem}%`, `%${stem}%`);
        return '(LOWER(full_name) LIKE ? OR LOWER(interests) LIKE ? OR LOWER(about) LIKE ? OR LOWER(work) LIKE ?)';
      });
      q += ' AND (' + conditions.join(' AND ') + ')';
    }
  }
  q += ' ORDER BY full_name ASC LIMIT 50';
  const users = db.prepare(q).all(...params);
  res.json({ users });
});

// ===== INVITE =====
app.post('/api/invite', reqAuth, (req, res) => {
  const { target_user_id, event_id } = req.body;
  const sender = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!sender || sender.tariff !== 'tier2') return res.status(403).json({ error: 'Tier2 required' });
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(target_user_id));
  if (!target) return res.status(404).json({ error: 'User not found' });
  const event = db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(event_id));
  if (!event) return res.status(404).json({ error: 'Event not found' });
  console.log(`📨 INVITE: ${sender.full_name} invites ${target.full_name} (tg:${target.telegram_id}) to "${event.title}"`);
  // In production with bot token: send Telegram message
  if (BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: target.telegram_id, text: `🎟 ${sender.full_name} приглашает вас на мероприятие «${event.title}»!\n\n📅 ${event.date}\n📍 ${event.address || ''}` })
    }).catch(() => {});
  }
  res.json({ success: true });
});

// ===== PAGES / CITIES / TARIFFS =====
app.get('/api/pages/:slug', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json({ page });
});

app.get('/api/cities', (req, res) => { res.json({ cities: db.prepare('SELECT * FROM cities ORDER BY name').all() }); });

app.get('/api/tariffs', (req, res) => {
  const tariffs = db.prepare('SELECT * FROM tariff_plans WHERE is_active=1 ORDER BY price_monthly ASC').all();
  tariffs.forEach(t => { try { t.features = JSON.parse(t.features); } catch { t.features = []; } });
  res.json({ tariffs });
});

app.post('/api/payment', reqAuth, (req, res) => {
  const { tier, period } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!user) return res.status(401).json({ error: 'Not found' });
  const exp = period === 'yearly' ? new Date(Date.now() + 365*86400000).toISOString() : new Date(Date.now() + 30*86400000).toISOString();
  db.prepare('UPDATE users SET tariff=?,tariff_expires=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(tier, exp, user.id);
  db.save(); res.json({ success: true, tariff: tier, expires: exp });
});

// ===== ADMIN =====
app.get('/api/admin/events', reqAdmin, (req, res) => {
  const { city_id } = req.query;
  let q = "SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as participant_count FROM events e LEFT JOIN cities c ON e.city_id=c.id";
  const params = [];
  if (city_id) { q += ' WHERE e.city_id=?'; params.push(parseInt(city_id)); }
  q += ' ORDER BY e.date DESC';
  res.json({ events: db.prepare(q).all(...params) });
});

app.post('/api/admin/events', reqAdmin, upload.single('image'), (req, res) => {
  const { title, description, date, address, map_link, price, is_free, participant_limit, city_id } = req.body;
  const img = req.file ? `/uploads/${req.file.filename}` : '/uploads/event-default.jpg';
  const fv = (is_free==='true'||is_free==='1'||is_free===true)?1:0;
  const pv = fv ? 0 : (parseFloat(price)||0);
  const r = db.prepare('INSERT INTO events (title,description,image_url,date,address,map_link,price,is_free,participant_limit,city_id) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(title, description||'', img, date, address||'', map_link||'', pv, fv, parseInt(participant_limit)||0, parseInt(city_id)||1);
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(r.lastInsertRowid);
  db.save(); res.json({ event: ev });
});

app.put('/api/admin/events/:id', reqAdmin, upload.single('image'), (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(req.params.id));
  if (!ev) return res.status(404).json({ error: 'Not found' });
  const { title, description, date, address, map_link, price, is_free, participant_limit, city_id, is_active } = req.body;
  const img = req.file ? `/uploads/${req.file.filename}` : ev.image_url;
  const fv = is_free!==undefined ? (is_free==='true'||is_free==='1'||is_free===true?1:0) : ev.is_free;
  const pv = fv ? 0 : (price!==undefined ? (parseFloat(price)||0) : ev.price);
  db.prepare('UPDATE events SET title=?,description=?,image_url=?,date=?,address=?,map_link=?,price=?,is_free=?,participant_limit=?,city_id=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(title||ev.title, description!==undefined?description:ev.description, img, date||ev.date, address!==undefined?address:ev.address, map_link!==undefined?map_link:ev.map_link, pv, fv, participant_limit!==undefined?(parseInt(participant_limit)||0):ev.participant_limit, parseInt(city_id)||ev.city_id, is_active!==undefined?(is_active==='true'||is_active==='1'||is_active===true?1:0):ev.is_active, parseInt(req.params.id));
  db.save(); res.json({ event: db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(req.params.id)) });
});

app.delete('/api/admin/events/:id', reqAdmin, (req, res) => {
  db.prepare('DELETE FROM events WHERE id=?').run(parseInt(req.params.id)); db.save(); res.json({ success: true });
});

app.get('/api/admin/events/:id/participants', reqAdmin, (req, res) => {
  res.json({ participants: db.prepare("SELECT u.id,u.full_name,u.username,u.phone,u.email,u.tariff,ep.status,ep.payment_method,ep.created_at as joined_at FROM event_participants ep JOIN users u ON ep.user_id=u.id WHERE ep.event_id=?").all(parseInt(req.params.id)) });
});

app.post('/api/admin/events/:id/participants', reqAdmin, (req, res) => {
  try { db.prepare('INSERT INTO event_participants (event_id,user_id) VALUES(?,?)').run(parseInt(req.params.id), req.body.user_id); db.save(); res.json({ success: true }); }
  catch { res.json({ success: true }); }
});

app.delete('/api/admin/events/:id/participants/:uid', reqAdmin, (req, res) => {
  db.prepare('DELETE FROM event_participants WHERE event_id=? AND user_id=?').run(parseInt(req.params.id), parseInt(req.params.uid)); db.save(); res.json({ success: true });
});

// Admin users with search
app.get('/api/admin/users', reqAdmin, (req, res) => {
  const { search, city_id } = req.query;
  let q = 'SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE 1=1';
  const params = [];
  if (search) {
    q += ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.username) LIKE ? OR u.phone LIKE ?)';
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s, `%${search}%`);
  }
  if (city_id) { q += ' AND u.city_id=?'; params.push(parseInt(city_id)); }
  q += ' ORDER BY u.created_at DESC';
  const users = db.prepare(q).all(...params);
  users.forEach(u => {
    u.events = db.prepare("SELECT e.id,e.title,e.date,ep.status FROM event_participants ep JOIN events e ON ep.event_id=e.id WHERE ep.user_id=? ORDER BY e.date ASC").all(u.id);
  });
  res.json({ users });
});

app.get('/api/admin/users/:id', reqAdmin, (req, res) => {
  const user = db.prepare('SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.events = db.prepare("SELECT e.id,e.title,e.date,ep.status FROM event_participants ep JOIN events e ON ep.event_id=e.id WHERE ep.user_id=? ORDER BY e.date ASC").all(user.id);
  res.json({ user });
});

app.put('/api/admin/users/:id/tariff', reqAdmin, (req, res) => {
  db.prepare('UPDATE users SET tariff=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.tariff, parseInt(req.params.id)); db.save(); res.json({ success: true });
});

app.put('/api/admin/users/:id/admin', reqAdmin, (req, res) => {
  db.prepare('UPDATE users SET is_admin=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.is_admin?1:0, parseInt(req.params.id)); db.save(); res.json({ success: true });
});

// Admin tariffs
app.get('/api/admin/tariffs', reqAdmin, (req, res) => {
  const t = db.prepare('SELECT * FROM tariff_plans ORDER BY price_monthly ASC').all();
  t.forEach(x => { try { x.features = JSON.parse(x.features); } catch { x.features = []; } });
  res.json({ tariffs: t });
});

app.put('/api/admin/tariffs/:id', reqAdmin, (req, res) => {
  const { name, price_monthly, price_yearly, features } = req.body;
  const t = db.prepare('SELECT * FROM tariff_plans WHERE id=?').get(parseInt(req.params.id));
  if (!t) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE tariff_plans SET name=?,price_monthly=?,price_yearly=?,features=? WHERE id=?')
    .run(name||t.name, parseFloat(price_monthly)??t.price_monthly, parseFloat(price_yearly)??t.price_yearly, typeof features==='string'?features:JSON.stringify(features||[]), parseInt(req.params.id));
  db.save(); res.json({ success: true });
});

// Admin pages
app.put('/api/admin/pages/:slug', reqAdmin, (req, res) => {
  const { title, content } = req.body;
  db.prepare('UPDATE pages SET title=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE slug=?').run(title, content, req.params.slug);
  db.save(); res.json({ page: db.prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug) });
});

// Admin cities
app.post('/api/admin/cities', reqAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try { const r = db.prepare('INSERT INTO cities (name) VALUES(?)').run(name.trim()); db.save(); res.json({ city: { id: r.lastInsertRowid, name: name.trim() } }); }
  catch { res.status(400).json({ error: 'City already exists' }); }
});

app.delete('/api/admin/cities/:id', reqAdmin, (req, res) => {
  if (parseInt(req.params.id)===1) return res.status(400).json({ error: 'Cannot delete default' });
  db.prepare('DELETE FROM cities WHERE id=?').run(parseInt(req.params.id)); db.save(); res.json({ success: true });
});

// Admin notify
app.post('/api/admin/notify', reqAdmin, (req, res) => {
  const { user_id, message } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(user_id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  console.log(`📨 NOTIFY ${user.full_name} (tg:${user.telegram_id}): ${message}`);
  if (BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: user.telegram_id, text: message })
    }).catch(() => {});
  }
  res.json({ success: true });
});

// Admin image upload (for pages)
app.post('/api/admin/upload', reqAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Admin CSV export
app.get('/api/admin/export/users', reqAdmin, (req, res) => {
  const { search, city_id } = req.query;
  let q = 'SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE 1=1';
  const params = [];
  if (search) { q+=' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.username) LIKE ? OR u.phone LIKE ?)'; const s=`%${search.toLowerCase()}%`; params.push(s,s,`%${search}%`); }
  if (city_id) { q+=' AND u.city_id=?'; params.push(parseInt(city_id)); }
  q += ' ORDER BY u.created_at DESC';
  const users = db.prepare(q).all(...params);
  let csv = 'ID,Имя,Username,Телефон,Email,Город,Тариф,Дата регистрации\n';
  users.forEach(u => { csv += `${u.id},"${u.full_name||''}","${u.username||''}","${u.phone||''}","${u.email||''}","${u.city_name||''}","${u.tariff}","${u.created_at||''}"\n`; });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
  res.send('\uFEFF' + csv);
});

app.get('/api/admin/export/events', reqAdmin, (req, res) => {
  const { city_id } = req.query;
  let q = "SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as pc FROM events e LEFT JOIN cities c ON e.city_id=c.id";
  const params = [];
  if (city_id) { q+=' WHERE e.city_id=?'; params.push(parseInt(city_id)); }
  q += ' ORDER BY e.date DESC';
  const events = db.prepare(q).all(...params);
  let csv = 'ID,Название,Дата,Город,Адрес,Цена,Участников,Лимит,Активно\n';
  events.forEach(e => { csv += `${e.id},"${e.title||''}","${e.date||''}","${e.city_name||''}","${e.address||''}",${e.price},${e.pc},${e.participant_limit},${e.is_active}\n`; });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=events.csv');
  res.send('\uFEFF' + csv);
});

app.post('/api/admin/setup', (req, res) => {
  const { telegram_id, secret } = req.body;
  if (secret !== (process.env.ADMIN_SECRET || 'singlechel-admin-2026')) return res.status(403).json({ error: 'Invalid secret' });
  db.prepare('UPDATE users SET is_admin=1 WHERE telegram_id=?').run(String(telegram_id)); db.save(); res.json({ success: true });
});

app.get('/admin*', (req, res) => { res.sendFile(path.join(__dirname, '..', 'admin', 'index.html')); });
app.get('*', (req, res) => { if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html')); });

async function start() {
  db = await initDB();
  app.listen(PORT, () => { console.log(`🚀 SingleChel running on port ${PORT}`); console.log(`📱 http://localhost:${PORT}`); console.log(`🔧 http://localhost:${PORT}/admin`); });
}
start().catch(e => { console.error(e); process.exit(1); });
