# app.py

import os
import asyncio
from flask import Flask, request, jsonify, abort # Import Flask components

# Import the Pyrogram client and BOT_TOKEN from main.py
# This allows app.py to access the initialized Pyrogram client and its handlers.
from main import pyro_client, BOT_TOKEN 

# --- Flask App Initialization ---
app = Flask(__name__) # Initialize Flask app

# --- Flask Routes ---

@app.route('/')
def hello_world():
    """Simple health check endpoint."""
    return 'Bot Is Up', 200

@app.route(f"/{BOT_TOKEN}", methods=["POST"])
async def telegram_webhook():
    """
    This endpoint receives updates from Telegram's Bot API.
    """
    if request.method == "POST":
        update = request.get_json()
        if not update:
            print("Received empty update.")
            abort(400)
            await pyro_client.start()

        # Pass the update to Pyrogram to process
        try:
            await pyro_client.process_update(update)
            return jsonify({"status": "ok"}), 200 # Acknowledge success immediately
        except Exception as e:
            print(f"Error processing update: {e}")
            # It's crucial to return a 200 OK to Telegram even on internal errors
            # to prevent Telegram from re-sending the update repeatedly.
            return jsonify({"status": "error", "message": str(e)}), 200 

    return jsonify({"status": "method not allowed"}), 405

# --- Startup Logic for Local Development (Optional) ---
# This block is primarily for running Flask locally using `python app.py`.
# When deploying with Gunicorn (via Procfile), Gunicorn will import and run `app` directly,
# so this block will not be executed.
if __name__ == "__main__": 
    port = int(os.environ.get("PORT", 5000))
    print(f"Flask app starting on port {port}...")
    app.run(host="0.0.0.0", port=port)

