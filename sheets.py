"""
sheets.py — all read/write interactions with Google Sheets.
Data is loaded once per session into st.session_state to avoid API rate limits.
"""

import gspread
import streamlit as st
from google.oauth2.service_account import Credentials
import pandas as pd
from datetime import date, datetime
import uuid

SCOPES   = ["https://www.googleapis.com/auth/spreadsheets"]
SHEET_ID = "1Q0E7ByJMQpSmGj9CJ3f5bSHbbcxExxp-PH_3GobpkrU"


@st.cache_resource
def get_client():
    """Authenticate once, cache forever."""
    creds = Credentials.from_service_account_info(
        st.secrets["gcp_service_account"], scopes=SCOPES
    )
    return gspread.authorize(creds)


def get_sheet():
    return get_client().open_by_key(SHEET_ID)


# ── One-shot loader ───────────────────────────────────────────────────────────

def _load_all_data():
    """Read supplements + log from Sheets in one batch. Called once per session."""
    sheet = get_sheet()

    # Supplements
    ws_s   = sheet.worksheet("supplements")
    s_data = ws_s.get_all_records()
    df_s   = pd.DataFrame(s_data) if s_data else pd.DataFrame()
    if not df_s.empty:
        df_s["active"] = df_s["active"].astype(str).str.upper() == "TRUE"
        if "time_of_day" not in df_s.columns:
            df_s["time_of_day"] = "Anytime"

    # Log (last 30 days)
    ws_l   = sheet.worksheet("log")
    l_data = ws_l.get_all_records()
    df_l   = pd.DataFrame(l_data) if l_data else pd.DataFrame()
    if not df_l.empty:
        df_l["date"]  = pd.to_datetime(df_l["date"]).dt.date
        cutoff = pd.Timestamp.today().date() - pd.Timedelta(days=30)
        df_l   = df_l[df_l["date"] >= cutoff].reset_index(drop=True)
        df_l["taken"] = df_l["taken"].astype(str).str.upper() == "TRUE"

    # AI summary (stored in a single-cell named range or a settings tab)
    ai_summary = _load_ai_summary_from_sheet(sheet)

    st.session_state._supplements  = df_s
    st.session_state._log          = df_l
    st.session_state._ai_summary   = ai_summary
    st.session_state._data_loaded  = True


def _load_ai_summary_from_sheet(sheet):
    """Load AI summary from the ai_summary tab. Returns dict or None."""
    try:
        ws  = sheet.worksheet("ai_summary")
        rows = ws.get_all_records()
        if rows:
            r = rows[-1]  # latest entry
            return {
                "short":      r.get("short", ""),
                "long":       r.get("long", ""),
                "updated_at": r.get("updated_at", ""),
            }
    except gspread.WorksheetNotFound:
        # Create the tab silently so it's ready later
        sheet.add_worksheet(title="ai_summary", rows=50, cols=4)
        sheet.worksheet("ai_summary").append_row(
            ["short", "long", "updated_at", "date"], value_input_option="RAW"
        )
    return None


def _ensure_loaded():
    if not st.session_state.get("_data_loaded", False):
        _load_all_data()


def invalidate_cache():
    st.session_state._data_loaded = False


# ── Supplements ───────────────────────────────────────────────────────────────

def get_supplements() -> pd.DataFrame:
    _ensure_loaded()
    return st.session_state._supplements.copy()


def add_supplement(name, category, dosage, unit, frequency,
                   times_per_day, best_taken_with, notes, time_of_day="Anytime"):
    _ensure_loaded()
    df     = st.session_state._supplements
    new_id = str(int(df["id"].max()) + 1) if not df.empty and "id" in df.columns else "1"

    get_sheet().worksheet("supplements").append_row([
        new_id, name, category, str(dosage), unit,
        frequency, str(times_per_day), best_taken_with, notes, "TRUE", time_of_day
    ], value_input_option="RAW")

    new_row = {
        "id": new_id, "name": name, "category": category,
        "dosage": str(dosage), "unit": unit, "frequency": frequency,
        "times_per_day": str(times_per_day), "best_taken_with": best_taken_with,
        "notes": notes, "active": True, "time_of_day": time_of_day,
    }
    st.session_state._supplements = pd.concat(
        [df, pd.DataFrame([new_row])], ignore_index=True
    )


def edit_supplement(supplement_id, name, category, dosage, unit,
                    frequency, times_per_day, best_taken_with, notes, time_of_day):
    """Update every field of an existing supplement row."""
    ws      = get_sheet().worksheet("supplements")
    records = ws.get_all_records()
    for i, row in enumerate(records, start=2):
        if str(row["id"]) == str(supplement_id):
            ws.update(f"B{i}:K{i}", [[
                name, category, str(dosage), unit,
                frequency, str(times_per_day), best_taken_with, notes,
                "TRUE", time_of_day
            ]])
            break
    # Update cache
    df   = st.session_state._supplements
    mask = df["id"].astype(str) == str(supplement_id)
    df.loc[mask, "name"]           = name
    df.loc[mask, "category"]       = category
    df.loc[mask, "dosage"]         = str(dosage)
    df.loc[mask, "unit"]           = unit
    df.loc[mask, "frequency"]      = frequency
    df.loc[mask, "times_per_day"]  = str(times_per_day)
    df.loc[mask, "best_taken_with"]= best_taken_with
    df.loc[mask, "notes"]          = notes
    df.loc[mask, "time_of_day"]    = time_of_day
    st.session_state._supplements  = df


