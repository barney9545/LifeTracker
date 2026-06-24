"""
telegram_bot.py — send messages via your Telegram bot.
"""

import requests
import streamlit as st


def send_message(text: str) -> bool:
    """Send a message to your personal Telegram chat. Returns True on success."""
    bot_token = st.secrets["telegram"]["bot_token"]
    chat_id   = st.secrets["telegram"]["chat_id"]

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        return resp.status_code == 200
    except Exception:
        return False


def send_magic_link(app_url: str, token: str) -> bool:
    """Send the login magic link to your Telegram."""
    link = f"{app_url}?token={token}"
    text = (
        "🔐 <b>Supplement Tracker Login</b>\n\n"
        f'Tap to log in (valid for 10 minutes):\n{link}\n\n'
        "<i>If you didn't request this, ignore it.</i>"
    )
    return send_message(text)
