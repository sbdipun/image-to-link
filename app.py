# app.py

import os
import logging
from flask import Flask, request, jsonify
from main import pyro_client, set_webhook_on_startup, BOT_TOKEN

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FlaskWebhookApp")

app = Flask(__name__)

WEBHOOK_PATH = f"/{BOT_TOKEN}"

@app.route('/')
def hello_world():
    logger.info("Health check received.")
    return 'Bot Is Up', 200


@app.route('/setwebhook', methods=['GET'])
def set_webhook():
    logger.info("Manual webhook setup triggered.")
    webhook_base_url = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("K_SERVICE_URL")
    if not webhook_base_url:
        logger.error("Missing RENDER_EXTERNAL_URL or K_SERVICE_URL.")
        return jsonify({"status": "error", "message": "Missing RENDER_EXTERNAL_URL or K_SERVICE_URL."}), 500

    webhook_url = f"{webhook_base_url}/{BOT_TOKEN}"
    logger.info(f"Setting webhook to: {webhook_url}")

    try:
        asyncio.run(set_webhook_on_startup())
        return jsonify({"status": "success", "webhook_url": webhook_url}), 200
    except Exception as e:
        logger.error(f"Failed to set webhook: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route(WEBHOOK_PATH, methods=["POST"])
async def telegram_webhook():
    logger.info("Received update from Telegram.")
    if request.method != "POST":
        logger.warning("Non-POST request received.")
        return jsonify({"status": "method not allowed"}), 405

    update = request.get_json()
    if not update:
        logger.warning("Empty update received.")
        return jsonify({"status": "error", "message": "Empty update"}), 400

    try:
        if not pyro_client.is_connected:
            await pyro_client.start()
            logger.info("Started Pyrogram client on demand.")

        await pyro_client.process_update(update)
        logger.info("Update processed successfully.")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.error(f"Error processing update: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting Flask app on port {port}...")
    app.run(host="0.0.0.0", port=port)
