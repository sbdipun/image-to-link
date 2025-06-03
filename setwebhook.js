// setwebhook.js - Manually set the Telegram bot webhook

require("dotenv").config(); // Load .env if available
const config = require("./config");
const fetch = require("node-fetch"); // node-fetch is needed if not using axios or the bot's own setWebHook
const logger = require('./logger'); // Added

// The URL Telegram will send updates to
const webhookUrl = `${config.PUBLIC_URL}/${config.BOT_TOKEN}`;

// Telegram Bot API endpoint for setting the webhook
const telegramSetWebhookUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`;

(async () => {
    if (!config.PUBLIC_URL || config.PUBLIC_URL === "http://localhost:5000") {
        logger.error("❌ PUBLIC_URL is not set in environment or is default localhost. Please set it to your public URL."); // Changed console.error to logger.error
        process.exit(1);
    }

    if (!config.BOT_TOKEN || config.BOT_TOKEN === "YOUR_BOT_TOKEN_HERE") {
        logger.error("❌ BOT_TOKEN is not set in environment or is default placeholder. Please set it."); // Changed console.error to logger.error
        process.exit(1);
    }

    logger.info(`🔗 Attempting to set webhook to: ${webhookUrl}`); // Changed console.log to logger.info

    try {
        const response = await fetch(telegramSetWebhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ["message", "callback_query"] // Only receive message and callback_query updates for efficiency
            })
        });

        const result = await response.json();

        if (result.ok) {
            logger.info("✅ Webhook successfully set!"); // Changed console.log to logger.info
            logger.info(`📌 Webhook URL: ${webhookUrl}`); // Changed console.log to logger.info
        } else {
            logger.error("❌ Failed to set webhook."); // Changed console.error to logger.error
            logger.error(`Telegram response: ${JSON.stringify(result, null, 2)}`); // Changed console.error to logger.error
        }
    } catch (error) {
        logger.error(`🚨 Error setting webhook: ${error.message}`); // Changed console.error to logger.error
    }
})();
