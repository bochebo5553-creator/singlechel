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
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substr(2,9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

// ===== AUTH HELPERS =====
function validateTelegram(initData) {
  if (!initData || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return null;
  try {
    const p = new URLSearchParams(initData); const hash = p.get('hash'); p.delete('hash');
    const arr = []; for (const [k,v] of p.entries()) arr.push(`${k}=${v}`); arr.sort();
    const secret = crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
    const comp = crypto.createHmac('sha256',secret).update(arr.join('\n')).digest('hex');
    if (comp === hash) return JSON.parse(p.get('user')||'{}');
    return null;
  } catch { return null; }
}

function authMW(req, res, next) {
  // 1) Telegram WebApp
  const td = req.headers['x-telegram-init-data'];
  const tu = validateTelegram(td);
  if (tu) { req.telegramUser = tu; return next(); }
  // 2) Login/password session token
  const token = req.headers['x-auth-token'];
  if (token) {
    const user = db.prepare("SELECT * FROM users WHERE login=? AND status='approved'").get(token);
    if (user) { req.telegramUser = { id: user.telegram_id }; req.appUser = user; return next(); }
  }
  // 3) Dev mode
  if (req.headers['x-dev-user-id']) { req.telegramUser = { id: req.headers['x-dev-user-id'], first_name:'Dev', username:'devuser' }; return next(); }
  next();
}

function reqAuth(req, res, next) { if (!req.telegramUser) return res.status(401).json({error:'Unauthorized'}); next(); }

function reqAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.query.admin_secret;
  if (secret && secret === (process.env.ADMIN_SECRET||'singlechel-admin-2026')) { req.isAdmin=true; return next(); }
  if (!req.telegramUser) return res.status(401).json({error:'Unauthorized'});
  const u = db.prepare('SELECT is_admin FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!u||!u.is_admin) return res.status(403).json({error:'Forbidden'});
  next();
}

app.use(authMW);

// ===== ADMIN LOGIN =====
app.post('/api/admin/login', (req, res) => {
  if (req.body.secret === (process.env.ADMIN_SECRET||'singlechel-admin-2026')) return res.json({success:true});
  res.status(403).json({error:'Неверный пароль'});
});

// ===== USER AUTH: Registration (creates pending user) =====
app.post('/api/auth/register', (req, res) => {
  try {
    const {telegram_id,username,full_name,phone,email,country,city_id,consent_data,consent_notifications,avatar_url} = req.body;
    if (!telegram_id||!full_name) return res.status(400).json({error:'Missing fields'});
    const existing = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(telegram_id));
    if (existing) {
      return res.json({user:existing, status: existing.status});
    }
    // First user becomes approved admin automatically
    const cnt = db.prepare('SELECT COUNT(*) as c FROM users').get();
    const isFirst = (!cnt||cnt.c===0);
    db.prepare('INSERT INTO users (telegram_id,username,full_name,phone,email,country,city_id,avatar_url,consent_data,consent_notifications,is_registered,is_admin,status,first_login_done) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?)')
      .run(String(telegram_id),username||null,full_name,phone||null,email||null,country||'Россия',city_id||1,avatar_url||null,consent_data?1:0,consent_notifications?1:0,isFirst?1:0,isFirst?'approved':'pending',isFirst?1:0);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(String(telegram_id));
    db.save();
    if (isFirst) console.log('✅ First user auto-approved as admin:', full_name);
    res.json({user, status: user.status});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Check user status by telegram_id
app.get('/api/auth/status', (req, res) => {
  if (!req.telegramUser) return res.json({status:'not_found'});
  const user = db.prepare('SELECT id,status,login,full_name,first_login_done FROM users WHERE telegram_id=?').get(String(req.telegramUser.id));
  if (!user) return res.json({status:'not_found'});
  res.json({status:user.status, hasLogin:!!user.login, firstLoginDone:!!user.first_login_done, name:user.full_name});
});

// Login with login/password — sets first_login_done
app.post('/api/auth/login', (req, res) => {
  const {login, password} = req.body;
  if (!login||!password) return res.status(400).json({error:'Введите логин и пароль'});
  const user = db.prepare("SELECT * FROM users WHERE login=? AND password=? AND status='approved'").get(login, password);
  if (!user) return res.status(401).json({error:'Неверный логин или пароль'});
  // Mark first login as done
  if (!user.first_login_done) {
    db.prepare('UPDATE users SET first_login_done=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(user.id);
    db.save();
    user.first_login_done = 1;
  }
  res.json({user, token: user.login});
});

// Get current user (for approved users)
app.get('/api/auth/me', (req, res) => {
  if (!req.telegramUser) return res.status(401).json({error:'Unauthorized'});
  // Try by token first (appUser), then by telegram_id
  let user = req.appUser;
  if (!user) user = db.prepare("SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.telegram_id=? AND u.status='approved'").get(String(req.telegramUser.id));
  if (!user) return res.json({user:null});
  if (!user.city_name) {
    const c = db.prepare('SELECT name FROM cities WHERE id=?').get(user.city_id);
    user.city_name = c?.name||null;
  }
  res.json({user});
});

// ===== PROFILE =====
app.put('/api/users/profile', reqAuth, (req, res) => {
  const {work,interests,social_links,about,phone_visible,city_id} = req.body;
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  db.prepare('UPDATE users SET work=?,interests=?,social_links=?,about=?,phone_visible=?,city_id=COALESCE(?,city_id),updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?')
    .run(work||null,interests||null,social_links||null,about||null,phone_visible?1:0,city_id||null,tid);
  const user = db.prepare('SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.telegram_id=?').get(tid);
  db.save(); res.json({user});
});

app.post('/api/users/photo', reqAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({error:'No file'});
  const url = `/uploads/${req.file.filename}`;
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  db.prepare('UPDATE users SET photo_url=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?').run(url,tid);
  db.save(); res.json({photo_url:url});
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT id,full_name,username,avatar_url,photo_url,work,interests,social_links,about,phone,phone_visible,city_id,tariff FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({error:'Not found'});
  if (!user.phone_visible) user.phone = null;
  res.json({user});
});

// ===== EVENTS =====
app.get('/api/events', (req, res) => {
  const cid = parseInt(req.query.city_id)||1;
  res.json({events: db.prepare("SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as participant_count FROM events e LEFT JOIN cities c ON e.city_id=c.id WHERE e.is_active=1 AND e.city_id=? AND e.date>=datetime('now') ORDER BY e.date ASC").all(cid)});
});

app.get('/api/events/:id', (req, res) => {
  const ev = db.prepare("SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as participant_count FROM events e LEFT JOIN cities c ON e.city_id=c.id WHERE e.id=?").get(parseInt(req.params.id));
  if (!ev) return res.status(404).json({error:'Not found'});
  res.json({event:ev, participants: db.prepare("SELECT u.id,u.full_name,u.username,u.avatar_url,u.photo_url,u.work,u.interests FROM event_participants ep JOIN users u ON ep.user_id=u.id WHERE ep.event_id=? AND ep.status='registered'").all(parseInt(req.params.id))});
});

app.post('/api/events/:id/join', reqAuth, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(req.params.id));
  if (!ev) return res.status(404).json({error:'Мероприятие не найдено'});
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tid);
  if (!user) return res.status(401).json({error:'Не найден'});
  const cnt = db.prepare("SELECT COUNT(*) as c FROM event_participants WHERE event_id=? AND status='registered'").get(ev.id);
  if (ev.participant_limit>0 && cnt && cnt.c>=ev.participant_limit) return res.status(400).json({error:'Все места заняты'});
  try { db.prepare('INSERT INTO event_participants (event_id,user_id,payment_method) VALUES(?,?,?)').run(ev.id,user.id,req.body?.payment_method||'none'); db.save(); res.json({success:true}); }
  catch { res.json({success:true}); }
});

app.post('/api/events/:id/leave', reqAuth, (req, res) => {
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tid);
  if (!user) return res.status(401).json({error:'Не найден'});
  db.prepare("DELETE FROM event_participants WHERE event_id=? AND user_id=?").run(parseInt(req.params.id),user.id);
  db.save(); res.json({success:true});
});

