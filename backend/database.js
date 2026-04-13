const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'singlechel.db');

class DatabaseWrapper {
  constructor(db) { this._db = db; }
  prepare(sql) {
    const db = this._db;
    return {
      run(...params) {
        db.run(sql, params);
        const info = { changes: db.getRowsModified(), lastInsertRowid: 0 };
        try { const r = db.exec("SELECT last_insert_rowid() as id"); if (r.length > 0 && r[0].values.length > 0) info.lastInsertRowid = r[0].values[0][0]; } catch {}
        return info;
      },
      get(...params) {
        try { const s = db.prepare(sql); s.bind(params); if (s.step()) { const c = s.getColumnNames(), v = s.get(), row = {}; c.forEach((k,i)=>{row[k]=v[i]}); s.free(); return row; } s.free(); return undefined; } catch { return undefined; }
      },
      all(...params) {
        try { const s = db.prepare(sql); s.bind(params); const rows = []; while (s.step()) { const c = s.getColumnNames(), v = s.get(), row = {}; c.forEach((k,i)=>{row[k]=v[i]}); rows.push(row); } s.free(); return rows; } catch { return []; }
      }
    };
  }
  exec(sql) { this._db.exec(sql); }
  pragma() {}
  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, buffer);
  }
  exportBase64() { return Buffer.from(this._db.export()).toString('base64'); }
}

async function initDB() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  const w = new DatabaseWrapper(db);

  w.exec(`
    CREATE TABLE IF NOT EXISTS cities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT, full_name TEXT NOT NULL, phone TEXT, email TEXT,
      country TEXT DEFAULT 'Россия', city_id INTEGER DEFAULT 1,
      avatar_url TEXT, photo_url TEXT, work TEXT, interests TEXT,
      social_links TEXT, about TEXT, phone_visible INTEGER DEFAULT 0,
      tariff TEXT DEFAULT 'free', tariff_expires DATETIME,
      consent_data INTEGER DEFAULT 0, consent_notifications INTEGER DEFAULT 0,
      is_registered INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      login TEXT UNIQUE, password TEXT,
      first_login_done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, description TEXT, image_url TEXT,
      date DATETIME NOT NULL, address TEXT, map_link TEXT,
      price REAL DEFAULT 0, is_free INTEGER DEFAULT 1,
      participant_limit INTEGER DEFAULT 0, city_id INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );
    CREATE TABLE IF NOT EXISTS event_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'registered', payment_method TEXT DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id), FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, content TEXT, image_url TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS tariff_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tier TEXT NOT NULL, price_monthly REAL DEFAULT 0, price_yearly REAL DEFAULT 0, features TEXT, is_active INTEGER DEFAULT 1);
  `);

  // Add columns if missing (for upgrades)
  try { w.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'pending'"); } catch {}
  try { w.exec("ALTER TABLE users ADD COLUMN login TEXT UNIQUE"); } catch {}
  try { w.exec("ALTER TABLE users ADD COLUMN password TEXT"); } catch {}
  try { w.exec("ALTER TABLE users ADD COLUMN first_login_done INTEGER DEFAULT 0"); } catch {}
  try { w.exec("ALTER TABLE pages ADD COLUMN image_url TEXT"); } catch {}

  // Seed
  const cc = w.prepare('SELECT COUNT(*) as c FROM cities').get();
  if (!cc || cc.c === 0) w.prepare('INSERT INTO cities (name) VALUES (?)').run('Челябинск');

  const pc = w.prepare('SELECT COUNT(*) as c FROM pages').get();
  if (!pc || pc.c === 0) {
    w.prepare("INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)").run('about', 'О нас', '<h2>SingleChel</h2><p>Приложение для знакомств через мероприятия.</p>');
    w.prepare("INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)").run('rules', 'Правила', '<h2>Правила</h2><ol><li>Будьте вежливы</li><li>Без спама</li></ol>');
    w.prepare("INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)").run('policy', 'Политика конфиденциальности', '<h2>Обработка данных</h2><p>Данные используются для работы сервиса.</p>');
    w.prepare("INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)").run('support', 'Служба заботы', '<h2>Поддержка</h2><p>Свяжитесь с нами в Telegram.</p>');
    w.prepare("INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)").run('consent_notifications', 'Согласие на уведомления', 'Я согласен получать уведомления о мероприятиях.');
  }

  const tc = w.prepare('SELECT COUNT(*) as c FROM tariff_plans').get();
  if (!tc || tc.c === 0) {
    w.prepare("INSERT INTO tariff_plans (name,tier,price_monthly,price_yearly,features) VALUES(?,?,?,?,?)").run('Бесплатный','free',0,0,JSON.stringify(['Просмотр мероприятий','Участие в мероприятиях']));
    w.prepare("INSERT INTO tariff_plans (name,tier,price_monthly,price_yearly,features) VALUES(?,?,?,?,?)").run('Уровень 1','tier1',499,4990,JSON.stringify(['Просмотр мероприятий','Участие','Анкета','Просмотр профилей']));
    w.prepare("INSERT INTO tariff_plans (name,tier,price_monthly,price_yearly,features) VALUES(?,?,?,?,?)").run('Уровень 2','tier2',999,9990,JSON.stringify(['Все возможности','Каталог участников','Приглашения']));
  }

  const ec = w.prepare('SELECT COUNT(*) as c FROM events').get();
  if (!ec || ec.c === 0) {
    w.prepare("INSERT INTO events (title,description,image_url,date,address,map_link,price,is_free,participant_limit,city_id) VALUES(?,?,?,?,?,?,?,?,?,?)").run('Вечер настольных игр','Отличная возможность познакомиться!','/uploads/event-default.jpg','2026-05-15 19:00','ул. Кирова, 110','https://2gis.ru/chelyabinsk',0,1,20,1);
    w.prepare("INSERT INTO events (title,description,image_url,date,address,map_link,price,is_free,participant_limit,city_id) VALUES(?,?,?,?,?,?,?,?,?,?)").run('Прогулка по городу','Пешая прогулка с гидом.','/uploads/event-default.jpg','2026-05-20 12:00','пл. Революции','https://2gis.ru/chelyabinsk',300,0,15,1);
  }

  w.save();
  setInterval(() => { try { w.save(); } catch {} }, 15000);
  return w;
}

module.exports = { initDB, DB_PATH };
