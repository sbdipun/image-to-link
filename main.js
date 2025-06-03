// main.js

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");

// Import config and host functions
const config = require("./config");
const {
    uploadToImgbb,
    uploadToEnvs,
    uploadToImgbox,
} = require("./hosts");

// --- Bot Setup ---
const bot = new Telegraf(config.BOT_TOKEN);

// --- Database Placeholder ---
let users = []; // Replace with MongoDB in production
async function get_user(user_id) {
    return users.includes(user_id);
}
async function add_user(user_id) {
    if (!await get_user(user_id)) users.push(user_id);
}
async function get_all_users() {
    return users;
}

// --- Temporary storage for file paths ---
const tempFileStorage = {};

// --- Ensure downloads directory exists ---
const DOWNLOADS_DIR = path.resolve(__dirname, "downloads");
fs.ensureDirSync(DOWNLOADS_DIR);

// --- Helper: Check if user is subscribed to channel ---
async function isSubscribed(bot, user_id, channel) {
    try {
        const chat = await bot.telegram.getChatMember(channel, user_id);
        return chat.status === "member" || chat.status === "administrator" || chat.status === "creator";
    } catch (error) {
        console.error(`Error checking subscription for ${user_id}:`, error.message);
        return false;
    }
}

// --- START COMMAND ---
bot.start(async (ctx) => {
    const user_id = ctx.from.id;

    if (!(await get_user(user_id))) {
        await add_user(user_id);
    }

    if (config.FORCE_SUB_CHANNEL && !(await isSubscribed(bot, user_id, config.FORCE_SUB_CHANNEL))) {
        await ctx.replyWithMarkdown(
            "Hello! Please join our channel to use this bot. Once you join, click 'Start' again.",
            Markup.inlineKeyboard([
                [Markup.button.url("📢 Join Channel", `https://t.me/${config.FORCE_SUB_CHANNEL.replace("@",  "")}`)]
            ])
        );
        return;
    }

    await ctx.replyWithMarkdown(
        "👋 Hello! I'm your image linking bot.\n\n" +
        "**In private chat:** Send me an image, and I'll give you options to upload it to various hosting sites.\n" +
        "**In groups:** Reply to an image with any text, or use `/imgbb`, `/envs` as a reply to an image, and I'll provide a link."
    );
});

// --- PRIVATE PHOTO HANDLER ---
bot.on("photo", async (ctx) => {
    const user_id = ctx.from.id;
    const message = ctx.update.message;

    if (config.FORCE_SUB_CHANNEL && !(await isSubscribed(bot, user_id, config.FORCE_SUB_CHANNEL))) {
        await ctx.replyWithMarkdown(
            "Please join our channel to use this bot!",
            Markup.inlineKeyboard([
                [Markup.button.url("📢 Join Channel", `https://t.me/${config.FORCE_SUB_CHANNEL.replace("@",  "")}`)]
            ])
        );
        return;
    }

    const statusMessage = await ctx.reply("📥 Downloading your image...");

    let fileId;
    if (message.photo && message.photo.length > 0) {
        fileId = message.photo[message.photo.length - 1].file_id;
    } else {
        await statusMessage.editText("❌ No photo found.");
        return;
    }

    try {
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        const fileName = `${uuidv4()}.jpg`;
        const filePath = path.join(DOWNLOADS_DIR, fileName);

        const writer = fs.createWriteStream(filePath);
        const response = await axios.get(fileUrl.href, { responseType: "stream" });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const unique_file_id = uuidv4();
        tempFileStorage[unique_file_id] = filePath;

        await statusMessage.editText(
            "✨ Image downloaded. Choose an image host:",
            Markup.inlineKeyboard([
                [Markup.button.callback("🔗 Upload to ImgBB", `upload_imgbb:${unique_file_id}`)],
                [Markup.button.callback("🔗 Upload to Envs.sh", `upload_envs:${unique_file_id}`)],
                [Markup.button.callback("🔗 Upload to Imgbox", `upload_imgbox:${unique_file_id}`)],
                [Markup.button.callback("🗑️ Delete Downloaded Image", `delete_image:${unique_file_id}`)],
            ])
        );

    } catch (e) {
        await statusMessage.editText(`❌ Error downloading image: \`${e.message}\``);
    }
});

// --- INLINE CALLBACK HANDLER ---
bot.action(/^upload_.*$/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const parts = data.split(":");
    const actionType = parts[0];
    const unique_file_id = parts[1];

    const file_path = tempFileStorage[unique_file_id];
    if (!file_path || !(await fs.pathExists(file_path))) {
        await ctx.editMessageText("⚠️ Image file not found or already deleted. Please send the image again.");
        return;
    }

    const hostType = actionType.split("_")[1];
    await ctx.editMessageText(`⬆️ Uploading to ${hostType.toUpperCase()}...`);

    let link = null;
    if (hostType === "imgbb") {
        link = await uploadToImgbb(file_path);
    } else if (hostType === "envs") {
        link = await uploadToEnvs({ imagePath: file_path });
    } else if (hostType === "imgbox") {
        link = await uploadToImgbox(file_path);
    }

    if (link) {
        await ctx.editMessageText(
            `🔗 Your ${hostType.toUpperCase()} link:\n\`${link}\``,
            Markup.inlineKeyboard([[Markup.button.url("Open Link", link)]]
        ));
    } else {
        await ctx.editMessageText(`❌ Failed to upload to ${hostType.toUpperCase()}.`);
    }

    await fs.remove(file_path);
    delete tempFileStorage[unique_file_id];
});

