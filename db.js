// db.js

const { MongoClient } = require("mongodb");
const config = require("./config");

let client;
let db;

async function connectToDatabase() {
    if (!config.MONGO_URI) {
        throw new Error("MONGO_URI not found in config.");
    }

    client = new MongoClient(config.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    try {
        await client.connect();
        db = client.db(config.MONGO_DB_NAME);
        console.log(`✅ Connected to MongoDB database: ${config.MONGO_DB_NAME}`);
        return db;
    } catch (err) {
        console.error("❌ Failed to connect to MongoDB:", err.message);
        process.exit(1);
    }
}

// --- Database Functions ---

/**
 * Adds a user to the database
 */
async function addUser(user_id) {
    const collection = db.collection(config.MONGO_COLLECTION_USERS);
    const existingUser = await getUser(user_id);

    if (!existingUser) {
        await collection.insertOne({
            user_id: user_id,
            joined_at: new Date(),
        });
        console.log(`➕ User ${user_id} added to database`);
    }
}

/**
 * Gets a user by ID
 */
async function getUser(user_id) {
    const collection = db.collection(config.MONGO_COLLECTION_USERS);
    return await collection.findOne({ user_id: user_id });
}

/**
 * Gets all users from the database
 */
async function getAllUsers() {
    const collection = db.collection(config.MONGO_COLLECTION_USERS);
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
