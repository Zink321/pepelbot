# Требования и развёртывание Telegram-бота

## Минимальные требования к серверу

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| CPU | 1 ядро | 1-2 ядра |
| RAM | 256 MB | 512 MB - 1 GB |
| Disk | 1 GB | 2-5 GB |
| OS | Linux (Ubuntu 20.04+) | Ubuntu 22.04 LTS |
| Node.js | 16.x | 18.x или 20.x |

**Примеры подходящих тарифов:**
- DigitalOcean Droplet: $4/мес (512 MB RAM)
- Hetzner Cloud: €4.50/мес (1 GB RAM)
- AWS t3.micro: ~$7/мес (1 GB RAM)
- VPS от российских провайдеров: от 150 руб/мес

---

## Пошаговая инструкция по развёртыванию

### Шаг 1: Подготовка сервера

```bash
# Подключитесь к серверу по SSH
ssh user@your-server-ip

# Обновите пакеты
sudo apt update && sudo apt upgrade -y

# Установите Node.js (версия 18.x)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверьте установку
node --version  # Должно показать v18.x.x
npm --version   # Должно показать 9.x.x или выше

# Установите PM2 для управления процессом
sudo npm install -g pm2
```

### Шаг 2: Загрузка файлов бота

```bash
# Создайте директорию для бота
mkdir -p ~/telegram-bot
cd ~/telegram-bot

# Скопируйте файлы bot.js и package.json на сервер
# Вариант 1: Через SCP с локального компьютера
# scp bot.js package.json user@your-server-ip:~/telegram-bot/

# Вариант 2: Создать файлы прямо на сервере
nano bot.js
# Вставьте содержимое bot.js, сохраните (Ctrl+O, Enter, Ctrl+X)

nano package.json
# Вставьте содержимое package.json, сохраните
```

### Шаг 3: Установка зависимостей

```bash
cd ~/telegram-bot
npm install --production
```

### Шаг 4: Настройка переменных окружения

```bash
# Создайте файл .env
nano .env
```

Вставьте следующее содержимое:
```env
BOT_TOKEN=ваш_токен_от_botfather
CHANNEL_ID=-100xxxxxxxxxx
ADMIN_ID=ваш_id_администратора
```

> **Важно:** Замените значения на ваши реальные данные!

### Шаг 5: Запуск бота через PM2

```bash
# Запустите бота
pm2 start bot.js --name "telegram-moderation-bot"

# Сохраните список процессов для автозапуска
pm2 save

# Настройте автозапуск при перезагрузке сервера
pm2 startup
# Выполните команду, которую выведет PM2 (будет содержать sudo env...)
```

### Шаг 6: Мониторинг и управление

```bash
# Просмотр логов в реальном времени
pm2 logs telegram-moderation-bot

# Просмотр статуса
pm2 status

# Перезапуск бота
pm2 restart telegram-moderation-bot

# Остановка бота
pm2 stop telegram-moderation-bot

# Просмотр использования ресурсов
pm2 monit
```

---

## Альтернатива: Docker (опционально)

Если предпочитаете контейнеризацию:

### Создайте Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY bot.js .
COPY .env .

CMD ["node", "bot.js"]
```

### Создайте docker-compose.yml

```yaml
version: '3.8'

services:
  telegram-bot:
    build: .
    container_name: telegram-moderation-bot
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
```

### Запуск через Docker

```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

---

## Безопасность

### 1. Настройте фаервол

```bash
# Разрешите только необходимые порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (если нужен)
sudo ufw allow 443/tcp   # HTTPS (если нужен)
sudo ufw enable
```

### 2. Защитите файл .env

```bash
# Установите правильные права доступа
chmod 600 .env
chown $USER:$USER .env
```

### 3. Регулярные обновления

```bash
# Добавьте в crontab для еженедельного обновления
crontab -e

# Добавьте строку:
0 3 * * 0 cd ~/telegram-bot && git pull && npm install --production && pm2 restart telegram-moderation-bot
```

