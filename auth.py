"""
auth.py — session management and magic link authentication.
Session is stored in a browser cookie so it survives tab closes and refreshes.
"""

import streamlit as st
import extra_streamlit_components as stx
from datetime import datetime, timedelta, timezone
from sheets import create_auth_token, validate_and_consume_token
from telegram_bot import send_magic_link

SESSION_DURATION_DAYS = 30  # ← adjust this to change how long login lasts
COOKIE_KEY = "supp_auth"


def _cm():
    return stx.CookieManager()


def is_logged_in() -> bool:
    # Fast path: already verified this rerun
    if st.session_state.get("authenticated") and st.session_state.get("auth_expires"):
        if datetime.now(timezone.utc) <= st.session_state["auth_expires"]:
            return True

    # Slow path: check the browser cookie (survives tab close / refresh)
    try:
        val = _cm().get(COOKIE_KEY)
        if val:
            expires = datetime.fromisoformat(val)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) <= expires:
                st.session_state["authenticated"] = True
                st.session_state["auth_expires"] = expires
                return True
    except Exception:
        pass

    st.session_state["authenticated"] = False
    return False


def login():
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    st.session_state["authenticated"] = True
    st.session_state["auth_expires"] = expires
    _cm().set(COOKIE_KEY, expires.isoformat(), expires=expires)


def logout():
    st.session_state["authenticated"] = False
    st.session_state.pop("auth_expires", None)
    _cm().delete(COOKIE_KEY)


def handle_magic_link_token():
    params = st.query_params
    token = params.get("token", None)
    if token and not is_logged_in():
        if validate_and_consume_token(token):
            login()
            st.query_params.clear()
            st.rerun()
        else:
            st.error("❌ This login link has expired or already been used. Request a new one.")
            st.query_params.clear()


def show_login_screen():
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