app.get('/api/my/events', reqAuth, (req, res) => {
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tid);
  if (!user) return res.json({events:[]});
  res.json({events: db.prepare("SELECT e.*,c.name as city_name FROM event_participants ep JOIN events e ON ep.event_id=e.id LEFT JOIN cities c ON e.city_id=c.id WHERE ep.user_id=? AND ep.status='registered' ORDER BY e.date ASC").all(user.id)});
});

// ===== CATALOG / INVITE =====
app.get('/api/participants', reqAuth, (req, res) => {
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  const me = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tid);
  if (!me||me.tariff!=='tier2') return res.status(403).json({error:'Tier2 required'});
  const {city_id,search} = req.query;
  let q = "SELECT id,full_name,username,avatar_url,photo_url,work,interests,about,city_id FROM users WHERE is_registered=1 AND status='approved'"; const params=[];
  if (city_id) { q+=' AND city_id=?'; params.push(parseInt(city_id)); }
  if (search) { const words=search.trim().toLowerCase().split(/\s+/).filter(Boolean); words.forEach(w=>{ const s=w.length>3?w.substring(0,Math.max(3,w.length-2)):w; params.push(`%${s}%`,`%${s}%`,`%${s}%`,`%${s}%`); q+=' AND (LOWER(full_name) LIKE ? OR LOWER(interests) LIKE ? OR LOWER(about) LIKE ? OR LOWER(work) LIKE ?)'; }); }
  q+=' ORDER BY full_name ASC LIMIT 50';
  res.json({users:db.prepare(q).all(...params)});
});

