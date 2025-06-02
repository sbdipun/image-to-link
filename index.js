// index.js

const express = require("express");
const bodyParser = require("body-parser");
const { Telegraf } = require("telegraf");
const config = require("./config");
const { bot } = require("./main"); // Imports the Telegraf instance and handlers
const { connectToDatabase } = require("./db");

const app = express();

// --- Middleware to parse raw Telegram update JSON ---
app.use(bodyParser.json());

// --- Connect to MongoDB ---
connectToDatabase();

// --- Webhook route: Must match your BOT_TOKEN for Telegram to validate ---
const WEBHOOK_PATH = `/${config.BOT_TOKEN}`;

app.post(WEBHOOK_PATH, async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error("Error processing update:", error.message);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// --- Health Check / Manual Webhook Setup Route ---
app.get("/", (req, res) => {
    res.send("Telegram Image Uploader Bot is running ✅");
});

// --- Set Webhook Manually (Useful after deployment) ---
app.get("/setwebhook", async (req, res) => {
    const publicUrl = config.PUBLIC_URL;

    if (!publicUrl) {
        return res.status(500).send("PUBLIC_URL not set in environment.");
    }

    const webhookUrl = `${publicUrl}/${config.BOT_TOKEN}`;
    const telegramSetWebhookUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`; 

    try {
        const response = await fetch(telegramSetWebhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: webhookUrl })
        });

        const result = await response.json();

        if (result.ok) {
            res.status(200).json({
                status: "success",
                webhook_url: webhookUrl,
                telegram_response: result
            });
        } else {
            res.status(500).json({
                status: "failed",
                message: "Failed to set webhook",
                telegram_response: result
            });
        }
    } catch (error) {
        console.error("Error setting webhook:", error.message);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// --- Start the server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Express server running on port ${PORT}`);
});
