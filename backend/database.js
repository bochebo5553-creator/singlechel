const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'singlechel.db');

// Wrapper class to mimic better-sqlite3 API
class DatabaseWrapper {
  constructor(db) {
    this._db = db;
  }

  prepare(sql) {
    const db = this._db;
    return {
      run(...params) {
        db.run(sql, params);
        const info = { changes: db.getRowsModified(), lastInsertRowid: 0 };
        try {
          const res = db.exec("SELECT last_insert_rowid() as id");
          if (res.length > 0 && res[0].values.length > 0) {
            info.lastInsertRowid = res[0].values[0][0];
          }
        } catch {}
        return info;
      },
      get(...params) {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[i]; });
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          return undefined;
        }
      },
      all(...params) {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[i]; });
            rows.push(row);
          }
          stmt.free();
          return rows;
        } catch (e) {
          return [];
        }
      }
    };
  }

  exec(sql) {
    this._db.exec(sql);
  }

  pragma() {}

  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initDB() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const wrapper = new DatabaseWrapper(db);

  wrapper.exec(`
    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      country TEXT DEFAULT 'Россия',
      city_id INTEGER DEFAULT 1,
      avatar_url TEXT,
      photo_url TEXT,
      work TEXT,
      interests TEXT,
      social_links TEXT,
      about TEXT,
      phone_visible INTEGER DEFAULT 0,
      tariff TEXT DEFAULT 'free',
      tariff_expires DATETIME,
      consent_data INTEGER DEFAULT 0,
      consent_notifications INTEGER DEFAULT 0,
      is_registered INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      date DATETIME NOT NULL,
      address TEXT,
      map_link TEXT,
      price REAL DEFAULT 0,
      is_free INTEGER DEFAULT 1,
      participant_limit INTEGER DEFAULT 0,
      city_id INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (city_id) REFERENCES cities(id)
    );

    CREATE TABLE IF NOT EXISTS event_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'registered',
      payment_method TEXT DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tariff_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      price_monthly REAL DEFAULT 0,
      price_yearly REAL DEFAULT 0,
      features TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);

  // Seed cities
  const cityCount = wrapper.prepare('SELECT COUNT(*) as c FROM cities').get();
  if (!cityCount || cityCount.c === 0) {
    wrapper.prepare('INSERT INTO cities (name) VALUES (?)').run('Челябинск');
  }

  // Seed pages
  const pageCount = wrapper.prepare('SELECT COUNT(*) as c FROM pages').get();
  if (!pageCount || pageCount.c === 0) {
    wrapper.prepare('INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)').run('about', 'О нас', '<h2>SingleChel</h2><p>Приложение для знакомств через мероприятия в вашем городе. Мы помогаем одиноким людям находить интересные события и знакомиться с новыми людьми.</p>');
    wrapper.prepare('INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)').run('rules', 'Правила', '<h2>Правила сообщества</h2><ol><li>Будьте вежливы и уважительны</li><li>Не используйте платформу для спама</li><li>Соблюдайте правила мероприятий</li><li>Администрация оставляет за собой право блокировать нарушителей</li></ol>');
    wrapper.prepare('INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)').run('policy', 'Политика конфиденциальности', '<h2>Обработка персональных данных</h2><p>Мы собираем и обрабатываем ваши персональные данные в соответствии с законодательством РФ. Данные используются исключительно для работы сервиса.</p>');
    wrapper.prepare('INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)').run('support', 'Служба заботы', '<h2>Служба заботы</h2><p>Если у вас есть вопросы или проблемы, свяжитесь с нами:</p>');
    wrapper.prepare('INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)').run('consent_notifications', 'Согласие на уведомления', 'Я согласен получать уведомления о мероприятиях и новостях сервиса SingleChel через Telegram');
  }

  // Seed tariffs with correct names
  const tariffCount = wrapper.prepare('SELECT COUNT(*) as c FROM tariff_plans').get();
  if (!tariffCount || tariffCount.c === 0) {
    wrapper.prepare('INSERT INTO tariff_plans (name, tier, price_monthly, price_yearly, features) VALUES (?, ?, ?, ?, ?)').run('Бесплатный', 'free', 0, 0, JSON.stringify(['Просмотр мероприятий', 'Участие в мероприятиях']));
    wrapper.prepare('INSERT INTO tariff_plans (name, tier, price_monthly, price_yearly, features) VALUES (?, ?, ?, ?, ?)').run('Уровень 1', 'tier1', 499, 4990, JSON.stringify(['Просмотр мероприятий', 'Участие в мероприятиях', 'Просмотр профилей участников']));
    wrapper.prepare('INSERT INTO tariff_plans (name, tier, price_monthly, price_yearly, features) VALUES (?, ?, ?, ?, ?)').run('Уровень 2', 'tier2', 999, 9990, JSON.stringify(['Просмотр мероприятий', 'Участие в мероприятиях', 'Просмотр профилей участников', 'Приглашение участников', 'Каталог участников']));
  }

  // Seed demo events
  const eventCount = wrapper.prepare('SELECT COUNT(*) as c FROM events').get();
  if (!eventCount || eventCount.c === 0) {
    wrapper.prepare('INSERT INTO events (title, description, image_url, date, address, map_link, price, is_free, participant_limit, city_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('Вечер настольных игр', 'Приходите на вечер настольных игр! Отличная возможность познакомиться с новыми людьми в непринужденной обстановке.', '/uploads/event-default.jpg', '2026-04-15 19:00', 'ул. Кирова, 110, Челябинск', 'https://2gis.ru/chelyabinsk', 0, 1, 20, 1);
    wrapper.prepare('INSERT INTO events (title, description, image_url, date, address, map_link, price, is_free, participant_limit, city_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('Прогулка по городу', 'Пешая прогулка по историческому центру Челябинска с гидом.', '/uploads/event-default.jpg', '2026-04-20 12:00', 'пл. Революции, Челябинск', 'https://2gis.ru/chelyabinsk', 300, 0, 15, 1);
    wrapper.prepare('INSERT INTO events (title, description, image_url, date, address, map_link, price, is_free, participant_limit, city_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('Кулинарный мастер-класс', 'Готовим вместе итальянскую пасту. Все ингредиенты включены.', '/uploads/event-default.jpg', '2026-04-25 18:00', 'ул. Труда, 56, Челябинск', 'https://2gis.ru/chelyabinsk', 500, 0, 12, 1);
    wrapper.prepare('INSERT INTO events (title, description, image_url, date, address, map_link, price, is_free, participant_limit, city_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('Кинопоказ + обсуждение', 'Смотрим культовый фильм и обсуждаем его за чаем. Вход свободный!', '/uploads/event-default.jpg', '2026-05-02 20:00', 'ул. Свободы, 2, Челябинск', 'https://2gis.ru/chelyabinsk', 0, 1, 30, 1);
  }

  wrapper.save();

  // Auto-save every 30 seconds
  setInterval(() => { try { wrapper.save(); } catch {} }, 30000);

  return wrapper;
}

module.exports = { initDB, DB_PATH };
