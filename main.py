import os
import asyncio
import uuid # Import uuid for generating unique IDs
from pyrogram import Client, filters, enums
from pyrogram.types import InlineKeyboardButton, InlineKeyboardMarkup

# Import configurations and database/host functions
from config import API_ID, API_HASH, BOT_TOKEN, MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS, FORCE_SUB_CHANNEL, OWNER_ID
from db import Database, is_subscribed
from hosts import upload_to_imgbb, upload_to_envs, upload_to_imgbox # Add imports for other hosts as you implement them

# Initialize the Database client
db = Database(MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS)

# Initialize the Pyrogram Client
app = Client("image_linker_bot", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

# --- Temporary storage for file paths ---
# This dictionary will store a mapping from a short, unique ID to the actual file path.
# This is necessary because callback_data has a 64-byte limit.
# Note: This storage is in-memory and will be cleared if the bot restarts.
# For persistent temporary storage across restarts, a database (with TTL index) would be needed.
temp_file_storage = {}

# --- Ensure downloads directory exists ---
# This is crucial for deployment platforms like Render/Koyeb to ensure the directory
# where temporary files are stored is created if it doesn't exist.
DOWNLOADS_DIR = "downloads"
if not os.path.exists(DOWNLOADS_DIR):
    os.makedirs(DOWNLOADS_DIR)
    print(f"Created downloads directory: {DOWNLOADS_DIR}")


# --- Start Command Handler (Private Chat) ---
@app.on_message(filters.command("start") & filters.private)
async def start_command(client, message):
    user_id = message.from_user.id
    
    # Add user to database if they don't exist
    if not await db.get_user(user_id):
        await db.add_user(user_id)
    
    # Force subscription check
    if FORCE_SUB_CHANNEL and not await is_subscribed(client, user_id, FORCE_SUB_CHANNEL):
        await message.reply_text(
            "Hello! Please join our channel to use this bot. Once you join, click 'Start' again.",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("📢 Join Channel", url=f"https://t.me/{FORCE_SUB_CHANNEL.replace('@', '')}")]]
            )
        )
        return

    await message.reply_text(
        "👋 Hello! I'm your image linking bot.\n\n"
        "**In private chat:** Send me an image, and I'll give you options to upload it to various hosting sites.\n\n"
        "**In groups:** Reply to an image with any text, or use `/imgbb`, `/envs` as a reply to an image, and I'll provide a link."
    )

# --- Handle Photos in Private Chat ---
@app.on_message(filters.photo & filters.private)
async def handle_private_photo(client, message):
    user_id = message.from_user.id

    # Re-check force subscription for every photo
    if FORCE_SUB_CHANNEL and not await is_subscribed(client, user_id, FORCE_SUB_CHANNEL):
        await message.reply_text(
            "Please join our channel to use this bot!",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("📢 Join Channel", url=f"https://t.me/{FORCE_SUB_CHANNEL.replace('@', '')}")]]
            )
        )
        return

    status_message = await message.reply_text("📥 Downloading your image...")
    file_path = None
    try:
        # Save downloaded files into the 'downloads' directory
        file_path = await message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await status_message.edit_text(f"❌ Error downloading image: `{e}`")
        return

    # Generate a unique ID for the downloaded file and store its path
    unique_file_id = uuid.uuid4().hex
    temp_file_storage[unique_file_id] = file_path

    # Create inline keyboard for hosting options, using the unique_file_id
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔗 Upload to ImgBB", callback_data=f"upload_imgbb:{unique_file_id}")],
            [InlineKeyboardButton("🔗 Upload to Envs.sh", callback_data=f"upload_envs:{unique_file_id}")],
            [InlineKeyboardButton("🔗 Upload to Imgbox", callback_data=f"upload_imgbox:{unique_file_id}")],
            # Add more buttons here for other hosts like FreeImageHost, Catbox, etc.
            # Example: [InlineKeyboardButton("🔗 Upload to FreeImageHost", callback_data=f"upload_freeimagehost:{unique_file_id}")],
            [InlineKeyboardButton("🗑️ Delete Downloaded Image", callback_data=f"delete_image:{unique_file_id}")]
        ]
    )
    await status_message.edit_text("✨ Image downloaded. Choose an image host:", reply_markup=keyboard)

