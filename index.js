const TelegramBot = require('node-telegram-bot-api');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 6406642001;

const bot = new TelegramBot(TOKEN, { polling: true });

const DATA_FILE = path.join(__dirname, 'stats.json');

let stats = {
  users: [],
  downloads: 0,
  videos: 0,
  audios: 0
};

if (fs.existsSync(DATA_FILE)) {
  try {
    stats = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.log('Stats file error');
  }
}

function saveStats() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
}

const pending = new Map();

function addUser(user) {
  if (!stats.users.some(u => u.id === user.id)) {
    stats.users.push({
      id: user.id,
      date: new Date().toISOString()
    });
    saveStats();
  }
}

bot.onText(/\/start/, (msg) => {
  addUser(msg.from);

  bot.sendMessage(
    msg.chat.id,
    '👋 Welcome to ArewaSave!\n\n' +
    '📥 Send me a video link from a supported platform.\n\n' +
    'I will help you download Video or MP3.\n\n' +
    '🚀 ArewaSave makes downloading easier!'
  );
});

bot.onText(/^\/stats(?:@\w+)?$/, (msg) => {
  console.log('Stats command received from:', msg.from.id);

  if (String(msg.from.id) !== String(ADMIN_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
  }

  const today = new Date().toISOString().slice(0, 10);

  const usersToday = stats.users.filter(u =>
    u.date.slice(0, 10) === today
  ).length;

  bot.sendMessage(
    msg.chat.id,
    '📊 AREWASAVE STATISTICS\n\n' +
    '👥 Total Users: ' + stats.users.length + '\n' +
    '📅 Users Today: ' + usersToday + '\n' +
    '📥 Total Downloads: ' + stats.downloads + '\n' +
    '🎬 Videos: ' + stats.videos + '\n' +
    '🎵 Audios: ' + stats.audios
  );
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  addUser(msg.from);

  const url = msg.text.trim();

  if (!/^https?:\/\//i.test(url)) {
    return bot.sendMessage(msg.chat.id, 'Please send a valid link.');
  }

  if (!/(youtube\.com|youtu\.be|tiktok\.com|facebook\.com|instagram\.com)/i.test(url)) {
    return bot.sendMessage(msg.chat.id, '❌ This platform is not supported.');
  }

  pending.set(msg.from.id, url);

  bot.sendMessage(msg.chat.id, 'Choose your download format:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎬 Video', callback_data: 'video' },
          { text: '🎵 MP3', callback_data: 'audio' }
        ]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const url = pending.get(userId);

  if (!url) {
    return bot.answerCallbackQuery(query.id, {
      text: 'Please send the link again.'
    });
  }

  const mode = query.data;

  if (mode !== 'video' && mode !== 'audio') {
    return bot.answerCallbackQuery(query.id);
  }

  await bot.answerCallbackQuery(query.id);

  pending.delete(userId);

  const folder = path.join(__dirname, 'downloads');
  fs.mkdirSync(folder, { recursive: true });

  const filename = Date.now().toString();
  const output = path.join(folder, filename);

  const file = mode === 'audio'
    ? output + '.mp3'
    : output + '.mp4';

  const options = mode === 'audio'
    ? {
        output: output + '.%(ext)s',
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: 0
      }
    : {
        output: output + '.%(ext)s',
        format: 'best[ext=mp4]/best',
        mergeOutputFormat: 'mp4'
      };

  const status = await bot.sendMessage(chatId, '⏳ Downloading...');

  try {
    await youtubedl(url, options);

    const actualFile = mode === 'audio'
      ? fs.readdirSync(folder).find(f => f.startsWith(filename))
      : fs.readdirSync(folder).find(f => f.startsWith(filename));

    if (!actualFile) {
      throw new Error('File not found');
    }

    const filePath = path.join(folder, actualFile);

    if (mode === 'audio') {
      await bot.sendAudio(chatId, filePath);
      stats.audios++;
    } else {
      try {
        await bot.sendVideo(chatId, filePath);
      } catch (e) {
        await bot.sendDocument(chatId, filePath);
      }
      stats.videos++;
    }

    stats.downloads++;
    saveStats();

    await bot.deleteMessage(chatId, status.message_id);

    fs.unlinkSync(filePath);

  } catch (error) {
    console.log(error);

    bot.sendMessage(
      chatId,
      '❌ Download failed. Please try another link.'
    );

    try {
      bot.deleteMessage(chatId, status.message_id);
    } catch (e) {}
  }
});

console.log('ArewaSave is running!');
