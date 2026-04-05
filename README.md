# 🎉 SingleChel — Telegram Mini App MVP

Приложение для знакомств через мероприятия в Telegram.

## 📁 Структура проекта

```
singlechel/
├── backend/
│   ├── server.js          # Express API сервер
│   ├── database.js        # SQLite схема и сиды
│   ├── package.json
│   ├── data/              # SQLite БД (создаётся автоматически)
│   └── uploads/           # Загруженные файлы
├── frontend/
│   ├── index.html         # Entry point с Telegram WebApp SDK
│   ├── vite.config.js     # Vite конфигурация
│   ├── package.json
│   └── src/
│       ├── main.jsx       # React entry
│       ├── App.jsx        # Роутинг и состояние
│       ├── api.js         # API клиент + Telegram utils
│       ├── styles.css     # Глобальные стили
│       └── pages/
│           ├── Register.jsx     # Регистрация
│           ├── Main.jsx         # Главный экран
│           ├── Event.jsx        # Детали мероприятия
│           ├── Tariffs.jsx      # Тарифы
│           ├── Payment.jsx      # Оплата (мок)
│           ├── Profile.jsx      # Личный кабинет
│           ├── ProfileEdit.jsx  # Редактирование профиля
│           ├── UserProfile.jsx  # Профиль другого пользователя
│           ├── Catalog.jsx      # Каталог участников
│           ├── PageView.jsx     # Просмотр страниц
│           └── Support.jsx      # Служба заботы
├── admin/
│   └── index.html         # Админ-панель (standalone SPA)
├── .env.example
├── setup.sh
└── README.md
```

## ⚙️ Технологический стек

| Компонент | Технология | Стоимость |
|-----------|-----------|-----------|
| Frontend | React 18 + Vite | Бесплатно |
| Backend | Node.js + Express | Бесплатно |
| БД | SQLite (better-sqlite3) | Бесплатно |
| Стили | Чистый CSS | Бесплатно |
| Админка | Vanilla JS SPA | Бесплатно |
| Хостинг | Railway / Render / Fly.io | Free tier |

---

## 🚀 Быстрый старт

### Требования
- Node.js >= 18
- npm >= 9

### 1. Установка

```bash
git clone <repo-url> singlechel
cd singlechel
chmod +x setup.sh
./setup.sh
```

Или вручную:

```bash
# Backend
cd backend && npm install && cd ..

# Frontend  
cd frontend && npm install && cd ..

# Скопировать .env
cp .env.example .env
```

### 2. Настройка

Отредактируйте `.env`:
```
BOT_TOKEN=ваш_токен_бота
PORT=3000
ADMIN_SECRET=ваш_секретный_ключ
```

### 3. Сборка фронтенда

```bash
cd frontend
npm run build
cd ..
```

### 4. Запуск

```bash
cd backend
node server.js
```

Сервер будет доступен по адресу:
- 📱 Фронтенд: http://localhost:3000
- 🔧 Админ-панель: http://localhost:3000/admin

### 5. Режим разработки

```bash
# Терминал 1 — Backend
cd backend && node server.js

# Терминал 2 — Frontend (hot reload)
cd frontend && npm run dev
```

Frontend dev server: http://localhost:5173 (проксирует API на :3000)

---

## 🔐 Настройка Telegram Mini App

### Шаг 1: Создайте бота
1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен в `.env`

### Шаг 2: Настройте Mini App
1. В BotFather отправьте `/mybots`
2. Выберите бота → Bot Settings → Menu Button
3. Укажите URL вашего приложения (после деплоя)

Или через BotFather:
```
/setmenubutton
```
URL: `https://your-domain.com`
Button text: `Открыть SingleChel`

### Шаг 3: Включите WebApp
В BotFather:
```
/mybots → ваш бот → Bot Settings → Menu Button → Configure
```

---

## 🔧 Настройка первого администратора

После регистрации первого пользователя, сделайте его администратором:

```bash
curl -X POST http://localhost:3000/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": "ВАШ_TELEGRAM_ID", "secret": "singlechel-admin-2026"}'
```

Ваш Telegram ID можно узнать через [@userinfobot](https://t.me/userinfobot).

---

## 🚀 Деплой (бесплатный)

### Вариант 1: Railway (рекомендуется)

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. Создайте проект из GitHub
3. Добавьте переменные окружения (BOT_TOKEN, ADMIN_SECRET)
4. Deploy автоматический

Настройте start command:
```
cd frontend && npm install && npm run build && cd ../backend && npm install && node server.js
```

### Вариант 2: Render

1. [render.com](https://render.com) → New Web Service
2. Connect GitHub repo
3. Build: `cd frontend && npm install && npm run build && cd ../backend && npm install`
4. Start: `cd backend && node server.js`
5. Добавьте env vars

### Вариант 3: Fly.io

```bash
# Установите flyctl
curl -L https://fly.io/install.sh | sh

# Инициализация
fly launch

# Деплой
fly deploy

# Секреты
fly secrets set BOT_TOKEN=your_token ADMIN_SECRET=your_secret
```

### Вариант 4: VPS (самый гибкий)

```bash
# На сервере
git clone <repo> singlechel
cd singlechel
./setup.sh
cd frontend && npm run build && cd ..

# Запуск через PM2
npm install -g pm2
cd backend
pm2 start server.js --name singlechel
pm2 save
pm2 startup
```

Настройте Nginx как reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

Для HTTPS (обязателен для Telegram!):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 📱 Функционал

### Пользователь
- ✅ Регистрация с согласиями
- ✅ Главный экран с мероприятиями
- ✅ Просмотр деталей мероприятия
- ✅ Запись/отмена участия
- ✅ Профиль с фото
- ✅ Тарифы (Free / Tier1 / Tier2)
- ✅ Мок-оплата (СБП / на месте)
- ✅ Каталог участников (Tier2)
- ✅ Просмотр профилей (Tier1+)
- ✅ Страницы (О нас, Правила, Политика)
- ✅ Служба заботы
- ✅ Выбор города

### Админ-панель
- ✅ CRUD мероприятий
- ✅ Управление участниками
- ✅ Просмотр всех пользователей
- ✅ Управление тарифами пользователей
- ✅ Назначение администраторов
- ✅ Редактирование страниц (HTML)
- ✅ Управление городами

---

## 📈 Масштабирование

### Ближайшие улучшения
1. **PostgreSQL** вместо SQLite (Supabase / Neon бесплатный tier)
2. **Redis** для кэширования и сессий
3. **Реальные платежи**: ЮKassa, Тинькофф, CloudPayments
4. **Push-уведомления** через Telegram Bot API
5. **Загрузка изображений** в S3/Cloudflare R2

### Среднесрочные
6. Telegram Bot команды (/start, inline buttons)
7. Система рейтинга и отзывов
8. Чат между участниками
9. Рекомендательная система
10. Геолокация и карта мероприятий

### Долгосрочные
11. Масштабирование на другие города
12. AI-matching участников
13. Партнёрская программа
14. Мобильное приложение (React Native)
15. Аналитика и метрики (PostHog)

---

## 🛡 Безопасность

- Telegram WebApp initData валидируется на сервере
- HMAC-SHA256 проверка подлинности данных
- SQL инъекции предотвращены через prepared statements
- Файлы загружаются с уникальными именами
- Админ-доступ защищён проверкой is_admin

---

## 📄 Лицензия

MIT
