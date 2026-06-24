"""
auth.py — authentication via Streamlit's native Google OIDC (st.login / st.user).

This is a private, single-user app: exactly ONE Google account is allowed in.
The session is stored by Streamlit in a signed cookie (cookie_secret in
secrets.toml [auth]) and persists across browser restarts until st.logout().

Requires Streamlit >= 1.42 and Authlib, plus an [auth] block in secrets.toml
(see the plan / README for the Google Cloud OAuth setup).
"""

import streamlit as st

# The only account permitted to use the app. Anyone else is denied.
ALLOWED_EMAIL = "darshan.ambule.da@gmail.com"


def require_login():
    """Gate the whole app. Call once at the top of app.py.

    Stops the script (showing the login screen or an access-denied notice)
    unless the visitor is signed in as ALLOWED_EMAIL.
    """
    if not st.user.is_logged_in:
        show_login_screen()
        st.stop()

    email = (st.user.email or "").lower()
    if email != ALLOWED_EMAIL.lower():
        st.error("🚫 Access denied. This is a private app.")
        st.caption(f"Signed in as {st.user.email}, which is not authorised.")
        if st.button("Sign out", use_container_width=True):
            st.logout()
        st.stop()


def show_login_screen():
    st.markdown("""
        <div style='text-align:center; padding: 60px 20px 20px;'>
            <h1>💊 Supplement Tracker</h1>
            <p style='color: gray; font-size: 16px;'>Your personal health assistant</p>
        </div>
    """, unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.info("This app is private. Sign in with your Google account to continue.")
        if st.button("🔐 Sign in with Google", use_container_width=True, type="primary"):
            st.login()
