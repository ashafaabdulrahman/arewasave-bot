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
const pending = new Map();

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
    return bot.sendMessage(chatId, "❌ Send a valid supported video link.");
  }

  pending.set(chatId, text);

  return bot.sendMessage(chatId, "Choose download type:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎬 Video", callback_data: "video" },
          { text: "🎵 MP3", callback_data: "audio" }
        ]
      ]
    }
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const text = pending.get(chatId);

  if (!text) {
    return bot.answerCallbackQuery(query.id, {
      text: "Please send the link again."
    });
  }

  const mode = query.data;

  if (mode !== "video" && mode !== "audio") return;

  pending.delete(chatId);

  await bot.answerCallbackQuery(query.id);

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "arewasave-"));

  try {
    await bot.sendMessage(chatId, "⏳ Downloading, please wait...");

    const options = {
      output: path.join(folder, "%(title)s.%(ext)s"),
      noPlaylist: true
    };

    if (mode === "audio") {
      options.extractAudio = true;
      options.audioFormat = "mp3";
    } else {
      options.format = "best[ext=mp4]/best";
      options.mergeOutputFormat = "mp4";
    }

    await youtubedl(text, options);

    const files = fs.readdirSync(folder).filter(f => !f.endsWith(".part"));

    if (!files.length) {
      throw new Error("File not found");
    }

    const filePath = path.join(folder, files[0]);

    if (mode === "audio") {
      await bot.sendAudio(chatId, filePath);
    } else {
      try {
        await bot.sendVideo(chatId, filePath);
      } catch (videoError) {
        console.log("sendVideo failed; trying document.");
        await bot.sendDocument(chatId, filePath);
      }
    }

    await bot.sendMessage(chatId, "✅ Download completed!");
  } catch (error) {
    console.error("Download error:", error.message);

    await bot.sendMessage(
      chatId,
      "⚠️ Download failed. The video may be unavailable, unsupported, or too large."
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

console.log("ArewaSave is running!");
