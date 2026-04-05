#!/bin/bash
set -e

echo "🚀 SingleChel — Установка MVP"
echo "================================"

# Backend dependencies
echo ""
echo "📦 Установка зависимостей бэкенда..."
cd backend
npm install
cd ..

# Frontend dependencies
echo ""
echo "📦 Установка зависимостей фронтенда..."
cd frontend
npm install
cd ..

# Create uploads directory and default images
echo ""
echo "📁 Создание директорий..."
mkdir -p backend/uploads
mkdir -p backend/data

# Create placeholder event image
echo "🖼 Создание изображений по умолчанию..."
cat > backend/uploads/event-default.svg << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="#1a1a24"/>
  <text x="200" y="90" text-anchor="middle" fill="#ff5e7a" font-size="48">🎉</text>
  <text x="200" y="130" text-anchor="middle" fill="#9090a7" font-family="sans-serif" font-size="14">SingleChel Event</text>
</svg>
SVGEOF

# Copy .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 .env файл создан (отредактируйте BOT_TOKEN!)"
fi

echo ""
echo "✅ Установка завершена!"
echo ""
echo "🔧 Следующие шаги:"
echo "  1. Отредактируйте .env файл (укажите BOT_TOKEN)"
echo "  2. Соберите фронтенд: cd frontend && npm run build"
echo "  3. Запустите сервер: cd backend && node server.js"
echo "  4. Откройте http://localhost:3000"
echo "  5. Админ-панель: http://localhost:3000/admin"
echo ""
echo "🎉 Для разработки:"
echo "  Терминал 1: cd backend && node server.js"
echo "  Терминал 2: cd frontend && npm run dev"
echo "  Откройте http://localhost:5173"
