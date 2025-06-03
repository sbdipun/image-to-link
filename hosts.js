// hosts.js

const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const logger = require('./logger'); // Added

// Import API keys from config.js
const config = require("./config");
const IMGBB_API_KEY = config.IMGBB_API_KEY;
const IMGBOX_API_KEY = config.IMGBOX_API_KEY;

// --- Upload to ImgBB ---
async function uploadToImgbb(imagePath) {
    if (!IMGBB_API_KEY) {
        logger.warn("ImgBB API key not configured. Skipping ImgBB upload."); // Changed console.log to logger.warn
        return null;
    }

    try {
        const file = await fs.readFile(imagePath);
        const formData = new FormData();
        const fileName = path.basename(imagePath);

        formData.append("image", file, {
            filename: fileName,
            contentType: "image/png", // Use image/jpeg for .jpg files
        });

        const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
        const response = await axios.post(url, formData, {
            headers: formData.getHeaders(),
        });

        if (response.status === 200 && response.data.success) {
            const imageUrl = response.data.data.url;
            logger.info(`ImgBB upload successful: ${imageUrl}`); // Changed console.log to logger.info
            return imageUrl;
        } else {
            logger.error(`ImgBB upload failed: ${response.data.error?.message || 'Unknown error'}`); // Changed console.error to logger.error
            return null;
        }
    } catch (error) {
        logger.error(`Error uploading to ImgBB: ${error.message}`); // Changed console.error to logger.error
        return null;
    }
}

// --- Upload to Envs.sh ---
async function uploadToEnvs({ imagePath = null, imageUrl = null }) {
    const ENVS_SH_UPLOAD_URL = "https://envs.sh/";

    try {
        const formData = new FormData();

        if (imageUrl) {
            // Upload via remote URL
            formData.append("url", imageUrl);
            logger.info(`Uploading remote URL to Envs.sh: ${imageUrl}`); // Changed console.log to logger.info
        } else if (imagePath) {
            // Upload via local file
            const fileBuffer = await fs.readFile(imagePath);
            const fileName = path.basename(imagePath);
            // Determine content type based on file extension
            const ext = path.extname(imagePath).toLowerCase();
            let contentType = "application/octet-stream"; // Default
            if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
            else if (ext === ".png") contentType = "image/png";
            else if (ext === ".gif") contentType = "image/gif";

            formData.append("file", fileBuffer, {
                filename: fileName,
                contentType: contentType,
            });
            logger.info(`Uploading local file to Envs.sh: ${imagePath}`); // Changed console.log to logger.info
        } else {
            logger.error("No image URL or file path provided for Envs.sh upload."); // Changed console.error to logger.error
            return null;
        }

        const response = await axios.post(ENVS_SH_UPLOAD_URL, formData, {
            headers: formData.getHeaders(),
        });

        if (response.status === 200) {
            let cleanedUrl = response.data.trim();
            if (!cleanedUrl.startsWith("http")) {
                cleanedUrl = `https://${cleanedUrl}`;
            }
            console.log(`Envs.sh upload successful: ${cleanedUrl}`);
            return cleanedUrl;
        } else {
            logger.error(`Envs.sh upload failed: ${response.statusText}`); // Changed console.error to logger.error
            return null;
        }
    } catch (error) {
        logger.error(`Error uploading to Envs.sh: ${error.message}`); // Changed console.error to logger.error
        return null;
    }
}

// --- Upload to Imgbox ---
async function uploadToImgbox(imagePath) {
    if (!IMGBOX_API_KEY) {
        logger.warn("Imgbox API key not configured. Skipping Imgbox upload."); // Changed console.log to logger.warn
        return null;
    }

    try {
        const fileBuffer = await fs.readFile(imagePath);
        const fileName = path.basename(imagePath);

        const formData = new FormData();
        formData.append("key", IMGBOX_API_KEY);
        formData.append("action", "upload");
        formData.append("source", fileBuffer, {
            filename: fileName,
            contentType: "image/jpeg",
        });

        const response = await axios.post("https://imgbox.com/api/json/upload.php", formData, {
            headers: formData.getHeaders(),
        });

        if (response.status === 200 && response.data.success) {
            const imageUrl = response.data.image.url;
            logger.info(`Imgbox upload successful: ${imageUrl}`); // Changed console.log to logger.info
            return imageUrl;
        } else {
            logger.error(`Imgbox upload failed: ${response.data.error?.message || "Unknown error"}`); // Changed console.error to logger.error
            return null;
        }
    } catch (error) {
        logger.error(`Error uploading to Imgbox: ${error.message}`); // Changed console.error to logger.error
        return null;
    }
}

// --- Placeholder for FreeImageHost ---
function uploadToFreeImageHost(imagePath) {
    logger.warn("FreeImageHost upload is not implemented yet."); // Changed console.warn to logger.warn
    return null;
}

// --- Placeholder for Catbox ---
function uploadToCatbox(imagePath) {
    logger.warn("Catbox upload is not implemented yet."); // Changed console.warn to logger.warn
    return null;
}

module.exports = {
    uploadToImgbb,
    uploadToEnvs,
    uploadToImgbox,
    uploadToFreeimagehost: uploadToFreeImageHost,
    uploadToCatbox: uploadToCatbox,
};
