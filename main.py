import os
import asyncio
import uuid
from pyrogram import Client, filters, enums
from pyrogram.types import InlineKeyboardButton, InlineKeyboardMarkup

# Import configurations and database/host functions
from config import API_ID, API_HASH, BOT_TOKEN, MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS, FORCE_SUB_CHANNEL, OWNER_ID
from db import Database, is_subscribed
from hosts import upload_to_imgbb, upload_to_envs, upload_to_imgbox

# --- Pyrogram Client Initialization for Webhooks ---
pyro_client = Client(
    "image_linker_bot",
    api_id=API_ID,
    api_hash=API_HASH,
    bot_token=BOT_TOKEN,
    no_updates=True  # Disable long polling, we'll use webhooks
)

# --- Database Initialization ---
db = Database(MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS)

# --- Temporary storage for file paths ---
temp_file_storage = {}

# --- Ensure downloads directory exists ---
DOWNLOADS_DIR = "downloads"
if not os.path.exists(DOWNLOADS_DIR):
    os.makedirs(DOWNLOADS_DIR)
    print(f"Created downloads directory: {DOWNLOADS_DIR}")

# --- PYROGRAM HANDLERS ---

@pyro_client.on_message(filters.command("start") & filters.private)
async def start_command(client, message):
    user_id = message.from_user.id
    if not await db.get_user(user_id):
        await db.add_user(user_id)

    if FORCE_SUB_CHANNEL and not await is_subscribed(client, user_id, FORCE_SUB_CHANNEL):
        await message.reply_text(
            "Hello! Please join our channel to use this bot. Once you join, click 'Start' again.",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("📢 Join Channel", url=f"https://t.me/{FORCE_SUB_CHANNEL.replace('@',  '')}")]]
            )
        )
        return

    await message.reply_text(
        "👋 Hello! I'm your image linking bot.\n\n"
        "**In private chat:** Send me an image, and I'll give you options to upload it to various hosting sites.\n"
        "**In groups:** Reply to an image with any text, or use `/imgbb`, `/envs` as a reply to an image, and I'll provide a link."
    )

@pyro_client.on_message(filters.photo & filters.private)
async def handle_private_photo(client, message):
    user_id = message.from_user.id
    if FORCE_SUB_CHANNEL and not await is_subscribed(client, user_id, FORCE_SUB_CHANNEL):
        await message.reply_text(
            "Please join our channel to use this bot!",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("📢 Join Channel", url=f"https://t.me/{FORCE_SUB_CHANNEL.replace('@',  '')}")]]
            )
        )
        return

    status_message = await message.reply_text("📥 Downloading your image...")
    file_path = None
    try:
        file_path = await message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await status_message.edit_text(f"❌ Error downloading image: `{e}`")
        return

    unique_file_id = uuid.uuid4().hex
    temp_file_storage[unique_file_id] = file_path

    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔗 Upload to ImgBB", callback_data=f"upload_imgbb:{unique_file_id}")],
            [InlineKeyboardButton("🔗 Upload to Envs.sh", callback_data=f"upload_envs:{unique_file_id}")],
            [InlineKeyboardButton("🔗 Upload to Imgbox", callback_data=f"upload_imgbox:{unique_file_id}")],
            [InlineKeyboardButton("🗑️ Delete Downloaded Image", callback_data=f"delete_image:{unique_file_id}")]
        ]
    )

    await status_message.edit_text("✨ Image downloaded. Choose an image host:", reply_markup=keyboard)

