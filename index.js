const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN;

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start") {
    bot.sendMessage(
      chatId,
      "Welcome to ArewaSave! 📥\n\nSend me a video link to get started."
    );
  } else if (text) {
    bot.sendMessage(
      chatId,
      "Link received! Please wait while I check it. 😊"
    );
  }
});
