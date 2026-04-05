FROM node:20-alpine

WORKDIR /app

# Copy everything
COPY . .

# Install backend deps
WORKDIR /app/backend
RUN npm install --production

# Install frontend deps and build
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Back to root
WORKDIR /app

# Create necessary directories
RUN mkdir -p backend/data backend/uploads

EXPOSE 3000

CMD ["node", "backend/server.js"]