@pyro_client.on_message(filters.photo & filters.group & filters.reply)
async def handle_group_photo_reply(client, message):
    if not message.reply_to_message or not message.reply_to_message.photo:
        return

    status_message = await message.reply_text("📥 Downloading image for upload...")
    file_path = None
    try:
        file_path = await message.reply_to_message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await message.reply_text(f"❌ Error downloading image: `{e}`")
        return

    await status_message.edit_text("⬆️ Uploading to ImgBB (default host)...")
    imgbb_link = await upload_to_imgbb(file_path)
    response_text = ""

    if imgbb_link:
        response_text = f"🖼️ Here's your image link:\n`{imgbb_link}`\n_Uploaded via ImgBB_"
    else:
        response_text = "❌ Failed to upload image to the default host."

    await status_message.edit_text(response_text, parse_mode=enums.ParseMode.MARKDOWN)
    await asyncio.sleep(0.1)
    if os.path.exists(file_path):
        os.remove(file_path)

@pyro_client.on_message(filters.command("imgbb") & filters.group & filters.reply)
async def imgbb_command_in_group(client, message):
    if not message.reply_to_message or not message.reply_to_message.photo:
        await message.reply_text("Please reply to an image with `/imgbb` to get an ImgBB link.", parse_mode=enums.ParseMode.MARKDOWN)
        return

    status_message = await message.reply_text("📥 Downloading image for ImgBB upload...")
    file_path = None
    try:
        file_path = await message.reply_to_message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await status_message.edit_text(f"❌ Error downloading image: `{e}`")
        return

    await status_message.edit_text("⬆️ Uploading to ImgBB...")
    imgbb_link = await upload_to_imgbb(file_path)
    response_text = ""

    if imgbb_link:
        response_text = f"🖼️ Here's your ImgBB link:\n`{imgbb_link}`"
    else:
        response_text = "❌ Failed to upload image to ImgBB."

    await status_message.edit_text(response_text, parse_mode=enums.ParseMode.MARKDOWN)
    await asyncio.sleep(0.1)
    if os.path.exists(file_path):
        os.remove(file_path)

@pyro_client.on_message(filters.command("envs") & filters.group & filters.reply)
async def envs_command_in_group(client, message):
    if not message.reply_to_message or not message.reply_to_message.photo:
        await message.reply_text("Please reply to an image with `/envs` to get an Envs.sh link.", parse_mode=enums.ParseMode.MARKDOWN)
        return

    status_message = await message.reply_text("📥 Downloading image for Envs.sh upload...")
    file_path = None
    try:
        file_path = await message.reply_to_message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await status_message.edit_text(f"❌ Error downloading image: `{e}`")
        return

    await status_message.edit_text("⬆️ Uploading to Envs.sh...")
    envs_link = await upload_to_envs(image_path=file_path)
    response_text = ""

    if envs_link:
        response_text = f"🖼️ Here's your Envs.sh link:\n`{envs_link}`"
    else:
        response_text = "❌ Failed to upload image to Envs.sh."

    await status_message.edit_text(response_text, parse_mode=enums.ParseMode.MARKDOWN)
    await asyncio.sleep(0.1)
    if os.path.exists(file_path):
        os.remove(file_path)

