#!/bin/bash

# Упрощенный скрипт для получения SSL сертификатов
# Использует standalone режим certbot

# Настройки
DOMAIN="cond.13lab.tech"
EMAIL="ayan.d3v@gmail.com"  # ЗАМЕНИТЕ НА ВАШ EMAIL!

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Упрощенная настройка SSL сертификатов для $DOMAIN ===${NC}"

# Проверка, что email изменен
if [ "$EMAIL" = "your-email@example.com" ]; then
    echo -e "${RED}ОШИБКА: Пожалуйста, измените EMAIL в скрипте на ваш настоящий email!${NC}"
    exit 1
fi

# Создание необходимых директорий
echo -e "${YELLOW}Создание директорий для certbot...${NC}"
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Остановка всех Docker сервисов (освобождаем порт 80)
echo -e "${YELLOW}Остановка всех Docker сервисов...${NC}"
docker-compose down
docker stop $(docker ps -q) 2>/dev/null || true

# Очистка старых временных файлов/папок
echo -e "${YELLOW}Очистка временных файлов...${NC}"
rm -rf nginx-temp.conf 2>/dev/null || true
rm -f nginx-temp.conf 2>/dev/null || true

# Проверка, что порт 80 свободен
echo -e "${YELLOW}Проверка доступности порта 80...${NC}"
if netstat -tlnp | grep :80 >/dev/null; then
    echo -e "${RED}Порт 80 занят! Останавливаем процессы...${NC}"
    sudo pkill -f ":80" 2>/dev/null || true
    sleep 2
fi

# Получение сертификата в standalone режиме
echo -e "${YELLOW}Получение SSL сертификата от Let's Encrypt (standalone режим)...${NC}"
docker run --rm \
    -p 80:80 \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN

# Проверка успешности получения сертификата
if [ -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}✅ Сертификат успешно получен!${NC}"

    # Запуск всех сервисов с SSL
    echo -e "${YELLOW}Запуск всех сервисов с SSL поддержкой...${NC}"
    docker-compose up -d

    # Ожидание запуска сервисов
    echo -e "${YELLOW}Ожидание запуска сервисов (15 секунд)...${NC}"
    sleep 15

    # Проверка работы HTTPS
    echo -e "${YELLOW}Проверка работы HTTPS...${NC}"
    if curl -I https://$DOMAIN/ --connect-timeout 10 --max-time 30 --insecure > /dev/null 2>&1; then
        echo -e "${GREEN}🎉 SSL настроен успешно! Ваш сайт доступен по адресу: https://$DOMAIN${NC}"
    else
        echo -e "${YELLOW}⚠️  Сертификат получен, но HTTPS пока недоступен.${NC}"
        echo -e "${YELLOW}Проверьте логи: docker-compose logs nginx${NC}"
        echo -e "${YELLOW}Может потребоваться несколько минут для полного запуска.${NC}"
    fi

    # Информация о сертификате
    echo -e "${YELLOW}Информация о сертификате:${NC}"
    docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt certbot/certbot certificates

    echo -e "${YELLOW}Для автоматического обновления сертификатов добавьте в crontab:${NC}"
    echo -e "${YELLOW}0 12 * * * cd $(pwd) && ./ssl-renew.sh >> /var/log/ssl-renew.log 2>&1${NC}"

else
    echo -e "${RED}❌ Ошибка получения сертификата!${NC}"
    echo -e "${YELLOW}Возможные причины:${NC}"
    echo -e "${YELLOW}1. Домен $DOMAIN не указывает на этот сервер (IP: $(curl -s -4 ifconfig.me))${NC}"
    echo -e "${YELLOW}2. Порт 80 недоступен из интернета${NC}"
    echo -e "${YELLOW}3. Файрвол блокирует соединения${NC}"

    echo -e "${YELLOW}Дополнительная диагностика:${NC}"
    echo -e "${YELLOW}nslookup $DOMAIN${NC}"
    nslookup $DOMAIN

    echo -e "${YELLOW}Тест доступности порта 80:${NC}"
    timeout 5 nc -zv $DOMAIN 80 || echo "Порт 80 недоступен"

    exit 1
fi