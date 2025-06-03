
require("dotenv").config();
const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const config = require("./config");
const { uploadToImgbb, uploadToEnvs, uploadToImgbox } = require("./hosts");
const { addUser, getUser, getAllUsers } = require("./db");

// Create bot instance
const bot = new Telegraf(config.BOT_TOKEN);

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
fs.ensureDirSync(DOWNLOADS_DIR);

const tempFileStorage = {};

async function isSubscribed(userId) {
    if (!config.FORCE_SUB_CHANNEL) {
        return true; // No force subscribe channel configured
    }
    try {
        const chatMember = await bot.telegram.getChatMember(config.FORCE_SUB_CHANNEL, userId);
        const status = chatMember.status;
        return status === "member" || status === "administrator" || status === "creator";
    } catch (error) {
        console.error(`Error checking subscription for user ${userId} in channel ${config.FORCE_SUB_CHANNEL}:`, error.message);
        // If there's an error (e.g., bot not admin in channel, channel not found),
        // it's safer to assume they are not subscribed or handle as per policy.
        // For now, returning false on error to enforce subscription.
        return false;
    }
}

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    await addUser(userId);

    if (config.FORCE_SUB_CHANNEL && !isSubscribed(userId)) {
        return ctx.reply("🚫 Please join our channel first.");
    }

    const welcomeText = "👋 Hello! Send me an image to upload it to ImgBB, Envs.sh or Imgbox.";
    ctx.reply(welcomeText);
});

bot.on("photo", async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    if (config.FORCE_SUB_CHANNEL && !isSubscribed(userId)) {
        return ctx.reply("🚫 Please join our channel first.");
    }

    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const fileName = uuidv4() + ".jpg";
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    const status = await ctx.reply("📥 Downloading your image...");

    const writer = fs.createWriteStream(filePath);
    const response = await axios.get(fileUrl.href, { responseType: "stream" });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    const uniqueId = uuidv4();
    tempFileStorage[uniqueId] = filePath;

    ctx.editMessageText("✅ Image downloaded. Choose host:", {
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

bot.on("callback_query", async (ctx) => {
    const chatId = ctx.callbackQuery.message.chat.id;
    const messageId = ctx.callbackQuery.message.message_id;
    const data = ctx.callbackQuery.data;

    if (data.startsWith("upload_")) {
        const [_, host, fileKey] = data.split(":");
        const filePath = tempFileStorage[fileKey];
        if (!filePath || !fs.existsSync(filePath)) {
            return ctx.editMessageText("❌ Image not found. Please resend.", { chat_id: chatId, message_id: messageId });
        }

        ctx.editMessageText(`⬆️ Uploading to ${host.toUpperCase()}...`, { chat_id: chatId, message_id: messageId });

        let link = null;
        if (host === "imgbb") link = await uploadToImgbb(filePath);
        else if (host === "envs") link = await uploadToEnvs({ imagePath: filePath });
        else if (host === "imgbox") link = await uploadToImgbox(filePath);

        if (link) {
            ctx.editMessageText(`✅ Uploaded:
${link}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[{ text: "Open Link", url: link }]]
                }
            });
        } else {
            ctx.editMessageText("❌ Upload failed.", { chat_id: chatId, message_id: messageId });
        }

        delete tempFileStorage[fileKey];
        fs.remove(filePath);
    }

    if (data.startsWith("delete_image:")) {
        const fileKey = data.split(":")[1];
        const filePath = tempFileStorage[fileKey];
        if (filePath && fs.existsSync(filePath)) {
            fs.remove(filePath);
            ctx.editMessageText("🗑️ Image deleted.", { chat_id: chatId, message_id: messageId });
        } else {
            ctx.editMessageText("⚠️ Image already deleted.", { chat_id: chatId, message_id: messageId });
        }
        delete tempFileStorage[fileKey];
    }
});

module.exports = { bot };
