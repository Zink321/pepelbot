const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

// ЗАМЕНИТЕ НА ВАШ ТОКЕН ОТ @BotFather
const TOKEN = 'YOUR_BOT_TOKEN_HERE';

// ЗАМЕНИТЕ НА ID ВАШЕГО КАНАЛА (можно узнать через @userinfobot или добавив бота в канал)
const CHANNEL_ID = 'YOUR_CHANNEL_ID_HERE';

// ЗАМЕНИТЕ НА ВАШ TELEGRAM ID (можно узнать через @userinfobot)
const ADMIN_ID = YOUR_ADMIN_ID_HERE;

const bot = new TelegramBot(TOKEN, { polling: true });

// Хранилище заблокированных пользователей (в памяти)
const blockedUsers = new Set(); // множество заблокированных пользователей

// Функция экранирования текста для HTML режима
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    if (blockedUsers.has(chatId)) {
        bot.sendMessage(chatId, 'Вы заблокированы и не можете использовать этого бота.');
        return;
    }
    
    const welcomeMessage = `Добро пожаловать!

📝 Отправьте мне пост (текст, фото, видео и т.д.), который вы хотите опубликовать в канале.
Я передам его администратору на рассмотрение.`;
    
    bot.sendMessage(chatId, welcomeMessage);
});

// Обработка всех типов сообщений (текст, фото, видео и т.д.)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    
    // Игнорируем сообщения от заблокированных
    if (blockedUsers.has(chatId)) {
        return;
    }
    
    // Игнорируем сообщения от админа
    if (chatId === ADMIN_ID) {
        return;
    }
    
    // Игнорируем сообщения не из личного чата
    if (msg.chat.type !== 'private') {
        return;
    }
    
    // Проверяем, есть ли контент в сообщении
    const hasContent = msg.text || msg.photo || msg.video || msg.audio || 
                       msg.voice || msg.document || msg.animation || msg.sticker;
    
    if (!hasContent) {
        return;
    }
    
    // Получаем информацию о пользователе
    const username = msg.from.username || msg.from.first_name || 'Аноним';
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const fullName = [firstName, lastName].filter(n => n).join(' ');
    
    // Определяем тип контента и копируем данные
    let postType = 'text';
    let contentData = {};
    
    if (msg.text) {
        postType = 'text';
        contentData = { text: msg.text };
    } else if (msg.photo) {
        postType = 'photo';
        contentData = { 
            photo: msg.photo[msg.photo.length - 1].file_id, 
            caption: msg.caption || '' 
        };
    } else if (msg.video) {
        postType = 'video';
        contentData = { 
            video: msg.video.file_id, 
            caption: msg.caption || '' 
        };
    } else if (msg.audio) {
        postType = 'audio';
        contentData = { 
            audio: msg.audio.file_id, 
            caption: msg.caption || '' 
        };
    } else if (msg.voice) {
        postType = 'voice';
        contentData = { 
            voice: msg.voice.file_id, 
            caption: msg.caption || '' 
        };
    } else if (msg.document) {
        postType = 'document';
        contentData = { 
            document: msg.document.file_id, 
            caption: msg.caption || '' 
        };
    } else if (msg.animation) {
        postType = 'animation';
        contentData = { 
            animation: msg.animation.file_id, 
            caption: msg.caption || '' 
        };
    } else if (msg.sticker) {
        postType = 'sticker';
        contentData = { 
            sticker: msg.sticker.file_id 
        };
    }
    
    // Сохраняем пост в базу данных (JSON файл)
    const tempMessageId = Date.now();
    db.addPost(tempMessageId.toString(), {
        userId: userId,
        username: username,
        fullName: fullName,
        content: contentData,
        type: postType,
        originalChatId: chatId
    });
    
    // Формируем сообщение для админа
    const adminMessage = `📨 Новый пост на модерацию!\n\n` +
                         `👤 Автор: ${fullName} (@${username})\n` +
                         `🆔 ID: ${userId}\n\n` +
                         `Нажмите кнопку ниже для принятия решения:`;
    
    // Создаём клавиатуру с кнопками
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Одобрить', callback_data: `approve_${tempMessageId}` },
                    { text: '❌ Отклонить', callback_data: `reject_${tempMessageId}` }
                ]
            ]
        }
    };
    
    // Отправляем пост админу
    let sendPromise;
    
    switch (postType) {
        case 'text':
            sendPromise = bot.sendMessage(ADMIN_ID, `${adminMessage}\n\n📝 Содержание:\n${contentData.text}`, keyboard);
            break;
        case 'photo':
            sendPromise = bot.sendPhoto(ADMIN_ID, contentData.photo, { caption: `${adminMessage}\n\n📝 Описание: ${contentData.caption}` }, keyboard.reply_markup);
            break;
        case 'video':
            sendPromise = bot.sendVideo(ADMIN_ID, contentData.video, { caption: `${adminMessage}\n\n📝 Описание: ${contentData.caption}` }, keyboard.reply_markup);
            break;
        case 'audio':
            sendPromise = bot.sendAudio(ADMIN_ID, contentData.audio, { caption: `${adminMessage}\n\n📝 Описание: ${contentData.caption}` }, keyboard.reply_markup);
            break;
        case 'voice':
            sendPromise = bot.sendVoice(ADMIN_ID, contentData.voice, { caption: `${adminMessage}\n\n📝 Описание: ${contentData.caption}` }, keyboard.reply_markup);
            break;
        case 'document':
            sendPromise = bot.sendDocument(ADMIN_ID, contentData.document, { caption: `${adminMessage}\n\n📝 Описание: ${contentData.caption}` }, keyboard.reply_markup);
            break;
        case 'animation':
            sendPromise = bot.sendAnimation(ADMIN_ID, contentData.animation, { caption: `${adminMessage}\n\n📝 Описание: ${contentData.caption}` }, keyboard.reply_markup);
            break;
        case 'sticker':
            sendPromise = bot.sendSticker(ADMIN_ID, contentData.sticker, keyboard.reply_markup)
                .then(sentMsg => bot.sendMessage(ADMIN_ID, adminMessage, keyboard));
            break;
    }
    
    if (sendPromise) {
        sendPromise.then(() => {
            bot.sendMessage(chatId, '✅ Ваш пост отправлен на модерацию!\nОжидайте решения администратора.');
        }).catch(err => {
            console.error('Ошибка при отправке админу:', err);
            bot.sendMessage(chatId, '❌ Произошла ошибка при отправке поста. Попробуйте позже.');
        });
    }
});