app.post('/api/invite', reqAuth, (req, res) => {
  const {target_user_id,event_id} = req.body;
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  const sender = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tid);
  if (!sender||sender.tariff!=='tier2') return res.status(403).json({error:'Tier2 required'});
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(target_user_id));
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(event_id));
  if (!target||!ev) return res.status(404).json({error:'Not found'});
  console.log(`📨 INVITE: ${sender.full_name} → ${target.full_name} to "${ev.title}"`);
  if (BOT_TOKEN!=='YOUR_BOT_TOKEN_HERE') {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:target.telegram_id,text:`🎟 ${sender.full_name} приглашает вас на мероприятие «${ev.title}»!\n📅 ${ev.date}\n📍 ${ev.address||''}`})}).catch(()=>{});
  }
  res.json({success:true});
});

// ===== PAGES / CITIES / TARIFFS =====
app.get('/api/pages/:slug', (req, res) => { const p = db.prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug); if (!p) return res.status(404).json({error:'Not found'}); res.json({page:p}); });
app.get('/api/cities', (req, res) => { res.json({cities:db.prepare('SELECT * FROM cities ORDER BY name').all()}); });
app.get('/api/tariffs', (req, res) => { const t=db.prepare('SELECT * FROM tariff_plans WHERE is_active=1 ORDER BY price_monthly ASC').all(); t.forEach(x=>{try{x.features=JSON.parse(x.features)}catch{x.features=[]}}); res.json({tariffs:t}); });

app.post('/api/payment', reqAuth, (req, res) => {
  const {tier,period} = req.body;
  const tid = req.appUser ? req.appUser.telegram_id : String(req.telegramUser.id);
  const user = db.prepare('SELECT * FROM users WHERE telegram_id=?').get(tid);
  if (!user) return res.status(401).json({error:'Not found'});
  const exp = period==='yearly' ? new Date(Date.now()+365*86400000).toISOString() : new Date(Date.now()+30*86400000).toISOString();
  db.prepare('UPDATE users SET tariff=?,tariff_expires=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(tier,exp,user.id);
  db.save(); res.json({success:true});
});

// ===== ADMIN: MODERATION =====
app.get('/api/admin/pending', reqAdmin, (req, res) => {
  res.json({users: db.prepare("SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.status='pending' ORDER BY u.created_at DESC").all()});
});

app.post('/api/admin/approve/:id', reqAdmin, (req, res) => {
  const {login,password} = req.body;
  if (!login||!password) return res.status(400).json({error:'Логин и пароль обязательны'});
  const existing = db.prepare('SELECT id FROM users WHERE login=? AND id!=?').get(login, parseInt(req.params.id));
  if (existing) return res.status(400).json({error:'Логин уже занят'});
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({error:'Not found'});
  db.prepare("UPDATE users SET status='approved',login=?,password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(login,password,parseInt(req.params.id));
  db.save();
  // Send credentials via Telegram
  if (BOT_TOKEN!=='YOUR_BOT_TOKEN_HERE' && user.telegram_id) {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:user.telegram_id,text:`✅ Ваша анкета одобрена!\n\nВаши данные для входа:\n👤 Логин: ${login}\n🔑 Пароль: ${password}\n\nОткройте приложение и войдите.`})}).catch(()=>{});
  }
  console.log(`✅ APPROVED: ${user.full_name} → login: ${login}, password: ${password}`);
  res.json({success:true});
});

