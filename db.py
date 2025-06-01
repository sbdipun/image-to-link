# db.py

import asyncio
import datetime # Import the datetime module
from motor.motor_asyncio import AsyncIOMotorClient
from pyrogram import Client, enums # Import Client and enums for the is_subscribed function

# Import the MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS, and FORCE_SUB_CHANNEL from config.py
from config import MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS, FORCE_SUB_CHANNEL

class Database:
    """
    A class to handle all asynchronous MongoDB database operations for the bot.
    It uses motor (AsyncIOMotorClient) for non-blocking database interactions.
    """
    def __init__(self, uri: str, db_name: str, collection_users_name: str):
        """
        Initializes the MongoDB client and selects the database and collections.

        Args:
            uri (str): The MongoDB connection URI.
            db_name (str): The name of the database to connect to.
            collection_users_name (str): The name of the collection for user data.
        """
        # Initialize the asynchronous MongoDB client
        self._client = AsyncIOMotorClient(uri)
        # Select the specific database using the provided db_name
        self.db = self._client[db_name]
        # Select the 'users' collection within the database using the provided collection_users_name
        self.users = self.db[collection_users_name]

    async def add_user(self, user_id: int):
        """
        Adds a new user to the database if they don't already exist.

        Args:
            user_id (int): The Telegram User ID of the user to add.
        """
        # Create a user document with their ID and the current timestamp
        # Using datetime.datetime.now() for the current timestamp
        user_data = {"_id": user_id, "joined_at": datetime.datetime.now()}
        try:
            # Insert the user document. If a user with this _id already exists,
            # insert_one will raise a DuplicateKeyError, which we can ignore.
            await self.users.insert_one(user_data)
            print(f"User {user_id} added to the database.")
        except Exception as e:
            # Handle cases where the user might already exist or other insertion errors
            print(f"Failed to add user {user_id} to database: {e}")

    async def get_user(self, user_id: int):
        """
        Retrieves a user's document from the database.

        Args:
            user_id (int): The Telegram User ID of the user to retrieve.

        Returns:
            dict or None: The user's document if found, otherwise None.
        """
        # Find and return one document where the _id matches the user_id
        return await self.users.find_one({"_id": user_id})

    async def get_all_users(self) -> list[int]:
        """
        Retrieves all user IDs from the database.

        Returns:
            list[int]: A list of all user IDs.
        """
        # Iterate through all documents in the 'users' collection and extract their _id
        return [user["_id"] async for user in self.users.find({})]

# Initialize the Database instance using the MONGO_URI, MONGO_DB_NAME, and MONGO_COLLECTION_USERS
# from config.py. This instance will be imported and used in main.py.
db = Database(MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION_USERS)

async def is_subscribed(client: Client, user_id: int, channel_id: str) -> bool:
    """
    Checks if a user is subscribed to a specific Telegram channel.

    Args:
        client (pyrogram.Client): The Pyrogram Client instance.
        user_id (int): The Telegram User ID to check.
        channel_id (str): The username (e.g., "@channel_name") or ID (e.g., -100123456789) of the channel.

    Returns:
        bool: True if the user is a member (or admin/creator), False otherwise.
    """
    if not channel_id:
        # If no force subscribe channel is configured, always return True
        return True
    try:
        # Get chat member status. This will raise an exception if the user is not found
        # or if the channel ID is invalid.
        member = await client.get_chat_member(channel_id, user_id)
        # Check if the user's status indicates they are a member
        return member.status in [enums.ChatMemberStatus.MEMBER, 
                                  enums.ChatMemberStatus.ADMINISTRATOR, 
                                  enums.ChatMemberStatus.OWNER]
    except Exception as e:
        # If any error occurs (e.g., user not found in channel, channel not found),
        # assume they are not subscribed for safety.
        print(f"Error checking subscription for user {user_id} in channel {channel_id}: {e}")
        return False

