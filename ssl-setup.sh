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

# Создание временного nginx.conf для первоначального получения сертификата
echo -e "${YELLOW}Создание временной конфигурации nginx...${NC}"
cat > nginx-temp.conf << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name $DOMAIN;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 200 "Temporary server for SSL setup\\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Запуск nginx с временной конфигурацией
echo -e "${YELLOW}Запуск nginx с временной конфигурацией...${NC}"
docker-compose up -d nginx

# Ожидание запуска nginx
echo -e "${YELLOW}Ожидание запуска nginx (10 секунд)...${NC}"
sleep 10

# Получение сертификата
echo -e "${YELLOW}Получение SSL сертификата от Let's Encrypt...${NC}"
docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    --network $(basename $(pwd))_life-story-network \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Проверка успешности получения сертификата
if [ -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Сертификат успешно получен!${NC}"

    # Остановка временного nginx
    echo -e "${YELLOW}Остановка временного nginx...${NC}"
    docker-compose down

    # Восстановление основной конфигурации nginx
    echo -e "${YELLOW}Восстановление основной конфигурации nginx...${NC}"
    rm nginx-temp.conf

    # Запуск всех сервисов с SSL
    echo -e "${YELLOW}Запуск всех сервисов с SSL поддержкой...${NC}"
    docker-compose up -d

    echo -e "${GREEN}🎉 SSL настроен успешно! Ваш сайт доступен по адресу: https://$DOMAIN${NC}"
    echo -e "${YELLOW}Для автоматического обновления сертификатов добавьте в crontab:${NC}"
    echo -e "${YELLOW}0 12 * * * /usr/bin/docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt -v $(pwd)/certbot/www:/var/www/certbot certbot/certbot renew --quiet${NC}"

else
    echo -e "${RED}❌ Ошибка получения сертификата!${NC}"
    echo -e "${YELLOW}Проверьте:${NC}"
    echo -e "${YELLOW}1. Домен $DOMAIN указывает на этот сервер${NC}"
    echo -e "${YELLOW}2. Порт 80 открыт и доступен из интернета${NC}"
    echo -e "${YELLOW}3. Нет других веб-серверов, занимающих порт 80${NC}"

    # Очистка при ошибке
    docker-compose down
    rm -f nginx-temp.conf
    exit 1
fi