# --- Handle Photo Replies in Group Chats (Automatic Upload) ---
@app.on_message(filters.photo & filters.group & filters.reply)
async def handle_group_photo_reply(client, message):
    # This specifically triggers if someone replies to an image in a group.
    # The bot will automatically upload it to a default host (e.g., ImgBB) and provide a link.
    
    # Check if the replied message is an image
    if not message.reply_to_message or not message.reply_to_message.photo:
        return # Not a reply to a photo

    status_message = await message.reply_text("📥 Downloading image for upload...")
    file_path = None
    try:
        # Save downloaded files into the 'downloads' directory
        file_path = await message.reply_to_message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await message.reply_text(f"❌ Error downloading image: `{e}`")
        return

    await status_message.edit_text("⬆️ Uploading to ImgBB (default host)...")
    imgbb_link = await upload_to_imgbb(file_path) # You can choose a default host here

    response_text = ""
    if imgbb_link:
        response_text = f"🖼️ Here's your image link:\n`{imgbb_link}`\n\n_Uploaded via ImgBB_"
    else:
        response_text = "❌ Failed to upload image to the default host."

    await status_message.edit_text(response_text, parse_mode=enums.ParseMode.MARKDOWN)
    
    # Added sleep before file deletion to avoid file lock issues
    await asyncio.sleep(0.1) 
    if os.path.exists(file_path):
        os.remove(file_path)

# --- New: /imgbb command in groups (reply to photo) ---
@app.on_message(filters.command("imgbb") & filters.group & filters.reply)
async def imgbb_command_in_group(client, message):
    if not message.reply_to_message or not message.reply_to_message.photo:
        await message.reply_text("Please reply to an image with `/imgbb` to get an ImgBB link.", parse_mode=enums.ParseMode.MARKDOWN)
        return

    status_message = await message.reply_text("📥 Downloading image for ImgBB upload...")
    file_path = None
    try:
        # Save downloaded files into the 'downloads' directory
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
    
    # Added sleep before file deletion to avoid file lock issues
    await asyncio.sleep(0.1)
    if os.path.exists(file_path):
        os.remove(file_path)

# --- New: /envs command in groups (reply to photo) ---
@app.on_message(filters.command("envs") & filters.group & filters.reply)
async def envs_command_in_group(client, message):
    if not message.reply_to_message or not message.reply_to_message.photo:
        await message.reply_text("Please reply to an image with `/envs` to get an Envs.sh link.", parse_mode=enums.ParseMode.MARKDOWN)
        return

    status_message = await message.reply_text("📥 Downloading image for Envs.sh upload...")
    file_path = None
    try:
        # Save downloaded files into the 'downloads' directory
        file_path = await message.reply_to_message.download(file_name=os.path.join(DOWNLOADS_DIR, str(uuid.uuid4())))
    except Exception as e:
        await status_message.edit_text(f"❌ Error downloading image: `{e}`")
        return

    await status_message.edit_text("⬆️ Uploading to Envs.sh...")
    envs_link = await upload_to_envs(image_path=file_path) # Pass image_path

    response_text = ""
    if envs_link:
        response_text = f"🖼️ Here's your Envs.sh link:\n`{envs_link}`"
    else:
        response_text = "❌ Failed to upload image to Envs.sh."

    await status_message.edit_text(response_text, parse_mode=enums.ParseMode.MARKDOWN)
    
    # Added sleep before file deletion to avoid file lock issues
    await asyncio.sleep(0.1)
    if os.path.exists(file_path):
        os.remove(file_path)

