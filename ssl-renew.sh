#!/bin/bash

# Скрипт для автоматического обновления SSL сертификатов
# Рекомендуется запускать через cron раз в день

# Настройки
DOMAIN="cond.13lab.tech"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "$(date): Начало проверки обновления SSL сертификатов для $DOMAIN"

# Переход в директорию проекта
cd "$PROJECT_DIR"

# Проверка и обновление сертификатов
echo -e "${YELLOW}Проверка необходимости обновления сертификатов...${NC}"

# Запуск обновления сертификатов
docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot renew --quiet

# Проверка кода выхода
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Проверка сертификатов завершена успешно${NC}"

    # Проверка, были ли обновлены сертификаты
    if docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt certbot/certbot certificates | grep -q "VALID"; then
        echo -e "${GREEN}Сертификаты актуальны или успешно обновлены${NC}"

        # Перезагрузка nginx для применения новых сертификатов (если они были обновлены)
        echo -e "${YELLOW}Перезагрузка nginx...${NC}"
        docker-compose exec nginx nginx -s reload

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Nginx успешно перезагружен${NC}"
        else
            echo -e "${RED}❌ Ошибка перезагрузки nginx${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Ошибка при обновлении сертификатов${NC}"
    exit 1
fi

echo "$(date): Завершение проверки обновления SSL сертификатов"