app.post('/api/admin/reject/:id', reqAdmin, (req, res) => {
  const {reason} = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({error:'Not found'});
  db.prepare("UPDATE users SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(parseInt(req.params.id));
  db.save();
  if (BOT_TOKEN!=='YOUR_BOT_TOKEN_HERE' && user.telegram_id) {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:user.telegram_id,text:`❌ К сожалению, ваша заявка отклонена.\n${reason?'Причина: '+reason:''}`})}).catch(()=>{});
  }
  res.json({success:true});
});

// ===== ADMIN: EVENTS =====
app.get('/api/admin/events', reqAdmin, (req, res) => {
  let q="SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as participant_count FROM events e LEFT JOIN cities c ON e.city_id=c.id";
  const p=[]; if(req.query.city_id){q+=' WHERE e.city_id=?';p.push(parseInt(req.query.city_id));} q+=' ORDER BY e.date DESC';
  res.json({events:db.prepare(q).all(...p)});
});

app.post('/api/admin/events', reqAdmin, upload.single('image'), (req, res) => {
  const {title,description,date,address,map_link,price,is_free,participant_limit,city_id}=req.body;
  const img=req.file?`/uploads/${req.file.filename}`:'/uploads/event-default.jpg';
  const fv=(is_free==='true'||is_free==='1'||is_free===true)?1:0;
  const r=db.prepare('INSERT INTO events (title,description,image_url,date,address,map_link,price,is_free,participant_limit,city_id) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(title,description||'',img,date,address||'',map_link||'',fv?0:(parseFloat(price)||0),fv,parseInt(participant_limit)||0,parseInt(city_id)||1);
  db.save(); res.json({event:db.prepare('SELECT * FROM events WHERE id=?').get(r.lastInsertRowid)});
});

app.put('/api/admin/events/:id', reqAdmin, upload.single('image'), (req, res) => {
  const ev=db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(req.params.id));
  if(!ev) return res.status(404).json({error:'Not found'});
  const {title,description,date,address,map_link,price,is_free,participant_limit,city_id,is_active}=req.body;
  const img=req.file?`/uploads/${req.file.filename}`:ev.image_url;
  const fv=is_free!==undefined?(is_free==='true'||is_free==='1'?1:0):ev.is_free;
  db.prepare('UPDATE events SET title=?,description=?,image_url=?,date=?,address=?,map_link=?,price=?,is_free=?,participant_limit=?,city_id=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(title||ev.title, description!==undefined?description:ev.description, img, date||ev.date, address!==undefined?address:ev.address, map_link!==undefined?map_link:ev.map_link, fv?0:(price!==undefined?parseFloat(price)||0:ev.price), fv, participant_limit!==undefined?parseInt(participant_limit)||0:ev.participant_limit, parseInt(city_id)||ev.city_id, is_active!==undefined?(is_active==='true'||is_active==='1'?1:0):ev.is_active, parseInt(req.params.id));
  db.save(); res.json({event:db.prepare('SELECT * FROM events WHERE id=?').get(parseInt(req.params.id))});
});

app.delete('/api/admin/events/:id', reqAdmin, (req,res)=>{db.prepare('DELETE FROM events WHERE id=?').run(parseInt(req.params.id));db.save();res.json({success:true})});

app.get('/api/admin/events/:id/participants', reqAdmin, (req,res)=>{
  res.json({participants:db.prepare("SELECT u.id,u.full_name,u.username,u.phone,u.email,u.tariff,ep.status,ep.payment_method,ep.created_at as joined_at FROM event_participants ep JOIN users u ON ep.user_id=u.id WHERE ep.event_id=?").all(parseInt(req.params.id))});
});
app.post('/api/admin/events/:id/participants', reqAdmin, (req,res)=>{try{db.prepare('INSERT INTO event_participants (event_id,user_id) VALUES(?,?)').run(parseInt(req.params.id),req.body.user_id);db.save();res.json({success:true})}catch{res.json({success:true})}});
app.delete('/api/admin/events/:id/participants/:uid', reqAdmin, (req,res)=>{db.prepare('DELETE FROM event_participants WHERE event_id=? AND user_id=?').run(parseInt(req.params.id),parseInt(req.params.uid));db.save();res.json({success:true})});

// ===== ADMIN: USERS =====
app.get('/api/admin/users', reqAdmin, (req,res)=>{
  const {search,city_id}=req.query; let q="SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.status='approved'"; const p=[];
  if(search){q+=' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.username) LIKE ? OR u.phone LIKE ?)';const s=`%${search.toLowerCase()}%`;p.push(s,s,`%${search}%`);}
  if(city_id){q+=' AND u.city_id=?';p.push(parseInt(city_id));} q+=' ORDER BY u.created_at DESC';
  const users=db.prepare(q).all(...p);
  users.forEach(u=>{u.events=db.prepare("SELECT e.id,e.title,e.date,ep.status FROM event_participants ep JOIN events e ON ep.event_id=e.id WHERE ep.user_id=? ORDER BY e.date ASC").all(u.id)});
  res.json({users});
});
app.put('/api/admin/users/:id/tariff', reqAdmin, (req,res)=>{db.prepare('UPDATE users SET tariff=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.tariff,parseInt(req.params.id));db.save();res.json({success:true})});
app.put('/api/admin/users/:id/admin', reqAdmin, (req,res)=>{db.prepare('UPDATE users SET is_admin=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.is_admin?1:0,parseInt(req.params.id));db.save();res.json({success:true})});

// Admin: update user credentials
app.put('/api/admin/users/:id/credentials', reqAdmin, (req,res)=>{
  const {login,password} = req.body;
  if (!login||!password) return res.status(400).json({error:'Логин и пароль обязательны'});
  const exists = db.prepare('SELECT id FROM users WHERE login=? AND id!=?').get(login, parseInt(req.params.id));
  if (exists) return res.status(400).json({error:'Логин уже занят'});
  db.prepare('UPDATE users SET login=?,password=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(login,password,parseInt(req.params.id));
  db.save(); res.json({success:true});
});

// Admin: delete user
app.delete('/api/admin/users/:id', reqAdmin, (req,res)=>{
  const uid = parseInt(req.params.id);
  db.prepare('DELETE FROM event_participants WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM users WHERE id=?').run(uid);
  db.save(); res.json({success:true});
});

// ===== ADMIN: TARIFFS / PAGES / CITIES =====
app.get('/api/admin/tariffs', reqAdmin, (req,res)=>{const t=db.prepare('SELECT * FROM tariff_plans ORDER BY price_monthly ASC').all();t.forEach(x=>{try{x.features=JSON.parse(x.features)}catch{x.features=[]}});res.json({tariffs:t})});
app.put('/api/admin/tariffs/:id', reqAdmin, (req,res)=>{const{name,price_monthly,price_yearly,features}=req.body;const t=db.prepare('SELECT * FROM tariff_plans WHERE id=?').get(parseInt(req.params.id));if(!t)return res.status(404).json({error:'Not found'});db.prepare('UPDATE tariff_plans SET name=?,price_monthly=?,price_yearly=?,features=? WHERE id=?').run(name||t.name,parseFloat(price_monthly)??t.price_monthly,parseFloat(price_yearly)??t.price_yearly,typeof features==='string'?features:JSON.stringify(features||[]),parseInt(req.params.id));db.save();res.json({success:true})});

app.put('/api/admin/pages/:slug', reqAdmin, (req,res)=>{const{title,content}=req.body;db.prepare('UPDATE pages SET title=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE slug=?').run(title,content,req.params.slug);db.save();res.json({page:db.prepare('SELECT * FROM pages WHERE slug=?').get(req.params.slug)})});
app.post('/api/admin/pages/:slug/image', reqAdmin, upload.single('image'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'No file'});
  const url=`/uploads/${req.file.filename}`;
  db.prepare('UPDATE pages SET image_url=?,updated_at=CURRENT_TIMESTAMP WHERE slug=?').run(url,req.params.slug);
  db.save(); res.json({image_url:url});
});

app.post('/api/admin/cities', reqAdmin, (req,res)=>{const{name}=req.body;if(!name?.trim())return res.status(400).json({error:'Name required'});try{const r=db.prepare('INSERT INTO cities (name) VALUES(?)').run(name.trim());db.save();res.json({city:{id:r.lastInsertRowid,name:name.trim()}})}catch{res.status(400).json({error:'Уже существует'})}});
app.delete('/api/admin/cities/:id', reqAdmin, (req,res)=>{if(parseInt(req.params.id)===1)return res.status(400).json({error:'Нельзя удалить'});db.prepare('DELETE FROM cities WHERE id=?').run(parseInt(req.params.id));db.save();res.json({success:true})});

app.post('/api/admin/notify', reqAdmin, (req,res)=>{
  const{user_id,message}=req.body;const user=db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(user_id));
  if(!user)return res.status(404).json({error:'Not found'});
  console.log(`📨 NOTIFY ${user.full_name}: ${message}`);
  if(BOT_TOKEN!=='YOUR_BOT_TOKEN_HERE'){fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:user.telegram_id,text:message})}).catch(()=>{});}
  res.json({success:true});
});

app.post('/api/admin/upload', reqAdmin, upload.single('file'), (req,res)=>{if(!req.file)return res.status(400).json({error:'No file'});res.json({url:`/uploads/${req.file.filename}`})});

// CSV exports
app.get('/api/admin/export/users', reqAdmin, (req,res)=>{const users=db.prepare("SELECT u.*,c.name as city_name FROM users u LEFT JOIN cities c ON u.city_id=c.id WHERE u.status='approved' ORDER BY u.created_at DESC").all();let csv='ID,Имя,Username,Телефон,Email,Город,Тариф,Дата\n';users.forEach(u=>{csv+=`${u.id},"${u.full_name||''}","${u.username||''}","${u.phone||''}","${u.email||''}","${u.city_name||''}","${u.tariff}","${u.created_at||''}"\n`});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=users.csv');res.send('\uFEFF'+csv)});
app.get('/api/admin/export/events', reqAdmin, (req,res)=>{const evs=db.prepare("SELECT e.*,c.name as city_name,(SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id=e.id AND ep.status='registered') as pc FROM events e LEFT JOIN cities c ON e.city_id=c.id ORDER BY e.date DESC").all();let csv='ID,Название,Дата,Город,Цена,Участников\n';evs.forEach(e=>{csv+=`${e.id},"${e.title}","${e.date}","${e.city_name||''}",${e.price},${e.pc}\n`});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=events.csv');res.send('\uFEFF'+csv)});
app.get('/api/admin/export/event-participants/:id', reqAdmin, (req,res)=>{const ps=db.prepare("SELECT u.full_name,u.username,u.phone,u.email,u.tariff,ep.status,ep.payment_method,ep.created_at FROM event_participants ep JOIN users u ON ep.user_id=u.id WHERE ep.event_id=?").all(parseInt(req.params.id));let csv='Имя,Username,Телефон,Email,Тариф,Статус,Оплата,Дата\n';ps.forEach(p=>{csv+=`"${p.full_name||''}","${p.username||''}","${p.phone||''}","${p.email||''}","${p.tariff}","${p.status}","${p.payment_method||''}","${p.created_at||''}"\n`});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=participants.csv');res.send('\uFEFF'+csv)});

app.post('/api/admin/setup', (req,res)=>{if(req.body.secret!==(process.env.ADMIN_SECRET||'singlechel-admin-2026'))return res.status(403).json({error:'Invalid'});db.prepare('UPDATE users SET is_admin=1,status=\'approved\' WHERE telegram_id=?').run(String(req.body.telegram_id));db.save();res.json({success:true})});

app.get('/admin*', (req,res)=>{res.sendFile(path.join(__dirname,'..','admin','index.html'))});
app.get('*', (req,res)=>{if(!req.path.startsWith('/api'))res.sendFile(path.join(__dirname,'..','frontend','dist','index.html'))});

async function start(){db=await initDB();app.listen(PORT,()=>{console.log(`🚀 SingleChel on port ${PORT}`)});}
start().catch(e=>{console.error(e);process.exit(1)});
