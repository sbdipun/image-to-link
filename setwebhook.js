// setwebhook.js - Manually set the Telegram bot webhook

require("dotenv").config(); // Load .env if available
const config = require("./config");
const fetch = require("node-fetch");

// The URL Telegram will send updates to
const webhookUrl = `${config.PUBLIC_URL}/${config.BOT_TOKEN}`;

// Telegram Bot API endpoint for setting the webhook
const telegramSetWebhookUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`; 

(async () => {
    if (!config.PUBLIC_URL) {
        console.error("❌ PUBLIC_URL is not set in environment.");
        process.exit(1);
    }

    if (!config.BOT_TOKEN) {
        console.error("❌ BOT_TOKEN is not set in environment.");
        process.exit(1);
    }

    console.log(`🔗 Attempting to set webhook to: ${webhookUrl}`);

    try {
        const response = await fetch(telegramSetWebhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ["message", "callback_query"] // Only receive message and callback_query updates
            })
        });

        const result = await response.json();

        if (result.ok) {
            console.log("✅ Webhook successfully set!");
            console.log("📌 Webhook URL:", webhookUrl);
        } else {
            console.error("❌ Failed to set webhook.");
            console.error("Telegram response:", result);
        }
    } catch (error) {
        console.error("🚨 Error setting webhook:", error.message);
    }
})();