# --- Callback Query Handler (for inline buttons) ---
@app.on_callback_query()
async def callback_handler(client, callback_query):
    data = callback_query.data
    user_id = callback_query.from_user.id
    message_id = callback_query.message.id
    chat_id = callback_query.message.chat.id

    # Force subscription check for callback queries
    if FORCE_SUB_CHANNEL and not await is_subscribed(client, user_id, FORCE_SUB_CHANNEL):
        await callback_query.answer(
            "Please join our channel to use this bot!",
            show_alert=True
        )
        return

    if data.startswith("upload_") or data.startswith("delete_image:"):
        parts = data.split(":")
        action_type = parts[0] # e.g., 'upload_imgbb', 'delete_image'
        unique_file_id = parts[1] # This is the short ID

        # Retrieve the actual file path from temporary storage
        file_path = temp_file_storage.get(unique_file_id)

        if not file_path or not os.path.exists(file_path):
            await client.edit_message_text(chat_id, message_id, "⚠️ Image file not found or already deleted. Please send the image again.")
            await callback_query.answer()
            # Clean up the entry if it's somehow stale but still in storage
            if unique_file_id in temp_file_storage:
                del temp_file_storage[unique_file_id]
            return

    if data.startswith("upload_"):
        host_type = action_type.split("_")[1] # e.g., 'imgbb', 'envs', 'imgbox'

        await client.edit_message_text(chat_id, message_id, f"⬆️ Uploading to {host_type.upper()}...")
        link = None
        
        # Call the appropriate upload function based on host_type
        if host_type == "imgbb":
            link = await upload_to_imgbb(file_path)
        elif host_type == "envs":
            link = await upload_to_envs(image_path=file_path)
        elif host_type == "imgbox":
            link = await upload_to_imgbox(file_path)
        # Add more elif conditions for other hosts you implement in hosts.py
        # elif host_type == "freeimagehost":
        #     link = await upload_to_freeimagehost(file_path)
        # elif host_type == "catbox":
        #     link = await upload_to_catbox(file_path)

        if link:
            await client.edit_message_text(
                chat_id, message_id, 
                f"🔗 Your {host_type.upper()} link:\n`{link}`", 
                parse_mode=enums.ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup(
                    [[InlineKeyboardButton("Open Link", url=link)]] # Optional: Add a button to open the link
                )
            )
        else:
            await client.edit_message_text(chat_id, message_id, f"❌ Failed to upload to {host_type.upper()}.")
        
        # Added sleep before file deletion to avoid file lock issues
        await asyncio.sleep(0.1)
        # Clean up the downloaded file and its entry from temporary storage
        if os.path.exists(file_path):
            os.remove(file_path)
        if unique_file_id in temp_file_storage:
            del temp_file_storage[unique_file_id]
        
        await callback_query.answer() # Acknowledge the callback query

    elif data.startswith("delete_image:"):
        # file_path is already retrieved above
        # Added sleep before file deletion to avoid file lock issues
        await asyncio.sleep(0.1)
        if os.path.exists(file_path):
            os.remove(file_path)
            await client.edit_message_text(chat_id, message_id, "🗑️ Image deleted from server. You can send another image.")
        else:
            await client.edit_message_text(chat_id, message_id, "⚠️ Image already deleted or not found.")
        
        # Clean up the entry from temporary storage
        if unique_file_id in temp_file_storage:
            del temp_file_storage[unique_file_id]
            
        await callback_query.answer("Image deleted.")

# --- New: /users command (Owner-only, Private) ---
@app.on_message(filters.command("users") & filters.private & filters.user(OWNER_ID))
async def users_command(client, message):
    """
    Handles the /users command to display the total number of users in the database.
    This command is only accessible to the bot owner in private chat.
    """
    await message.reply_text("Counting users in database...")
    try:
        all_users = await db.get_all_users()
        user_count = len(all_users)
        await message.reply_text(f"📊 Total users in database: **{user_count}**", parse_mode=enums.ParseMode.MARKDOWN)
    except Exception as e:
        await message.reply_text(f"❌ Error fetching user count: `{e}`")
        print(f"Error in /users command: {e}")

# --- Broadcasting Command (Owner-only) ---
@app.on_message(filters.command("broadcast") & filters.private & filters.user(OWNER_ID))
async def broadcast_command(client, message):
    if len(message.command) < 2:
        await message.reply_text("Usage: `/broadcast [your message]`", parse_mode=enums.ParseMode.MARKDOWN)
        return
    
    broadcast_message_text = message.text.split(" ", 1)[1]
    
    # Get all user IDs from the database
    users = await db.get_all_users()
    
    sent_count = 0
    failed_count = 0
    
    status_message = await message.reply_text("🚀 Starting broadcast...")
    
    for user_id in users:
        try:
            # Skip broadcasting to the owner's ID itself if it's in the list
            if user_id == OWNER_ID:
                continue 
            
            await client.send_message(user_id, broadcast_message_text)
            sent_count += 1
            await asyncio.sleep(0.1) # Small delay to avoid hitting Telegram's flood limits
        except Exception as e:
            failed_count += 1
            print(f"Failed to send message to user {user_id}: {e}")
            
    await status_message.edit_text(
        f"✅ Broadcast complete!\n"
        f"➡️ Sent to: **{sent_count}** users\n"
        f"❌ Failed to send to: **{failed_count}** users"
    )

# --- Command Restriction in Groups ---
# This filter applies to commands like /start, /broadcast, and /users in groups,
# ensuring only the owner can use them.
@app.on_message(filters.command(["start", "broadcast", "users"]) & filters.group)
async def group_command_restriction(client, message):
    if message.from_user.id != OWNER_ID:
        await message.reply_text("🚫 This command can only be used by the bot owner in groups.")
    else:
        # If the owner uses it, let the actual command handler take over
        pass 

# --- Start the Bot ---
# This block ensures the bot only runs when the script is executed directly,
# which is standard practice for deployment.
if __name__ == "__main__":
    print("🚀 Bot starting...")
    app.run()
    print("🎉 Bot started successfully!")

