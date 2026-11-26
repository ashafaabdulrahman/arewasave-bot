const TelegramBot = require("node-telegram-bot-api");
const youtubedl = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  console.error("BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const allowedDomains = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "facebook.com",
  "fb.watch",
  "instagram.com"
];

function isAllowedUrl(text) {
  try {
    const url = new URL(text);
    return allowedDomains.some(domain =>
      url.hostname === domain || url.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  if (text === "/start") {
    return bot.sendMessage(
      chatId,
      "Welcome to ArewaSave! 📥\n\nSend me a public video link from YouTube, TikTok, Instagram or Facebook."
    );
  }

  if (!isAllowedUrl(text)) {
    return bot.sendMessage(
      chatId,
      "❌ Please send a valid link from YouTube, TikTok, Facebook or Instagram."
    );
  }

  bot.sendMessage(chatId, "Choose what you want to download:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎬 Video", callback_data: "video" },
          { text: "🎵 MP3", callback_data: "audio" }
        ]
      ]
    }
  });

  bot.once("callback_query", async (query) => {
    if (query.message.chat.id !== chatId) return;

    const mode = query.data;
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "arewasave-"));

    try {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, "⏳ Processing your link. Please wait...");

      const options = {
        output: path.join(folder, "%(title)s.%(ext)s"),
        noPlaylist: true
      };

      if (mode === "audio") {
        options.extractAudio = true;
        options.audioFormat = "mp3";
      } else {
        options.format = "best[height<=720]";
      }

      await youtubedl(text, options);

      const files = fs.readdirSync(folder);
      const file = files.find(name => !name.endsWith(".part"));

      if (!file) {
        throw new Error("Downloaded file not found");
      }

      const filePath = path.join(folder, file);

      if (mode === "audio") {
        await bot.sendAudio(chatId, filePath);
      } else {
        await bot.sendVideo(chatId, filePath);
      }

      await bot.sendMessage(chatId, "✅ Download completed!");
    } catch (error) {
      console.error(error);
      await bot.sendMessage(
        chatId,
        "⚠️ Download failed. The link may be unavailable or unsupported."
      );
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

console.log("ArewaSave is running!");
