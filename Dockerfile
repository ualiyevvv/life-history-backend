FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Создание директорий для загрузок и логов
RUN mkdir -p uploads/photos uploads/audio logs

# Установка прав доступа
RUN chown -R node:node /app

# Переключение на пользователя node
USER node

# Expose порт
EXPOSE 3003

# Запуск приложения
CMD ["node", "src/index.js"]