
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const config = require("./config");
const { uploadToImgbb, uploadToEnvs, uploadToImgbox } = require("./hosts");
const { addUser, getUser, getAllUsers } = require("./db");

// Create bot instance in webhook mode
const bot = new TelegramBot(config.BOT_TOKEN, { webHook: { port: process.env.PORT || 5000 } });
bot.setWebHook(`${config.PUBLIC_URL}/${config.BOT_TOKEN}`);

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
fs.ensureDirSync(DOWNLOADS_DIR);

const tempFileStorage = {};

function isSubscribed(userId) {
    // For simplicity, assume all users are subscribed or this is skipped
    return true;
}

bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    await addUser(userId);

    if (config.FORCE_SUB_CHANNEL && !isSubscribed(userId)) {
        return bot.sendMessage(userId, "🚫 Please join our channel first.");
    }

    const welcomeText = "👋 Hello! Send me an image to upload it to ImgBB, Envs.sh or Imgbox.";
    bot.sendMessage(userId, welcomeText);
});

bot.on("photo", async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (config.FORCE_SUB_CHANNEL && !isSubscribed(userId)) {
        return bot.sendMessage(chatId, "🚫 Please join our channel first.");
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const fileUrl = await bot.getFileLink(fileId);
    const fileName = uuidv4() + ".jpg";
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    const status = await bot.sendMessage(chatId, "📥 Downloading your image...");

    const writer = fs.createWriteStream(filePath);
    const response = await axios.get(fileUrl.href, { responseType: "stream" });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    const uniqueId = uuidv4();
    tempFileStorage[uniqueId] = filePath;

    bot.editMessageText("✅ Image downloaded. Choose host:", {
        chat_id: chatId,
        message_id: status.message_id,
        reply_markup: {
            inline_keyboard: [
                [{ text: "Upload to ImgBB", callback_data: `upload_imgbb:${uniqueId}` }],
                [{ text: "Upload to Envs.sh", callback_data: `upload_envs:${uniqueId}` }],
                [{ text: "Upload to Imgbox", callback_data: `upload_imgbox:${uniqueId}` }],
                [{ text: "🗑️ Delete", callback_data: `delete_image:${uniqueId}` }]
            ]
        }
    });
});

bot.on("callback_query", async (callback) => {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const data = callback.data;

    if (data.startsWith("upload_")) {
        const [_, host, fileKey] = data.split(":");
        const filePath = tempFileStorage[fileKey];
        if (!filePath || !fs.existsSync(filePath)) {
            return bot.editMessageText("❌ Image not found. Please resend.", { chat_id: chatId, message_id: messageId });
        }

        bot.editMessageText(`⬆️ Uploading to ${host.toUpperCase()}...`, { chat_id: chatId, message_id: messageId });

        let link = null;
        if (host === "imgbb") link = await uploadToImgbb(filePath);
        else if (host === "envs") link = await uploadToEnvs({ imagePath: filePath });
        else if (host === "imgbox") link = await uploadToImgbox(filePath);

        if (link) {
            bot.editMessageText(`✅ Uploaded:
${link}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: "Open Link", url: link }]]
                }
            });
        } else {
            bot.editMessageText("❌ Upload failed.", { chat_id: chatId, message_id: messageId });
        }

        delete tempFileStorage[fileKey];
        fs.remove(filePath);
    }

    if (data.startsWith("delete_image:")) {
        const fileKey = data.split(":")[1];
        const filePath = tempFileStorage[fileKey];
        if (filePath && fs.existsSync(filePath)) {
            fs.remove(filePath);
            bot.editMessageText("🗑️ Image deleted.", { chat_id: chatId, message_id: messageId });
        } else {
            bot.editMessageText("⚠️ Image already deleted.", { chat_id: chatId, message_id: messageId });
        }
        delete tempFileStorage[fileKey];
    }
});

module.exports = { bot };
