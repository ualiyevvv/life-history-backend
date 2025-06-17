#!/bin/bash

# Скрипт для получения SSL сертификатов для домена cond.13lab.tech
# Убедитесь, что домен указывает на ваш сервер перед запуском!

# Настройки
DOMAIN="cond.13lab.tech"
EMAIL="ayan.d3v@gmail.com"  # ЗАМЕНИТЕ НА ВАШ EMAIL!

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Настройка SSL сертификатов для $DOMAIN ===${NC}"

# Проверка, что email изменен
if [ "$EMAIL" = "your-email@example.com" ]; then
    echo -e "${RED}ОШИБКА: Пожалуйста, измените EMAIL в скрипте на ваш настоящий email!${NC}"
    exit 1
fi

# Создание необходимых директорий
echo -e "${YELLOW}Создание директорий для certbot...${NC}"
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Остановка любых запущенных сервисов
echo -e "${YELLOW}Остановка любых запущенных Docker сервисов...${NC}"
docker-compose down

# Запуск простого временного nginx контейнера
echo -e "${YELLOW}Запуск временного nginx для получения сертификата...${NC}"
docker run -d --name temp-nginx \
    -p 80:80 \
    -v $(pwd)/certbot/www:/var/www/certbot \
    -v $(pwd)/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    nginx:alpine

# Создание временного nginx.conf
cat > nginx-temp.conf << EOF
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name $DOMAIN;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
            try_files \$uri \$uri/ =404;
        }

        location / {
            return 200 "Temporary server for SSL setup\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Перезапуск nginx с новой конфигурацией
echo -e "${YELLOW}Перезапуск nginx с правильной конфигурацией...${NC}"
docker stop temp-nginx && docker rm temp-nginx
docker run -d --name temp-nginx \
    -p 80:80 \
    -v $(pwd)/certbot/www:/var/www/certbot \
    -v $(pwd)/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    nginx:alpine

# Ожидание запуска nginx
echo -e "${YELLOW}Ожидание запуска nginx (5 секунд)...${NC}"
sleep 5

# Тестирование доступности
echo -e "${YELLOW}Тестирование доступности...${NC}"
curl -I http://localhost/ || echo "Nginx может быть недоступен локально, но это нормально"

# Получение сертификата
echo -e "${YELLOW}Получение SSL сертификата от Let's Encrypt...${NC}"
docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN

# Проверка успешности получения сертификата
if [ -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Сертификат успешно получен!${NC}"

    # Остановка временного nginx
    echo -e "${YELLOW}Остановка временного nginx...${NC}"
    docker stop temp-nginx && docker rm temp-nginx

    # Удаление временной конфигурации
    rm -f nginx-temp.conf

    # Запуск всех сервисов с SSL
    echo -e "${YELLOW}Запуск всех сервисов с SSL поддержкой...${NC}"
    docker-compose up -d

    # Ожидание запуска сервисов
    sleep 10

    # Проверка работы HTTPS
    echo -e "${YELLOW}Проверка работы HTTPS...${NC}"
    if curl -I https://$DOMAIN/ --connect-timeout 10 --max-time 30 > /dev/null 2>&1; then
        echo -e "${GREEN}🎉 SSL настроен успешно! Ваш сайт доступен по адресу: https://$DOMAIN${NC}"
    else
        echo -e "${YELLOW}⚠️  Сертификат получен, но HTTPS пока недоступен. Проверьте логи: docker-compose logs nginx${NC}"
    fi

    echo -e "${YELLOW}Для автоматического обновления сертификатов добавьте в crontab:${NC}"
    echo -e "${YELLOW}0 12 * * * cd $(pwd) && ./ssl-renew.sh >> /var/log/ssl-renew.log 2>&1${NC}"

else
    echo -e "${RED}❌ Ошибка получения сертификата!${NC}"
    echo -e "${YELLOW}Проверьте:${NC}"
    echo -e "${YELLOW}1. Домен $DOMAIN указывает на этот сервер${NC}"
    echo -e "${YELLOW}2. Порт 80 открыт и доступен из интернета${NC}"
    echo -e "${YELLOW}3. Нет других веб-серверов, занимающих порт 80${NC}"
    echo -e "${YELLOW}4. Логи certbot: docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt certbot/certbot logs${NC}"

    # Очистка при ошибке
    docker stop temp-nginx && docker rm temp-nginx
    rm -f nginx-temp.conf
    exit 1
fi