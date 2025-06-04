// main.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios"); // axios is no longer needed for download, but might be used elsewhere. Keep for now.
const { v4: uuidv4 } = require("uuid");
const logger = require('./logger');

const config = require("./config");
const { uploadToImgbb, uploadToEnvs, uploadToImgbox, uploadToImgHippo } = require("./hosts"); // Added uploadToImgHippo
const { addUser, getUser } = require("./db");

// Create bot instance without webhook configuration.
// The webhook will be handled by the Express server in index.js
const bot = new TelegramBot(config.BOT_TOKEN); // No webHook config here

const DOWNLOADS_DIR = path.resolve(__dirname, config.DOWNLOADS_DIR);
fs.ensureDirSync(DOWNLOADS_DIR);
logger.info(`Downloads directory ensured: ${DOWNLOADS_DIR}`);

const tempFileStorage = {}; // Stores { uniqueId: filePath }

async function isSubscribed(userId) {
    if (!config.FORCE_SUB_CHANNEL) {
        return true; // No force subscribe channel configured
    }
    try {
        logger.debug(`Force subscribe check for user ${userId} in channel ${config.FORCE_SUB_CHANNEL}`);
        const chatMember = await bot.getChatMember(config.FORCE_SUB_CHANNEL, userId); // Use bot.getChatMember for node-telegram-bot-api
        const status = chatMember.status;
        return status === "member" || status === "administrator" || status === "creator";
    } catch (error) {
        logger.error(`Error checking subscription for user ${userId} in channel ${config.FORCE_SUB_CHANNEL}: ${error.message}`);
        // If there's an error (e.g., bot not admin in channel, channel not found),
        // it's safer to assume they are not subscribed or handle as per policy.
        // For now, returning false on error to enforce subscription.
        return false;
    }
}

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
    }
});

bot.on("photo", async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    logger.info(`Received photo from user: ${userId}`);

    if (config.FORCE_SUB_CHANNEL && !(await isSubscribed(userId))) {
        return bot.sendMessage(chatId, `🚫 Please join our channel first: ${config.FORCE_SUB_CHANNEL}`);
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;
    let uniqueId;
    let finalFilePath;
    let statusMessageId;

    try {
        const status = await bot.sendMessage(chatId, "📥 Downloading your image...");
        statusMessageId = status.message_id;

        const fileInfo = await bot.getFile(fileId);
        const fileExt = path.extname(fileInfo.file_path || '.jpg');

        uniqueId = uuidv4();
        finalFilePath = path.join(DOWNLOADS_DIR, `${uniqueId}${fileExt}`);

        logger.info(`Attempting to download file ${fileId} to ${finalFilePath}`);
        const downloadedPath = await bot.downloadFile(fileId, DOWNLOADS_DIR, { fileName: `${uniqueId}${fileExt}` });

        if (!downloadedPath || !fs.existsSync(downloadedPath)) {
            throw new Error("File download failed or file not found after download.");
        }
        finalFilePath = downloadedPath; // Update finalFilePath to the actual downloaded path

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
                    [{ text: "Upload to ImgHippo", callback_data: `upload_imghippo:${uniqueId}` }], // New button
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
        if (uniqueId && finalFilePath && tempFileStorage[uniqueId] && fs.existsSync(tempFileStorage[uniqueId])) {
            fs.remove(tempFileStorage[uniqueId]).catch(e => logger.error(`Failed to remove error-downloaded file: ${e.message}`));
            delete tempFileStorage[uniqueId];
        } else if (finalFilePath && fs.existsSync(finalFilePath)) {
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
        const parts = data.split(":");
        const actionPrefix = parts[0]; // e.g., "upload_imgbb"
        const fileKey = parts[1];     // e.g., "f71cada4-4e86-485b-bda7-dbe53984e174"
        const host = actionPrefix.split("_")[1]; // e.g., "imgbb"

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
                case "imghippo": // New case
                    link = await uploadToImgHippo(filePath);
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
module.exports = { bot };
