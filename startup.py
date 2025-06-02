import os
import requests
from app import BOT_TOKEN

def auto_set_webhook():
    public_url = os.getenv("PUBLIC_URL")
    if not public_url:
        print("PUBLIC_URL not set. Skipping auto webhook setup.")
        return

    webhook_url = f"{public_url}/{BOT_TOKEN}"

    print("Setting webhook to:", webhook_url)

    response = requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook", 
        json={"url": webhook_url}
    )

    result = response.json()
    if result.get("ok"):
        print("✅ Webhook set successfully.")
    else:
        print("❌ Failed to set webhook:", result)
