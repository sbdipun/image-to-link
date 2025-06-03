<<<<<<< HEAD

require("dotenv").config();
const { Telegraf } = require("telegraf");
=======
// main.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
>>>>>>> c1c2c4b2ead5bf928765aa4f26938dce11eae232
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const logger = require('./logger');

const config = require("./config");
const { uploadToImgbb, uploadToEnvs, uploadToImgbox } = require("./hosts");
<<<<<<< HEAD
const { addUser, getUser, getAllUsers } = require("./db");

// Create bot instance
const bot = new Telegraf(config.BOT_TOKEN);

const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
=======
const { addUser, getUser } = require("./db");

// Create bot instance without webhook configuration.
// The webhook will be handled by the Express server in index.js
const bot = new TelegramBot(config.BOT_TOKEN); // No webHook config here

const DOWNLOADS_DIR = path.resolve(__dirname, config.DOWNLOADS_DIR);
>>>>>>> c1c2c4b2ead5bf928765aa4f26938dce11eae232
fs.ensureDirSync(DOWNLOADS_DIR);
logger.info(`Downloads directory ensured: ${DOWNLOADS_DIR}`);

<<<<<<< HEAD
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
=======
const tempFileStorage = {}; // Stores { uniqueId: filePath }

async function isSubscribed(userId) {
    if (!config.FORCE_SUB_CHANNEL) {
        return true;
    }
    try {
        logger.debug(`Force subscribe check for user ${userId} in channel ${config.FORCE_SUB_CHANNEL}`);
        // Implement real subscription check here if needed
        return true;
    } catch (error) {
        logger.error(`Error checking subscription for user ${userId}: ${error.message}`);
>>>>>>> c1c2c4b2ead5bf928765aa4f26938dce11eae232
        return false;
    }
}

<<<<<<< HEAD
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
=======
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    logger.info(`Received /start from user: ${userId}`);

    try {
        await addUser(userId);

        if (config.FORCE_SUB_CHANNEL && !(await isSubscribed(userId))) {
            return bot.sendMessage(chatId, `🚫 Please join our channel first: ${config.FORCE_SUB_CHANNEL}`);
        }

        const welcomeText = "👋 Hello! Send me an image to upload it to ImgBB, Envs.sh or Imgbox.";
        bot.sendMessage(chatId, welcomeText);
    } catch (error) {
        logger.error(`Error handling /start for user ${userId}: ${error.message}`);
        bot.sendMessage(chatId, "An error occurred while starting the bot. Please try again later.");
>>>>>>> c1c2c4b2ead5bf928765aa4f26938dce11eae232
    }

<<<<<<< HEAD
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

=======
bot.on("photo", async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    logger.info(`Received photo from user: ${userId}`);

    if (config.FORCE_SUB_CHANNEL && !(await isSubscribed(userId))) {
        return bot.sendMessage(chatId, `🚫 Please join our channel first: ${config.FORCE_SUB_CHANNEL}`);
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    // Declare uniqueId here, outside the try block
    let uniqueId;
    let finalFilePath; // Also declare finalFilePath here for broader scope

    let statusMessageId; // To store the message ID for edits

    try {
        const status = await bot.sendMessage(chatId, "📥 Downloading your image...");
        statusMessageId = status.message_id;

        const fileLink = await bot.getFileLink(fileId); // Get the URL object
        if (!fileLink || !fileLink.href) { // Check if fileLink or its href is valid
            throw new Error("Telegram API did not return a valid file link.");
        }
        const fileUrl = fileLink.href; // Get the actual URL string

        logger.info(`Downloading file ${fileId} from ${fileUrl}`);

        // Get file extension from Telegram's file_path if available
        const fileInfo = await bot.getFile(fileId);
        const fileExt = path.extname(fileInfo.file_path || '.jpg'); // Default to .jpg if no extension

        uniqueId = uuidv4(); // Define uniqueId here
        finalFilePath = path.join(DOWNLOADS_DIR, `${uniqueId}${fileExt}`); // Define finalFilePath here

        const writer = fs.createWriteStream(finalFilePath);
        const response = await axios({
            method: 'get',
            url: fileUrl, // Use the extracted URL string
            responseType: 'stream'
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", (err) => {
                logger.error(`File write error for ${finalFilePath}: ${err.message}`);
                reject(err);
            });
        });
        logger.info(`Image downloaded to ${finalFilePath}`);

        tempFileStorage[uniqueId] = finalFilePath;

        await bot.editMessageText("✅ Image downloaded. Choose host:", {
            chat_id: chatId,
            message_id: statusMessageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Upload to ImgBB", callback_data: `upload_imgbb:${uniqueId}` }],
                    [{ text: "Upload to Envs.sh", callback_data: `upload_envs:${uniqueId}` }],
                    [{ text: "Upload to Imgbox", callback_data: `upload_imgbox:${uniqueId}` }],
                    [{ text: "🗑️ Delete", callback_data: `delete_image:${uniqueId}` }]
                ]
            }
        });
    } catch (error) {
        logger.error(`Error processing photo for user ${userId}: ${error.message}`);
        if (statusMessageId) {
            await bot.editMessageText(`❌ An error occurred during image processing: ${error.message.substring(0, 100)}`, { chat_id: chatId, message_id: statusMessageId }).catch(e => logger.error(`Failed to edit message: ${e.message}`));
        } else {
            await bot.sendMessage(chatId, `❌ An error occurred during image processing: ${error.message.substring(0, 100)}. Please try again.`).catch(e => logger.error(`Failed to send message: ${e.message}`));
        }
        // Clean up partially downloaded file if error occurred and uniqueId/finalFilePath were defined
        if (uniqueId && finalFilePath && tempFileStorage[uniqueId] && fs.existsSync(tempFileStorage[uniqueId])) {
            fs.remove(tempFileStorage[uniqueId]).catch(e => logger.error(`Failed to remove error-downloaded file: ${e.message}`));
            delete tempFileStorage[uniqueId];
        } else if (finalFilePath && fs.existsSync(finalFilePath)) { // In case uniqueId wasn't set but file path was generated
             fs.remove(finalFilePath).catch(e => logger.error(`Failed to remove error-downloaded file: ${e.message}`));
        }
    }
});

