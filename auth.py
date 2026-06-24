"""
auth.py — session management and magic link authentication.
"""

import streamlit as st
from datetime import datetime, timedelta
from sheets import create_auth_token, validate_and_consume_token
from telegram_bot import send_magic_link

SESSION_DURATION_DAYS = 30


def is_logged_in() -> bool:
    """Check if the current session is authenticated."""
    if "authenticated" not in st.session_state:
        st.session_state.authenticated = False
    if "auth_expires" not in st.session_state:
        return False
    if datetime.utcnow() > st.session_state.auth_expires:
        st.session_state.authenticated = False
        return False
    return st.session_state.authenticated


def login():
    """Mark the session as authenticated for SESSION_DURATION_DAYS."""
    st.session_state.authenticated = True
    st.session_state.auth_expires = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)


def logout():
    st.session_state.authenticated = False
    st.session_state.pop("auth_expires", None)


def handle_magic_link_token():
    """
    Called on every page load. If ?token=xxx is in the URL,
    validate it and log the user in.
    """
    params = st.query_params
    token = params.get("token", None)
    if token and not is_logged_in():
        if validate_and_consume_token(token):
            login()
            # Clean the token from the URL so it can't be replayed
            st.query_params.clear()
            st.rerun()
        else:
            st.error("❌ This login link has expired or already been used. Request a new one.")
            st.query_params.clear()


def show_login_screen():
    """Render the login page."""
    st.markdown("""
        <div style='text-align:center; padding: 60px 20px;'>
            <h1>💊 Supplement Tracker</h1>
            <p style='color: gray; font-size: 16px;'>Your personal health assistant</p>
        </div>
    """, unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.info("Login is done via Telegram — no password needed.\n\n"
                "Click below and you'll receive a one-tap login link in your Telegram.")

        app_url = st.secrets.get("app", {}).get("url", "http://localhost:8501")

        if st.button("📱 Send me a login link via Telegram", use_container_width=True, type="primary"):
            with st.spinner("Sending..."):
                token = create_auth_token()
                success = send_magic_link(app_url, token)
            if success:
                st.success("✅ Link sent! Check your Telegram and tap it to log in.")
            else:
                st.error("❌ Couldn't reach Telegram. Check your bot token and chat ID in secrets.")
