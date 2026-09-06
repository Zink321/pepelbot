const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'posts.json');

// Структура данных: { "chatId_messageId": { ...postData... } }
let db = {};

// Загрузка базы при старте
function load() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            db = JSON.parse(data);
            console.log(`[DB] Загружено ${Object.keys(db).length} постов из очереди.`);
        } else {
            console.log('[DB] Файл базы не найден, создаем новую очередь.');
        }
    } catch (err) {
        console.error('[DB] Ошибка чтения файла:', err.message);
        db = {};
    }
}

// Сохранение базы в файл
function save() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
        console.error('[DB] Ошибка записи файла:', err.message);
    }
}

// Добавить пост в очередь
function addPost(key, postData) {
    db[key] = postData;
    save();
}

// Получить пост из очереди
function getPost(key) {
    return db[key];
}

// Удалить пост из очереди (после одобрения/отклонения)
function removePost(key) {
    if (db[key]) {
        delete db[key];
        save();
        return true;
    }
    return false;
}

// Получить все ключи (для восстановления при рестарте, если нужно)
function getAllKeys() {
    return Object.keys(db);
}

// Инициализация
load();

module.exports = {
    addPost,
    getPost,
    removePost,
    getAllKeys,
    save
};
