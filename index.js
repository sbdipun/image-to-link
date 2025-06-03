// index.js

const express = require("express");
const bodyParser = require("body-parser");
const config = require("./config");
const { bot } = require("./main"); // Imports the bot instance
const { connectToDatabase } = require("./db");
const logger = require('./logger');

const app = express();

// --- Middleware to parse raw Telegram update JSON ---
app.use(bodyParser.json());

// --- Connect to MongoDB ---
connectToDatabase().catch(err => {
    logger.error(`Failed to connect to database on startup: ${err.message}`);
    process.exit(1);
});

// --- Webhook route: Must match your BOT_TOKEN for Telegram to validate ---
const WEBHOOK_PATH = `/${config.BOT_TOKEN}`;

app.post(WEBHOOK_PATH, async (req, res) => {
    try {
        // Process the update using node-telegram-bot-api's processUpdate
        await bot.processUpdate(req.body);
        res.status(200).json({ status: "ok" });
    } catch (error) {
        logger.error(`Error processing webhook update: ${error.message}`);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// --- Health Check / Manual Webhook Setup Route ---
app.get("/", (req, res) => {
    logger.info("Health check received.");
    res.send("Telegram Image Uploader Bot is running ✅");
});

// --- Start the Express server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`✅ Express server running on port ${PORT}`);

    // Attempt to set webhook after a short delay to ensure server is fully up
    setTimeout(async () => {
        const publicUrl = config.PUBLIC_URL;
        if (!publicUrl || publicUrl === "http://localhost:5000") {
            logger.error("PUBLIC_URL not set in environment or is default localhost. Webhook will not be set correctly.");
            return; // Don't exit, just log and continue
        }

        const webhookUrl = `${publicUrl}/${config.BOT_TOKEN}`;
        try {
            const result = await bot.setWebHook(webhookUrl, {
                allowed_updates: ["message", "callback_query"]
            });
            if (result) {
                logger.info(`✅ Webhook successfully set to: ${webhookUrl}`);
            } else {
                logger.error(`❌ Failed to set webhook. Telegram response was not 'ok'.`);
            }
        } catch (error) {
            logger.error(`🚨 Error setting webhook automatically: ${error.message}`);
        }
    }, 5000); // 5-second delay
});
