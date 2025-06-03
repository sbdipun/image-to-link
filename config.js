// config.js

module.exports = {
    // 🤖 Bot Token (Required)
    BOT_TOKEN: process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE",

    // 🛡️ Force Subscribe Channel (Optional, set to null to disable)
    FORCE_SUB_CHANNEL: process.env.FORCE_SUB_CHANNEL || "@your_channel", // without @ if needed

    // 👤 Owner ID (for /broadcast and /users commands)
    OWNER_ID: parseInt(process.env.OWNER_ID) || 123456789,

    // 💾 MongoDB URI (for storing user data)
    MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/imagebot",

    // 📁 Local directory for image downloads
    DOWNLOADS_DIR: "downloads",

    // 🔗 Optional: Hosting service API keys
    IMGBB_API_KEY: process.env.IMGBB_API_KEY || "",
    IMGBOX_API_KEY: process.env.IMGBOX_API_KEY || "",

    // 🌐 Public base URL of your deployed bot
    PUBLIC_URL: process.env.RENDER_EXTERNAL_URL || process.env.K_SERVICE_URL || "http://localhost:5000",
};
