# hosts.py

import aiohttp
import asyncio
import os
import json # For parsing JSON responses if applicable
import datetime # For generating custom filenames
import random   # For generating random suffixes in filenames
import pyimgbox # Import the pyimgbox library directly

# Import API keys from config.py
from config import IMGBB_API_KEY, IMGBOX_API_KEY # Add other API keys here as needed

# --- ImgBB Uploader ---
async def upload_to_imgbb(image_path: str) -> str | None:
    """
    Uploads an image to ImgBB and returns the direct image URL.

    Args:
        image_path (str): The local path to the image file.

    Returns:
        str | None: The direct URL of the uploaded image, or None if upload fails.
    """
    if not IMGBB_API_KEY:
        print("ImgBB API key is not configured. Skipping ImgBB upload.")
        return None
        
    url = f"https://api.imgbb.com/1/upload?key={IMGBB_API_KEY}"
    
    async with aiohttp.ClientSession() as session:
        try:
            # Open the image file in binary read mode
            with open(image_path, 'rb') as f:
                # Prepare the multipart/form-data payload
                data = aiohttp.FormData()
                # Add the image file to the form data. 'image' is the field name required by ImgBB.
                # filename and content_type are important for proper handling by the server.
                data.add_field('image', f, filename=os.path.basename(image_path), content_type='image/png') # Or 'image/jpeg' etc.

                # Make the POST request
                async with session.post(url, data=data) as response:
                    response_json = await response.json()
                    
                    if response.status == 200 and response_json.get('success'):
                        # Extract the URL from the successful response
                        image_url = response_json.get('data', {}).get('url')
                        print(f"ImgBB upload successful: {image_url}")
                        return image_url
                    else:
                        error_message = response_json.get('error', {}).get('message', 'Unknown error')
                        print(f"ImgBB upload failed (Status: {response.status}): {error_message}")
                        return None
        except FileNotFoundError:
            print(f"Error: Image file not found at {image_path}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred during ImgBB upload: {e}")
            return None

# --- Re-added and Updated: Envs.sh Uploader based on provided TypeScript logic ---
async def upload_to_envs(image_path: str = None, image_url: str = None) -> str | None:
    """
    Uploads an image to Envs.sh and returns the direct image URL.
    Supports uploading a local file (from image_path) or a remote URL (from image_url).
    
    IMPORTANT NOTE: The standard envs.sh service is primarily for environment variables.
    While this function implements the provided TypeScript logic for file/URL upload
    and custom filename generation, it's crucial to verify if the actual envs.sh service
    you are targeting supports this behavior at its root URL ("https://envs.sh/").
    Appending a custom filename to the returned URL might result in a broken link
    if the service does not support custom paths or renaming after upload.

    Args:
        image_path (str, optional): The local path to the image file.
        image_url (str, optional): A remote URL of the image to upload.

    Returns:
        str | None: The direct URL of the uploaded image, or None if upload fails.
    """
    # Corrected URL as per user's instruction
    ENVS_SH_UPLOAD_URL = "https://envs.sh/"
    
    async with aiohttp.ClientSession() as session:
        try:
            formData = aiohttp.FormData()

            if image_url:
                # Upload via remote URL
                formData.add_field("url", image_url)
                print(f"Attempting to upload remote URL to Envs.sh: {image_url}")
            elif image_path and os.path.exists(image_path):
                # Upload via local file: Read content first to prevent I/O error
                with open(image_path, 'rb') as f:
                    file_content = f.read()
                
                fileName = os.path.basename(image_path)
                # Use a generic image type or try to infer from file extension if possible
                content_type = "image/jpeg" # Defaulting as per TS example, adjust if needed
                if fileName.lower().endswith('.png'):
                    content_type = 'image/png'
                elif fileName.lower().endswith('.gif'):
                    content_type = 'image/gif'

                formData.add_field("file", file_content, filename=fileName, content_type=content_type)
                print(f"Attempting to upload local file to Envs.sh: {image_path}")
            else:
                print("Error: Either image_path (existing file) or image_url must be provided for Envs.sh upload.")
                return None

            # Send request
            async with session.post(ENVS_SH_UPLOAD_URL, data=formData) as response:
                if response.ok: # Check if response status is 2xx
                    # envs.sh is expected to return plain text URL
                    url = await response.text()
                    cleanedUrl = url.strip()

                    if cleanedUrl.startswith("http"):
                        # Generate custom filename as per TS logic
                        now = datetime.datetime.now()
                        formattedDate = now.strftime("%Y%m%d") #YYYYMMDD
                        randomSuffix = random.randint(0, 999) # 0 to 999
                        # Use original file extension if available, otherwise default to .jpg
                        ext = os.path.splitext(fileName)[1] if image_path else ".jpg"
                        customFileName = f"IMG{formattedDate}{randomSuffix}{ext}"

                        # IMPORTANT FIX: Added missing slash for correct URL construction
                        final_link = f"{cleanedUrl}/{customFileName}" 
                        print(f"Envs.sh upload successful. Generated link (might be broken): {final_link}")
                        return final_link
                    else:
                        print(f"Envs.sh upload returned non-URL text: {cleanedUrl}")
                        return None
                else:
                    error_text = await response.text()
                    print(f"Envs.sh HTTP error! Status: {response.status}, Response: {error_text}")
                    return None

        except FileNotFoundError:
            print(f"Error: Local image file not found at {image_path}")
            return None
        except aiohttp.ClientError as e:
            print(f"Network or client error during Envs.sh upload: {e}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred during Envs.sh upload: {e}")
            return None