---

## Резервное копирование

```bash
# Создайте скрипт для бэкапа
nano ~/backup-bot.sh
```

```bash
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/bot_backup_$DATE.tar.gz ~/telegram-bot
# Храните бэкапы не более 30 дней
find $BACKUP_DIR -name "bot_backup_*.tar.gz" -mtime +30 -delete
```

```bash
# Сделайте скрипт исполняемым
chmod +x ~/backup-bot.sh

# Добавьте в crontab ежедневный бэкап
crontab -e
# Добавьте строку:
0 2 * * * /home/user/backup-bot.sh
```

---

## Решение проблем

### Бот не запускается

```bash
# Проверьте логи
pm2 logs telegram-moderation-bot --lines 100

# Проверьте, запущен ли процесс
pm2 status

# Проверьте, установлен ли Node.js
node --version
```

### Бот не отвечает

```bash
# Перезапустите бота
pm2 restart telegram-moderation-bot

# Проверьте лимиты памяти
pm2 monit
```

### Ошибки в логах

- `TOKEN_INVALID` — проверьте токен в .env
- `CHANNEL_ID_INVALID` — убедитесь, что бот добавлен в канал как админ
- `ADMIN_ID_INVALID` — проверьте ваш ID администратора

---

## Миграция на другой сервер

```bash
# На старом сервере создайте бэкап
tar -czf bot_backup.tar.gz ~/telegram-bot

# Скачайте бэкап
scp user@old-server:~/bot_backup.tar.gz .

# Загрузите на новый сервер
scp bot_backup.tar.gz user@new-server:~

# На новом сервере распакуйте
ssh user@new-server
tar -xzf bot_backup.tar.gz
cd ~/telegram-bot
npm install --production
pm2 restart telegram-moderation-bot
```

---

## Полезные команды PM2

| Команда | Описание |
|---------|----------|
| `pm2 list` | Список всех процессов |
| `pm2 show <name>` | Детальная информация о процессе |
| `pm2 logs <name>` | Логи процесса |
| `pm2 restart <name>` | Перезапуск процесса |
| `pm2 stop <name>` | Остановка процесса |
| `pm2 delete <name>` | Удаление процесса из списка PM2 |
| `pm2 monit` | Мониторинг в реальном времени |
| `pm2 save` | Сохранение списка процессов |
| `pm2 startup` | Настройка автозапуска |

---

## Оптимизация для слабых серверов

Если у вас сервер с минимальными ресурсами (256 MB RAM):

1. Используйте Node.js 16.x (менее требователен к памяти)
2. Запускайте с флагом production:
   ```bash
   NODE_ENV=production pm2 start bot.js --name "telegram-bot"
   ```
3. Ограничьте память для Node.js:
   ```bash
   pm2 start bot.js --name "telegram-bot" --max-memory-restart 150M
   ```
4. Отключите лишние сервисы на сервере:
   ```bash
   sudo systemctl disable apache2
   sudo systemctl disable mysql
   ```

---

## Чек-лист перед запуском

- [ ] Токен бота получен от @BotFather
- [ ] Бот добавлен в канал как администратор
- [ ] CHANNEL_ID указан с префиксом `-100`
- [ ] ADMIN_ID указан правильно (можно узнать через @userinfobot)
- [ ] Файл .env создан и заполнен
- [ ] Права на .env установлены в 600
- [ ] PM2 настроен на автозапуск
- [ ] Фаервол настроен
- [ ] Логи читаются через `pm2 logs`

---

## Контакты поддержки

Если возникнут проблемы:
1. Проверьте логи: `pm2 logs telegram-moderation-bot`
2. Убедитесь, что все переменные в .env указаны верно
3. Проверьте, что бот имеет права администратора в канале
4. Убедитесь, что ваш ID администратора указан правильно