@pyro_client.on_callback_query()
async def callback_handler(client, callback_query):
    data = callback_query.data
    user_id = callback_query.from_user.id
    message_id = callback_query.message.id
    chat_id = callback_query.message.chat.id

    if FORCE_SUB_CHANNEL and not await is_subscribed(client, user_id, FORCE_SUB_CHANNEL):
        await callback_query.answer("Please join our channel to use this bot!", show_alert=True)
        return

    parts = data.split(":")
    action_type = parts[0]
    unique_file_id = parts[1]

    file_path = temp_file_storage.get(unique_file_id)
    if not file_path or not os.path.exists(file_path):
        await client.edit_message_text(chat_id, message_id, "⚠️ Image file not found or already deleted. Please send the image again.")
        await callback_query.answer()
        if unique_file_id in temp_file_storage:
            del temp_file_storage[unique_file_id]
        return

    if data.startswith("upload_"):
        host_type = action_type.split("_")[1]
        await client.edit_message_text(chat_id, message_id, f"⬆️ Uploading to {host_type.upper()}...")

        link = None
        if host_type == "imgbb":
            link = await upload_to_imgbb(file_path)
        elif host_type == "envs":
            link = await upload_to_envs(image_path=file_path)
        elif host_type == "imgbox":
            link = await upload_to_imgbox(file_path)

        if link:
            await client.edit_message_text(
                chat_id, message_id,
                f"🔗 Your {host_type.upper()} link:\n`{link}`",
                parse_mode=enums.ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("Open Link", url=link)]])
            )
        else:
            await client.edit_message_text(chat_id, message_id, f"❌ Failed to upload to {host_type.upper()}.")

        await asyncio.sleep(0.1)
        if os.path.exists(file_path):
            os.remove(file_path)
        if unique_file_id in temp_file_storage:
            del temp_file_storage[unique_file_id]
        await callback_query.answer()

    elif data.startswith("delete_image:"):
        await asyncio.sleep(0.1)
        if os.path.exists(file_path):
            os.remove(file_path)
            await client.edit_message_text(chat_id, message_id, "🗑️ Image deleted from server. You can send another image.")
        else:
            await client.edit_message_text(chat_id, message_id, "⚠️ Image already deleted or not found.")
        if unique_file_id in temp_file_storage:
            del temp_file_storage[unique_file_id]
        await callback_query.answer("Image deleted.")

@pyro_client.on_message(filters.command("users") & filters.private & filters.user(OWNER_ID))
async def users_command(client, message):
    await message.reply_text("Counting users in database...")
    try:
        all_users = await db.get_all_users()
        user_count = len(all_users)
        await message.reply_text(f"📊 Total users in database: **{user_count}**", parse_mode=enums.ParseMode.MARKDOWN)
    except Exception as e:
        await message.reply_text(f"❌ Error fetching user count: `{e}`")
        print(f"Error in /users command: {e}")

@pyro_client.on_message(filters.command("broadcast") & filters.private & filters.user(OWNER_ID))
async def broadcast_command(client, message):
    if len(message.command) < 2:
        await message.reply_text("Usage: `/broadcast [your message]`", parse_mode=enums.ParseMode.MARKDOWN)
        return

    broadcast_message_text = message.text.split(" ", 1)[1]
    users = await db.get_all_users()
    sent_count = 0
    failed_count = 0
    status_message = await message.reply_text("🚀 Starting broadcast...")

    for user_id in users:
        try:
            if user_id == OWNER_ID:
                continue
            await client.send_message(user_id, broadcast_message_text)
            sent_count += 1
            await asyncio.sleep(0.1)
        except Exception as e:
            failed_count += 1
            print(f"Failed to send message to user {user_id}: {e}")

    await status_message.edit_text(
        f"✅ Broadcast complete!\n➡️ Sent to: **{sent_count}** users\n❌ Failed to send to: **{failed_count}** users"
    )

@pyro_client.on_message(filters.command(["start", "broadcast", "users"]) & filters.group)
async def group_command_restriction(client, message):
    if message.from_user.id != OWNER_ID:
        await message.reply_text("🚫 This command can only be used by the bot owner in groups.")
    # Else, do nothing — owner can proceed

# --- Webhook Setup Function ---
async def set_webhook_on_startup():
    webhook_base_url = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("K_SERVICE_URL")
    if not webhook_base_url:
        print("Warning: RENDER_EXTERNAL_URL or K_SERVICE_URL not found. Webhook will not be set.")
        return

    webhook_url = f"{webhook_base_url}/{BOT_TOKEN}"
    print(f"Attempting to set webhook to: {webhook_url}")

    try:
        await pyro_client.set_webhook(webhook_url)
        print(f"Webhook successfully set to: {webhook_url}")
    except Exception as e:
        print(f"Error setting webhook: {e}")

# For local testing only
if __name__ == "__main__":
    print("This script is primarily for defining bot logic and handlers.")
    print("To run the bot as a web service, execute `gunicorn app:app`.")
