
import os
import asyncio
import requests
from flask import Flask, request, jsonify, abort

# Initialize Flask app
app = Flask(__name__)

# Import Pyrogram client and BOT_TOKEN after Flask app is initialized
from main import pyro_client, BOT_TOKEN

TELEGRAM_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"
WEBHOOK_PATH = f"/{BOT_TOKEN}"  # Must match route below


@app.route('/')
def hello_world():
    return 'Bot Is Up', 200


@app.route('/setwebhook', methods=['GET'])
def set_webhook():
    public_url = os.getenv("PUBLIC_URL")
    if not public_url:
        return jsonify({
            "status": "error",
            "message": "PUBLIC_URL environment variable not set"
        }), 500

    webhook_url = f"{public_url}{WEBHOOK_PATH}"

    # Optional: Get current webhook info
    response = requests.get(f"{TELEGRAM_API_URL}/getWebhookInfo")
    current_info = response.json()
    print("Current webhook info:", current_info)

    # Set new webhook
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
        abort(400)

    try:
        await pyro_client.process_update(update)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error processing update: {e}")
        return jsonify({"status": "error", "message": str(e)}), 200


# --- OPTIONAL: Run auto webhook setup only when running locally ---
# On Gunicorn, this block will NOT execute
if __name__ == "__main__":
    import uvloop
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Flask app on port {port}...")
    app.run(host="0.0.0.0", port=port)
