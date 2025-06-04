// hosts.js

const fs = require("fs/promises"); // Keep fs/promises for consistency with existing code
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const logger = require('./logger');

// Import API keys from config.js
const config = require("./config");
const IMGBB_API_KEY = config.IMGBB_API_KEY;
const IMGBOX_API_KEY = config.IMGBOX_API_KEY;
const IMG_UPLOAD_API_KEY = config.IMG_UPLOAD_API_KEY; // New API key

// --- Upload to ImgBB ---
async function uploadToImgbb(imagePath) {
    if (!IMGBB_API_KEY) {
        logger.warn("ImgBB API key not configured. Skipping ImgBB upload.");
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
            logger.info(`ImgBB upload successful: ${imageUrl}`);
            return imageUrl;
        } else {
            logger.error(`ImgBB upload failed: ${response.data.error?.message || 'Unknown error'}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error uploading to ImgBB: ${error.message}`);
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
            logger.info(`Uploading remote URL to Envs.sh: ${imageUrl}`);
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
            logger.info(`Uploading local file to Envs.sh: ${imagePath}`);
        } else {
            logger.error("No image URL or file path provided for Envs.sh upload.");
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
            logger.info(`Envs.sh upload successful: ${cleanedUrl}`); // Changed console.log to logger.info
            return cleanedUrl;
        } else {
            logger.error(`Envs.sh upload failed: ${response.statusText}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error uploading to Envs.sh: ${error.message}`);
        return null;
    }
}

// --- Upload to Imgbox ---
async function uploadToImgbox(imagePath) {
    if (!IMGBOX_API_KEY) {
        logger.warn("Imgbox API key not configured. Skipping Imgbox upload.");
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
            logger.info(`Imgbox upload successful: ${imageUrl}`);
            return imageUrl;
        } else {
            logger.error(`Imgbox upload failed: ${response.data.error?.message || "Unknown error"}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error uploading to Imgbox: ${error.message}`);
        return null;
    }
}

// --- Upload to ImgHippo ---
const uploadToImgHippo = async (imagePath, apiKey, title = null) => {
  if (!apiKey) {
    logger.warn("ImgHippo API key not provided. Skipping ImgHippo upload.");
    return null;
  }
  const form = new FormData();

  form.append('file', require('node:fs').createReadStream(imagePath));

  if (title) {
    form.append('title', title);
  }

  try {
    const { data } = await axios.post(
      `https://www.imghippo.com/v1/upload?api_key=${apiKey}`,
      form,
      {
        headers: form.getHeaders()
      }
    );
    return data.data.view_url;
  } catch (error) {
    logger.error(`Error uploading image to ImgHippo: ${error.message}`);
    if (axios.isAxiosError(error)) {
        logger.error(`ImgHippo API response error: ${JSON.stringify(error.response?.data)}`);
    }
    return null;
  }
};


// --- Placeholder for FreeImageHost ---
function uploadToFreeImageHost(imagePath) {
    logger.warn("FreeImageHost upload is not implemented yet.");
    return null;
}

// --- Placeholder for Catbox ---
function uploadToCatbox(imagePath) {
    logger.warn("Catbox upload is not implemented yet.");
    return null;
}

module.exports = {
    uploadToImgbb,
    uploadToEnvs,
    uploadToImgbox,
    uploadToImgHippo, // Export the new function
    uploadToFreeimagehost: uploadToFreeImageHost,
    uploadToCatbox: uploadToCatbox,
};