// --- DELETE IMAGE CALLBACK ---
bot.action(/^delete_image:/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const unique_file_id = data.split(":")[1];
    const file_path = tempFileStorage[unique_file_id];

    if (file_path && await fs.pathExists(file_path)) {
        await fs.remove(file_path);
        await ctx.editMessageText("🗑️ Image deleted from server. You can send another image.");
    } else {
        await ctx.editMessageText("⚠️ Image already deleted or not found.");
    }

    delete tempFileStorage[unique_file_id];
});

// --- GROUP PHOTO REPLY HANDLER ---
bot.hears(/.*/, async (ctx) => {
    const message = ctx.update.message;
    if (message.reply_to_message?.photo) {
        const replyPhoto = message.reply_to_message.photo.pop();
        const fileId = replyPhoto.file_id;
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        const filePath = path.join(DOWNLOADS_DIR, `${uuidv4()}.jpg`);

        const writer = fs.createWriteStream(filePath);
        const response = await axios.get(fileUrl.href, { responseType: "stream" });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const statusMessage = await ctx.reply("📥 Downloading image for upload...");
        const imgbbLink = await uploadToImgbb(filePath);

        if (imgbbLink) {
            await statusMessage.editMessageText(
                `🖼️ Here's your image link:\n\`${imgbbLink}\`\n_Uploaded via ImgBB_`
            );
        } else {
            await statusMessage.editMessageText("❌ Failed to upload image to ImgBB.");
        }

        await fs.remove(filePath);
    }
});

// --- /IMGBB COMMAND IN GROUPS ---
bot.command("imgbb", async (ctx) => {
    const message = ctx.update.message;
    if (message.reply_to_message?.photo) {
        const replyPhoto = message.reply_to_message.photo.pop();
        const fileId = replyPhoto.file_id;
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        const filePath = path.join(DOWNLOADS_DIR, `${uuidv4()}.jpg`);

        const writer = fs.createWriteStream(filePath);
        const response = await axios.get(fileUrl.href, { responseType: "stream" });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const statusMessage = await ctx.reply("📥 Downloading image for ImgBB upload...");
        const imgbbLink = await uploadToImgbb(filePath);

        if (imgbbLink) {
            await statusMessage.editMessageText(
                `🖼️ Here's your ImgBB link:\n\`${imgbbLink}\``
            );
        } else {
            await statusMessage.editMessageText("❌ Failed to upload image to ImgBB.");
        }

        await fs.remove(filePath);
    } else {
        await ctx.reply("Please reply to an image with `/imgbb` to get an ImgBB link.");
    }
});

// --- /ENVS COMMAND IN GROUPS ---
bot.command("envs", async (ctx) => {
    const message = ctx.update.message;
    if (message.reply_to_message?.photo) {
        const replyPhoto = message.reply_to_message.photo.pop();
        const fileId = replyPhoto.file_id;
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        const filePath = path.join(DOWNLOADS_DIR, `${uuidv4()}.jpg`);

        const writer = fs.createWriteStream(filePath);
        const response = await axios.get(fileUrl.href, { responseType: "stream" });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const statusMessage = await ctx.reply("📥 Downloading image for Envs.sh upload...");
        const envsLink = await uploadToEnvs({ imagePath: filePath });

        if (envsLink) {
            await statusMessage.editMessageText(
                `🖼️ Here's your Envs.sh link:\n\`${envsLink}\``
            );
        } else {
            await statusMessage.editMessageText("❌ Failed to upload image to Envs.sh.");
        }

        await fs.remove(filePath);
    } else {
        await ctx.reply("Please reply to an image with `/envs` to get an Envs.sh link.");
    }
});

// --- BROADCAST COMMAND ---
bot.command("broadcast", async (ctx) => {
    const user_id = ctx.from.id;
    if (user_id !== config.OWNER_ID) {
        await ctx.reply("🚫 This command can only be used by the bot owner.");
        return;
    }

    const args = ctx.message.text.split(" ").slice(1).join(" ");
    if (!args) {
        await ctx.reply("Usage: `/broadcast [your message]`", { parse_mode: "Markdown" });
        return;
    }

    const users = await get_all_users();
    let sentCount = 0;
    let failedCount = 0;

    const statusMessage = await ctx.reply("🚀 Starting broadcast...");

    for (const user_id of users) {
        if (user_id === config.OWNER_ID) continue;
        try {
            await ctx.telegram.sendMessage(user_id, args);
            sentCount++;
        } catch (e) {
            console.error(`Failed to send message to ${user_id}:`, e.message);
            failedCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Throttle
    }

    await statusMessage.editMessageText(
        `✅ Broadcast complete!\n➡️ Sent to: **${sentCount}** users\n❌ Failed to send to: **${failedCount}** users`
    );
});

// --- USERS COUNT ---
bot.command("users", async (ctx) => {
    const user_id = ctx.from.id;
    if (user_id !== config.OWNER_ID) {
        await ctx.reply("🚫 This command can only be used by the bot owner.");
        return;
    }

    const allUsers = await get_all_users();
    await ctx.reply(`📊 Total users in database: *${allUsers.length}*`, { parse_mode: "Markdown" });
});

// --- GROUP COMMAND RESTRICTION ---
bot.command(["start", "broadcast", "users"], async (ctx) => {
    const user_id = ctx.from.id;
    if (user_id !== config.OWNER_ID) {
        await ctx.reply("🚫 This command can only be used by the bot owner in groups.");
    }
});

// --- EXPORT MODULE ---
module.exports = {
    bot,
    isSubscribed,
    get_all_users,
};
