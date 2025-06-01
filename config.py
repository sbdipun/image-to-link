# config.py

import os

# --- Telegram API Credentials ---
API_ID = int(os.environ.get("API_ID", 12345678)) # Replace with your actual API ID
API_HASH = os.environ.get("API_HASH", "your_api_hash_here") # Replace with your actual API Hash

# --- Bot Token ---
BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE") # Replace with your actual Bot Token

# --- MongoDB Connection URI ---
# Get this from your MongoDB Atlas dashboard (or your self-hosted MongoDB).
# It typically looks like: "mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/<database-name>?retryWrites=true&w=majority"
MONGO_URI = os.environ.get("MONGO_URI", "YOUR_MONGODB_CONNECTION_URI_HERE") # Replace with your actual MongoDB URI

# --- MongoDB Database and Collection Names ---
# Define the name of your MongoDB database
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "image_linker_bot_db") # You can change this to your desired database name
MONGO_COLLECTION_USERS = os.environ.get("MONGO_COLLECTION_USERS", "users") # You can change this to your desired collection name for users

# --- Force Subscription Channel ---
FORCE_SUB_CHANNEL = os.environ.get("FORCE_SUB_CHANNEL", "@YourForceSubChannel") # Replace with your channel username or ID, or set to None

# --- Bot Owner ID ---
OWNER_ID = int(os.environ.get("OWNER_ID", 1234567890)) # Replace with your actual Telegram User ID
IMGBB_API_KEY = os.environ.get("IMGBB_API_KEY", "YOUR_IMGBB_API_KEY_HERE") # Replace with your actual ImgBB API Key
IMGBOX_API_KEY = os.environ.get("IMGBOX_API_KEY", None) # Replace with your actual Imgbox API Key if needed, or None
# FREEIMAGEHOST_API_KEY = os.environ.get("FREEIMAGEHOST_API_KEY", "YOUR_FREEIMAGEHOST_API_KEY_HERE")
# CATBOX_API_KEY = os.environ.get("CATBOX_API_KEY", "YOUR_CATBOX_API_KEY_HERE")