// Обработка нажатий на кнопки (callback queries)
bot.on('callback_query', (query) => {
    const data = query.data;
    const messageId = query.message.message_id;
    
    // Извлекаем действие и ID поста
    const parts = data.split('_');
    const action = parts[0];
    const postId = parseInt(parts[1]);
    
    const post = db.getPost(postId.toString());
    
    if (!post) {
        bot.answerCallbackQuery(query.id, { 
            text: 'Этот пост уже был обработан или не найден.', 
            show_alert: true 
        });
        return;
    }
    
    if (action === 'approve') {
        // Одобряем пост - используем HTML режим для корректной работы с спецсимволами
        const escapedName = escapeHtml(post.fullName);
        const userMention = `<a href="tg://user?id=${post.userId}">${escapedName}</a>`;
        const signature = `\n\n${userMention}\n#от_подписчика`;
        
        let sendPromise;
        
        switch (post.type) {
            case 'text':
                sendPromise = bot.sendMessage(CHANNEL_ID, escapeHtml(post.content.text) + signature, { parse_mode: 'HTML' });
                break;
            case 'photo':
                sendPromise = bot.sendPhoto(CHANNEL_ID, post.content.photo, { 
                    caption: escapeHtml(post.content.caption || '') + signature, 
                    parse_mode: 'HTML' 
                });
                break;
            case 'video':
                sendPromise = bot.sendVideo(CHANNEL_ID, post.content.video, { 
                    caption: escapeHtml(post.content.caption || '') + signature, 
                    parse_mode: 'HTML' 
                });
                break;
            case 'audio':
                sendPromise = bot.sendAudio(CHANNEL_ID, post.content.audio, { 
                    caption: escapeHtml(post.content.caption || '') + signature, 
                    parse_mode: 'HTML' 
                });
                break;
            case 'voice':
                sendPromise = bot.sendVoice(CHANNEL_ID, post.content.voice, { 
                    caption: escapeHtml(post.content.caption || '') + signature, 
                    parse_mode: 'HTML' 
                });
                break;
            case 'document':
                sendPromise = bot.sendDocument(CHANNEL_ID, post.content.document, { 
                    caption: escapeHtml(post.content.caption || '') + signature, 
                    parse_mode: 'HTML' 
                });
                break;
            case 'animation':
                sendPromise = bot.sendAnimation(CHANNEL_ID, post.content.animation, { 
                    caption: escapeHtml(post.content.caption || '') + signature, 
                    parse_mode: 'HTML' 
                });
                break;
            case 'sticker':
                sendPromise = bot.sendSticker(CHANNEL_ID, post.content.sticker)
                    .then(() => bot.sendMessage(CHANNEL_ID, `${userMention}\n#от_подписчика`, { parse_mode: 'HTML' }));
                break;
        }
        
        if (sendPromise) {
            sendPromise.then(() => {
                // Удаляем кнопки у сообщения админа
                bot.editMessageReplyMarkup({ inline_keyboard: [] }, { 
                    chat_id: ADMIN_ID, 
                    message_id: messageId 
                }).catch(() => {}); // Игнорируем ошибку если сообщение не изменено
                
                // Добавляем отметку об одобрении
                bot.editMessageText(`${query.message.text}\n\n✅ ПОСТ ОДОБРЕН И ОПУБЛИКОВАН`, {
                    chat_id: ADMIN_ID,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }).catch(() => {}); // Игнорируем ошибку если сообщение не изменено
                
                // Уведомляем пользователя
                bot.sendMessage(post.originalChatId, '✅ Ваш пост был одобрен и опубликован в канале!\nСпасибо за ваш вклад! 🎉').catch(() => {});
                
                // Удаляем пост из базы данных
                db.removePost(postId.toString());
            }).catch(err => {
                console.error('Ошибка при публикации:', err);
                bot.answerCallbackQuery(query.id, { 
                    text: 'Ошибка при публикации в канале. Проверьте, что бот добавлен в канал как администратор.', 
                    show_alert: true 
                });
            });
        }
        
        bot.answerCallbackQuery(query.id, { text: 'Пост одобрен!' });
        
    } else if (action === 'reject') {
        // Отклоняем пост
        // Удаляем кнопки у сообщения админа
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { 
            chat_id: ADMIN_ID, 
            message_id: messageId 
        });
        
        // Добавляем отметку об отклонении
        bot.editMessageText(`${query.message.text}\n\n❌ ПОСТ ОТКЛОНЁН`, {
            chat_id: ADMIN_ID,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        
        // Уведомляем пользователя
        bot.sendMessage(post.originalChatId, '❌ Ваш пост был отклонён администратором.\nНе расстраивайтесь, попробуйте отправить другой!');
        
        // Удаляем пост из базы данных
        db.removePost(postId.toString());
        
        bot.answerCallbackQuery(query.id, { text: 'Пост отклонён!' });
    } else if (action === 'block_user') {
        // Блокируем пользователя
        const userIdToBlock = parseInt(data.replace('block_user_', ''));
        blockedUsers.add(userIdToBlock);
        
        bot.answerCallbackQuery(query.id, { text: `Пользователь ${userIdToBlock} заблокирован!` });
        
        bot.editMessageText(`${query.message.text}\n\n🚫 ПОЛЬЗОВАТЕЛЬ ЗАБЛОКИРОВАН`, {
            chat_id: ADMIN_ID,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
    }
});

// Команда /block - заблокировать пользователя (ответом на сообщение)
bot.onText(/\/block/, (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId !== ADMIN_ID) {
        bot.sendMessage(chatId, 'Эта команда доступна только администратору.');
        return;
    }
    
    // Проверяем, есть ли ответ на сообщение
    if (msg.reply_to_message) {
        const userIdToBlock = msg.reply_to_message.from.id;
        blockedUsers.add(userIdToBlock);
        
        bot.sendMessage(chatId, `✅ Пользователь ${msg.reply_to_message.from.first_name} (ID: ${userIdToBlock}) заблокирован.`);
        bot.sendMessage(userIdToBlock, '🚫 Вы были заблокированы администратором и больше не можете использовать этого бота.');
    } else {
        bot.sendMessage(chatId, 'Используйте эту команду как ответ на сообщение пользователя, которого хотите заблокировать.\nПример: ответьте на сообщение командой /block');
    }
});

// Команда /unblock - разблокировать пользователя
bot.onText(/\/unblock (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (chatId !== ADMIN_ID) {
        bot.sendMessage(chatId, 'Эта команда доступна только администратору.');
        return;
    }
    
    const userIdToUnblock = parseInt(match[1]);
    blockedUsers.delete(userIdToUnblock);
    
    bot.sendMessage(chatId, `✅ Пользователь с ID ${userIdToUnblock} разблокирован.`);
});

// Команда /unblockall - разблокировать всех
bot.onText(/\/unblockall/, (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId !== ADMIN_ID) {
        bot.sendMessage(chatId, 'Эта команда доступна только администратору.');
        return;
    }
    
    const count = blockedUsers.size;
    blockedUsers.clear();
    
    bot.sendMessage(chatId, `✅ Все пользователи разблокированы. Всего: ${count}`);
});

// Команда /stats - показать статистику
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId !== ADMIN_ID) {
        bot.sendMessage(chatId, 'Эта команда доступна только администратору.');
        return;
    }
    
    const pendingCount = db.getAllKeys().length;
    const blockedCount = blockedUsers.size;
    
    bot.sendMessage(chatId, `📊 Статистика бота:\n\n` +
                           `📨 Постов на модерации: ${pendingCount}\n` +
                           `🚫 Заблокировано пользователей: ${blockedCount}`);
});

// Восстановление очереди постов при перезапуске (информационное сообщение админу)
setTimeout(() => {
    const pendingKeys = db.getAllKeys();
    if (pendingKeys.length > 0) {
        console.log(`[DB] При старте восстановлено ${pendingKeys.length} постов из очереди.`);
        bot.sendMessage(ADMIN_ID, `🔄 Бот перезапущен. В очереди на модерацию осталось ${pendingKeys.length} постов.`);
    }
}, 2000);

console.log('Бот запущен...');
console.log('Не забудьте заменить TOKEN, CHANNEL_ID и ADMIN_ID в коде!');
