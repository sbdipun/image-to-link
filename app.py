# app.py

try:
    import uvloop
    import asyncio
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
except ImportError:
    print("uvloop not found. Using default asyncio event loop.")

from flask import Flask, request, jsonify
import os
import requests

from main import pyro_client, set_webhook_on_startup, BOT_TOKEN

app = Flask(__name__)

TELEGRAM_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}" 
WEBHOOK_PATH = f"/{BOT_TOKEN}"

@app.route('/')
def hello_world():
    return 'Bot Is Up', 200


@app.route('/setwebhook', methods=['GET'])
def set_webhook():
    public_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("K_SERVICE_URL")
    if not public_url:
        return jsonify({
            "status": "error",
            "message": "Missing RENDER_EXTERNAL_URL or K_SERVICE_URL environment variable."
        }), 500

    webhook_url = f"{public_url}/{BOT_TOKEN}"

    response = requests.get(f"{TELEGRAM_API_URL}/getWebhookInfo")
    current_info = response.json()
    print("Current webhook info:", current_info)

    response = requests.post(
        f"{TELEGRAM_API_URL}/setWebhook",
        json={"url": webhook_url}
    )

    result = response.json()
    if result.get("ok"):
        return jsonify({
            "status": "success",
            "webhook_url": webhook_url,
            "telegram_response": result
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Failed to set webhook",
            "telegram_response": result
        }), 500


@app.route(WEBHOOK_PATH, methods=["POST"])
async def telegram_webhook():
    if request.method != "POST":
        return jsonify({"status": "method not allowed"}), 405

    update = request.get_json()
    if not update:
        print("Received empty update.")
        return jsonify({"status": "error", "message": "Empty update"}), 400

    try:
        if not pyro_client.is_connected:
            await pyro_client.start()
        await pyro_client.process_update(update)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error processing update: {e}")
        return jsonify({"status": "error", "message": str(e)}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Flask app on port {port}...")
    app.run(host="0.0.0.0", port=port)