bot.on("callback_query", async (callback) => {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const data = callback.data;
    const userId = callback.from.id;

    logger.info(`Received callback query from user ${userId}: ${data}`);

    await bot.answerCallbackQuery(callback.id).catch(e => logger.error(`Failed to answer callback query: ${e.message}`));

    if (data.startsWith("upload_")) {
        const [_, host, fileKey] = data.split(":");
        const filePath = tempFileStorage[fileKey];

        if (!filePath || !fs.existsSync(filePath)) {
            logger.warn(`Image file not found for key ${fileKey} for user ${userId}.`);
            return bot.editMessageText("❌ Image not found or already processed. Please resend the image.", { chat_id: chatId, message_id: messageId });
        }

        try {
            await bot.editMessageText(`⬆️ Uploading to ${host.toUpperCase()}...`, { chat_id: chatId, message_id: messageId });
            let link = null;

            switch (host) {
                case "imgbb":
                    link = await uploadToImgbb(filePath);
                    break;
                case "envs":
                    link = await uploadToEnvs({ imagePath: filePath });
                    break;
                case "imgbox":
                    link = await uploadToImgbox(filePath);
                    break;
                default:
                    logger.warn(`Unknown upload host requested: ${host}`);
                    await bot.editMessageText("❌ Unknown upload host.", { chat_id: chatId, message_id: messageId });
                    break;
            }

            if (link) {
                await bot.editMessageText(`✅ Uploaded to ${host.toUpperCase()}:\n${link}`, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [[{ text: "Open Link", url: link }]]
                    },
                    disable_web_page_preview: false
                });
                logger.info(`Image uploaded to ${host.toUpperCase()} for user ${userId}: ${link}`);
            } else {
                await bot.editMessageText(`❌ Upload to ${host.toUpperCase()} failed.`, { chat_id: chatId, message_id: messageId });
                logger.error(`Upload to ${host.toUpperCase()} failed for user ${userId}.`);
            }
        } catch (error) {
            logger.error(`Error during upload to ${host.toUpperCase()} for user ${userId}: ${error.message}`);
            await bot.editMessageText(`❌ An error occurred during upload to ${host.toUpperCase()}.`, { chat_id: chatId, message_id: messageId });
        } finally {
            if (fs.existsSync(filePath)) {
                fs.remove(filePath)
                    .then(() => logger.info(`Cleaned up temp file: ${filePath}`))
                    .catch(e => logger.error(`Failed to remove temp file ${filePath}: ${e.message}`));
            }
            delete tempFileStorage[fileKey];
        }
    } else if (data.startsWith("delete_image:")) {
        const fileKey = data.split(":")[1];
        const filePath = tempFileStorage[fileKey];

        if (filePath && fs.existsSync(filePath)) {
            try {
                await fs.remove(filePath);
                delete tempFileStorage[fileKey];
                await bot.editMessageText("🗑️ Image deleted.", { chat_id: chatId, message_id: messageId });
                logger.info(`Image ${filePath} deleted by user ${userId}.`);
            } catch (error) {
                logger.error(`Error deleting image ${filePath} for user ${userId}: ${error.message}`);
                await bot.editMessageText("❌ Failed to delete image.", { chat_id: chatId, message_id: messageId });
            }
        } else {
            await bot.editMessageText("⚠️ Image already deleted or not found.", { chat_id: chatId, message_id: messageId });
            logger.warn(`Attempted to delete non-existent image for key ${fileKey} by user ${userId}.`);
            delete tempFileStorage[fileKey];
        }
    }
});

bot.on("polling_error", (err) => logger.error(`Polling Error: ${err.message}`));
bot.on("webhook_error", (err) => logger.error(`Webhook Error: ${err.message}`)); // This handler will likely not be hit if webhook is handled by Express.

>>>>>>> c1c2c4b2ead5bf928765aa4f26938dce11eae232
module.exports = { bot };