# --- Updated: Imgbox Uploader using pyimgbox (Corrected usage - no API key) ---
async def upload_to_imgbox(image_path: str) -> str | None:
    """
    Uploads an image to Imgbox.com using the pyimgbox library and returns the direct image URL.
    This version assumes no API key is required for public uploads.

    Args:
        image_path (str): The local path to the image file.

    Returns:
        str | None: The direct URL of the uploaded image, or None if upload fails.
    """
    try:
        print(f"Attempting to upload to Imgbox using pyimgbox: {image_path}")
        # IMPORTANT FIX: Create a Gallery instance without api_key as it's not required.
        # The Gallery context manager ensures proper closing.
        # Pass IMGBOX_API_KEY if it's explicitly set in config, otherwise it will be None.
        async with pyimgbox.Gallery(api_key=IMGBOX_API_KEY) as gallery: 
            submission = await gallery.upload(image_path)
            
            if submission and submission.get('success'):
                image_url = submission.get('url') # This is usually the direct image URL
                if image_url:
                    print(f"Imgbox upload successful: {image_url}")
                    return image_url
                else:
                    print(f"Imgbox upload successful but no URL found in response: {submission}")
                    return None
            else:
                error_message = submission.get('error', 'Unknown error from Imgbox') if submission else 'No submission data'
                print(f"Imgbox upload failed: {error_message}")
                return None
    except FileNotFoundError:
        print(f"Error: Image file not found at {image_path}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during Imgbox upload with pyimgbox: {e}")
        return None

# --- Placeholder for FreeImageHost Uploader ---
# You will need to research FreeImageHost's API documentation.
# It might require an API key, specific headers, or a different POST body format (e.g., JSON with base64 image).
async def upload_to_freeimagehost(image_path: str) -> str | None:
    """
    Uploads an image to FreeImageHost and returns the direct image URL.
    (Implementation requires FreeImageHost API research)

    Args:
        image_path (str): The local path to the image file.

    Returns:
        str | None: The direct URL of the uploaded image, or None if upload fails.
    """
    print("FreeImageHost upload function is a placeholder. Please implement its API.")
    return None

# --- Placeholder for Catbox Uploader ---
# Catbox also has a relatively simple API, often using multipart/form-data.
# Check their documentation for specific field names (e.g., 'fileToUpload', 'reqtype').
async def upload_to_catbox(image_path: str) -> str | None:
    """
    Uploads an image to Catbox and returns the direct image URL.
    (Implementation requires Catbox API research)

    Args:
        image_path (str): The local path to the image file.

    Returns:
        str | None: The direct URL of the uploaded image, or None if upload fails.
    """
    print("Catbox upload function is a placeholder. Please implement its API.")
    return None

