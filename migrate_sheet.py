"""
Run once to migrate your Sheet:
1. Adds 'time_of_day' column to supplements tab
2. Creates ai_summary tab

Usage: python migrate_sheet.py
"""

import gspread
from google.oauth2.service_account import Credentials

KEY_FILE = r"path\to\your\supplement-bot-key.json"  # ← change this
SHEET_ID = "1Q0E7ByJMQpSmGj9CJ3f5bSHbbcxExxp-PH_3GobpkrU"
SCOPES   = ["https://www.googleapis.com/auth/spreadsheets"]

creds  = Credentials.from_service_account_file(KEY_FILE, scopes=SCOPES)
client = gspread.authorize(creds)
sheet  = client.open_by_key(SHEET_ID)

# ── 1. Add time_of_day column to supplements ──────────────────────────────────
ws   = sheet.worksheet("supplements")
hdrs = ws.row_values(1)

if "time_of_day" not in hdrs:
    col = len(hdrs) + 1
    ws.update_cell(1, col, "time_of_day")
    # Fill existing rows with "Anytime"
    all_rows = ws.get_all_values()
    for i in range(2, len(all_rows) + 1):
        ws.update_cell(i, col, "Anytime")
    print(f"✅ Added 'time_of_day' column at position {col}")
else:
    print("✅ 'time_of_day' column already exists")

# ── 2. Create ai_summary tab ──────────────────────────────────────────────────
try:
    sheet.worksheet("ai_summary")
    print("✅ 'ai_summary' tab already exists")
except gspread.WorksheetNotFound:
    ws2 = sheet.add_worksheet(title="ai_summary", rows=50, cols=4)
    ws2.append_row(["short", "long", "updated_at", "date"], value_input_option="RAW")
    print("✅ Created 'ai_summary' tab")

print("\n🎉 Migration complete!")
