// config.js

module.exports = {
    // 🤖 Bot Token (Required)
    BOT_TOKEN: process.env.BOT_TOKEN || "",

    // 🛡️ Force Subscribe Channel (Optional, set to null to disable)
    FORCE_SUB_CHANNEL: process.env.FORCE_SUB_CHANNEL || null, // Changed default to null for easier disablement

    // 👤 Owner ID (for /broadcast and /users commands)
    OWNER_ID: parseInt(process.env.OWNER_ID) || 123456789,

    // 💾 MongoDB URI (for storing user data)
<<<<<<< HEAD
    MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/imagebot",
    MONGO_DB_NAME: process.env.MONGO_DB_NAME || "telegram_image_bot",
    MONGO_COLLECTION_USERS: process.env.MONGO_COLLECTION_USERS || "users",
=======
    MONGO_URI: process.env.MONGO_URI || "",
    MONGO_DB_NAME: process.env.MONGO_DB_NAME || "", // Added
    MONGO_COLLECTION_USERS: process.env.MONGO_COLLECTION_USERS || "", // Added
>>>>>>> c1c2c4b2ead5bf928765aa4f26938dce11eae232

    // 📁 Local directory for image downloads
    DOWNLOADS_DIR: "downloads", // This is usually managed by fs-extra in main.js, but kept here for consistency.

    // 🔗 Optional: Hosting service API keys
    IMGBB_API_KEY: process.env.IMGBB_API_KEY || "",
    IMGBOX_API_KEY: process.env.IMGBOX_API_KEY || "",

    // 🌐 Public base URL of your deployed bot
    PUBLIC_URL: process.env.RENDER_EXTERNAL_URL || process.env.K_SERVICE_URL || "",

    // 📝 Logging Level (e.g., 'info', 'warn', 'error', 'debug')
    LOG_LEVEL: process.env.LOG_LEVEL || "info", // Added
};
