// db.js

const { MongoClient } = require("mongodb");
const config = require("./config");
const logger = require('./logger'); // Added

let client;
let db;

async function connectToDatabase() {
    if (!config.MONGO_URI) {
        logger.error("❌ MONGO_URI not found in config. Please set it."); // Changed console.error to logger.error
        throw new Error("MONGO_URI not found in config.");
    }

    client = new MongoClient(config.MONGO_URI);

    try {
        await client.connect();
        db = client.db(config.MONGO_DB_NAME); // Uses new config variable
        logger.info(`✅ Connected to MongoDB database: ${config.MONGO_DB_NAME}`); // Changed console.log to logger.info
        return db;
    } catch (err) {
        logger.error(`❌ Failed to connect to MongoDB: ${err.message}`); // Changed console.error to logger.error
        process.exit(1);
    }
}

// --- Database Functions ---

/**
 * Adds a user to the database
 */
async function addUser(user_id) {
    const collection = db.collection(config.MONGO_COLLECTION_USERS); // Uses new config variable
    const existingUser = await getUser(user_id);

    if (!existingUser) {
        await collection.insertOne({
            user_id: user_id,
            joined_at: new Date(),
        });
        logger.info(`➕ User ${user_id} added to database`); // Changed console.log to logger.info
    }
}

/**
 * Gets a user by ID
 */
async function getUser(user_id) {
    const collection = db.collection(config.MONGO_COLLECTION_USERS); // Uses new config variable
    return await collection.findOne({ user_id: user_id });
}

/**
 * Gets all users from the database
 */
async function getAllUsers() {
    const collection = db.collection(config.MONGO_COLLECTION_USERS); // Uses new config variable
    const cursor = collection.find({});
    const users = await cursor.toArray();
    return users.map(u => u.user_id);
}

module.exports = {
    connectToDatabase,
    addUser,
    getUser,
    getAllUsers,
};
