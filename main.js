require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const logger = require('./logger'); // Added

const config = require("./config");
const { uploadToImgbb, uploadToEnvs, uploadToImgbox } = require("./hosts");
const { addUser, getUser } = require("./db");

// Create bot instance in webhook mode
const bot = new TelegramBot(config.BOT_TOKEN, {
    webHook: {
        // Ensure this port directly uses process.env.PORT
        port: parseInt(process.env.PORT, 10), // Convert to integer
        host: '0.0.0.0' // Listen on all interfaces
    }
});

const DOWNLOADS_DIR = path.resolve(__dirname, config.DOWNLOADS_DIR); // Use config for downloads dir
fs.ensureDirSync(DOWNLOADS_DIR);
logger.info(`Downloads directory ensured: ${DOWNLOADS_DIR}`);

const tempFileStorage = {}; // Stores { uniqueId: filePath }

/**
 * Checks if a user is subscribed to the FORCE_SUB_CHANNEL.
 * This is a placeholder and needs actual implementation for a real force sub.
 * @param {number} userId - The Telegram user ID.
 * @returns {Promise<boolean>} True if subscribed, false otherwise.
 */
async function isSubscribed(userId) {
    if (!config.FORCE_SUB_CHANNEL) {
        return true; // Force subscribe is disabled
    }
    try {
        // This is a simplified check. A real check would involve:
        // const chatMember = await bot.getChatMember(config.FORCE_SUB_CHANNEL, userId);
        // return ['member', 'administrator', 'creator'].includes(chatMember.status);
        logger.debug(`Force subscribe check for user ${userId} in channel ${config.FORCE_SUB_CHANNEL}`);
        return true; // For now, always return true as per original logic if actual check is not implemented.
    } catch (error) {
        logger.error(`Error checking subscription for user ${userId}: ${error.message}`);
        return false; // Assume not subscribed on error
    }
}

bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    logger.info(`Received /start from user: ${userId}`);

    try {
        await addUser(userId); // Add user to DB

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
    const fileName = uuidv4(); // Generate unique name, extension added after download
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    let statusMessageId; // To store the message ID for edits

    try {
        const status = await bot.sendMessage(chatId, "📥 Downloading your image...");
        statusMessageId = status.message_id;

        const fileUrl = await bot.getFileLink(fileId);
        logger.info(`Downloading file ${fileId} to ${filePath}`);

        // Get file extension from Telegram's file_path if available
        const fileInfo = await bot.getFile(fileId);
        const fileExt = path.extname(fileInfo.file_path || '.jpg'); // Default to .jpg if no extension

        const finalFilePath = `${filePath}${fileExt}`; // Add extension
        const writer = fs.createWriteStream(finalFilePath);
        const response = await axios({
            method: 'get',
            url: fileUrl.href,
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

        const uniqueId = uuidv4();
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
            await bot.editMessageText("❌ An error occurred during image processing.", { chat_id: chatId, message_id: statusMessageId }).catch(e => logger.error(`Failed to edit message: ${e.message}`));
        } else {
            await bot.sendMessage(chatId, "❌ An error occurred during image processing. Please try again.").catch(e => logger.error(`Failed to send message: ${e.message}`));
        }
        // Clean up partially downloaded file if error occurred
        if (tempFileStorage[uniqueId] && fs.existsSync(tempFileStorage[uniqueId])) {
            fs.remove(tempFileStorage[uniqueId]).catch(e => logger.error(`Failed to remove error-downloaded file: ${e.message}`));
            delete tempFileStorage[uniqueId];
        }
    }
});

bot.on("callback_query", async (callback) => {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const data = callback.data;
    const userId = callback.from.id;

    logger.info(`Received callback query from user ${userId}: ${data}`);

    // Always answer the callback query to remove the loading indicator from the button
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
                    disable_web_page_preview: false // Allow preview for links
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
            // Clean up the temporary file regardless of upload success or failure
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
            delete tempFileStorage[fileKey]; // Ensure it's removed from temp storage even if file is gone
        }
    }
});

// Add error handler for uncaught exceptions in bot operations
bot.on("polling_error", (err) => logger.error(`Polling Error: ${err.message}`));
bot.on("webhook_error", (err) => logger.error(`Webhook Error: ${err.message}`));


module.exports = { bot };