def update_supplement_active(supplement_id: str, active: bool):
    ws      = get_sheet().worksheet("supplements")
    records = ws.get_all_records()
    for i, row in enumerate(records, start=2):
        if str(row["id"]) == str(supplement_id):
            ws.update_cell(i, 10, "TRUE" if active else "FALSE")
            break
    mask = st.session_state._supplements["id"].astype(str) == str(supplement_id)
    st.session_state._supplements.loc[mask, "active"] = active


def delete_supplement(supplement_id: str):
    ws      = get_sheet().worksheet("supplements")
    records = ws.get_all_records()
    for i, row in enumerate(records, start=2):
        if str(row["id"]) == str(supplement_id):
            ws.delete_rows(i)
            break
    mask = st.session_state._supplements["id"].astype(str) != str(supplement_id)
    st.session_state._supplements = st.session_state._supplements[mask].reset_index(drop=True)


# ── Log ───────────────────────────────────────────────────────────────────────

def get_log(days: int = 30) -> pd.DataFrame:
    _ensure_loaded()
    df = st.session_state._log.copy()
    if df.empty:
        return df
    cutoff = pd.Timestamp.today().date() - pd.Timedelta(days=days)
    return df[df["date"] >= cutoff].reset_index(drop=True)


def get_todays_log() -> pd.DataFrame:
    _ensure_loaded()
    df = st.session_state._log
    if df.empty:
        return df
    return df[df["date"] == date.today()].reset_index(drop=True)


def log_supplement(supplement_id: str, supplement_name: str,
                   taken: bool, time_taken: str = "", notes: str = ""):
    _ensure_loaded()
    df     = st.session_state._log
    new_id = str(int(df["id"].max()) + 1) if not df.empty and "id" in df.columns else "1"

    get_sheet().worksheet("log").append_row([
        new_id, str(date.today()), str(supplement_id),
        supplement_name, "TRUE" if taken else "FALSE",
        time_taken, notes,
    ], value_input_option="RAW")

    new_row = {
        "id": new_id, "date": date.today(),
        "supplement_id": str(supplement_id),
        "supplement_name": supplement_name,
        "taken": taken, "time_taken": time_taken, "notes": notes,
    }
    st.session_state._log = pd.concat(
        [df, pd.DataFrame([new_row])], ignore_index=True
    )


def already_logged_today(supplement_id: str) -> bool:
    """Pure cache check — no Sheet read."""
    _ensure_loaded()
    df = st.session_state._log
    if df.empty:
        return False
    today = df[df["date"] == date.today()]
    taken = today[today["taken"] == True]
    return str(supplement_id) in taken["supplement_id"].astype(str).values


# ── AI summary ────────────────────────────────────────────────────────────────

def get_ai_summary() -> dict | None:
    """Return cached AI summary dict {short, long, updated_at} or None."""
    _ensure_loaded()
    return st.session_state.get("_ai_summary")


def save_ai_summary(short: str, long: str):
    """
    Called by the Apps Script digest (or manually). Writes to ai_summary tab
    and updates the in-memory cache.
    """
    now = datetime.now().strftime("%d %b, %H:%M")
    try:
        ws = get_sheet().worksheet("ai_summary")
    except gspread.WorksheetNotFound:
        ws = get_sheet().add_worksheet(title="ai_summary", rows=50, cols=4)
        ws.append_row(["short","long","updated_at","date"], value_input_option="RAW")

    ws.append_row([short, long, now, str(date.today())], value_input_option="RAW")

    st.session_state._ai_summary = {
        "short": short, "long": long, "updated_at": now,
    }


# ── Auth tokens ───────────────────────────────────────────────────────────────

def create_auth_token() -> str:
    token   = str(uuid.uuid4())
    now     = datetime.utcnow()
    expires = now + pd.Timedelta(minutes=10)
    get_sheet().worksheet("auth_tokens").append_row([
        token, now.isoformat(), expires.isoformat(), "FALSE"
    ], value_input_option="RAW")
    return token


def validate_and_consume_token(token: str) -> bool:
    ws      = get_sheet().worksheet("auth_tokens")
    records = ws.get_all_records()
    for i, row in enumerate(records, start=2):
        if row["token"] == token and str(row["used"]).upper() == "FALSE":
            expires = datetime.fromisoformat(row["expires_at"])
            if datetime.utcnow() <= expires:
                ws.update_cell(i, 4, "TRUE")
                return True
    return False
