// index.js

const express = require("express");
const bodyParser = require("body-parser");
const config = require("./config");
const { bot } = require("./main"); // Imports the bot instance
const { connectToDatabase } = require("./db");
const logger = require('./logger'); // Added

const app = express();

// --- Middleware to parse raw Telegram update JSON ---
app.use(bodyParser.json());

// --- Connect to MongoDB ---
connectToDatabase().catch(err => {
    logger.error(`Failed to connect to database on startup: ${err.message}`);
    process.exit(1); // Exit if DB connection fails
});

// --- Webhook route: Must match your BOT_TOKEN for Telegram to validate ---
const WEBHOOK_PATH = `/${config.BOT_TOKEN}`;

app.post(WEBHOOK_PATH, async (req, res) => {
    try {
        // Process the update using node-telegram-bot-api's processUpdate
        await bot.processUpdate(req.body);
        res.status(200).json({ status: "ok" });
    } catch (error) {
        logger.error(`Error processing webhook update: ${error.message}`); // Changed console.error to logger.error
        res.status(500).json({ status: "error", message: error.message });
    }
});

// --- Health Check / Manual Webhook Setup Route ---
app.get("/", (req, res) => {
    logger.info("Health check received."); // Added logging
    res.send("Telegram Image Uploader Bot is running ✅");
});

// --- Set Webhook Manually (Useful after deployment) ---
app.get("/setwebhook", async (req, res) => {
    const publicUrl = config.PUBLIC_URL;

    if (!publicUrl || publicUrl === "http://localhost:5000") { // Check for default localhost URL too
        logger.error("PUBLIC_URL not set in environment or is default localhost. Webhook will not be set correctly.");
        return res.status(500).send("PUBLIC_URL not set in environment or is default localhost. Cannot set webhook.");
    }

    const webhookUrl = `${publicUrl}/${config.BOT_TOKEN}`;

    try {
        // Using bot.setWebHook from node-telegram-bot-api instance
        const result = await bot.setWebHook(webhookUrl, {
            allowed_updates: ["message", "callback_query"] // Specify allowed updates for efficiency
        });

        if (result) {
            logger.info(`✅ Webhook successfully set to: ${webhookUrl}`); // Changed console.log to logger.info
            res.status(200).json({
                status: "success",
                webhook_url: webhookUrl,
                telegram_response: result
            });
        } else {
            logger.error(`❌ Failed to set webhook. Telegram response was not 'ok'.`); // Changed console.error to logger.error
            res.status(500).json({
                status: "failed",
                message: "Failed to set webhook",
                telegram_response: result // Telegram API returns 'true' on success, 'false' on fail for setWebHook method
            });
        }
    } catch (error) {
        logger.error(`🚨 Error setting webhook: ${error.message}`); // Changed console.error to logger.error
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// --- Start the server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`✅ Express server running on port ${PORT}`); // Changed console.log to logger.info
});
