"""
app.py — Supplement Tracker, rebuilt with dark/lavender UI, mobile-first bottom nav.
"""

import streamlit as st
import streamlit.components.v1 as components
import extra_streamlit_components as stx
import pandas as pd
from datetime import date, datetime
from auth import (
    is_logged_in, handle_magic_link_token, show_login_screen, logout,
    attach_cookie_manager,
)
from sheets import (
    get_supplements, get_log, log_supplement, already_logged_today,
    add_supplement, update_supplement_active, delete_supplement,
    get_ai_summary, edit_supplement,
)

st.set_page_config(page_title="💊 Supplements", page_icon="💊",
                   layout="centered", initial_sidebar_state="collapsed")

st.markdown("""
<style>
html,body,[data-testid="stAppViewContainer"],[data-testid="stMain"]{background-color:#0f0f14!important;color:#e8e6f0!important;}
[data-testid="stHeader"]{background:#0f0f14!important;}
.block-container{padding:1rem 1rem 6rem!important;max-width:480px!important;margin:auto;}
h1{font-size:1.4rem!important;color:#e8e6f0!important;font-weight:500!important;}
h2,h3{color:#e8e6f0!important;font-weight:500!important;}
p,label,.stMarkdown{color:#e8e6f0!important;}

/* Primary buttons — purple */
[data-testid="baseButton-primary"]{background:#6b5fa0!important;color:#fff!important;border:none!important;border-radius:10px!important;font-weight:500!important;}
[data-testid="baseButton-primary"]:hover{background:#7c6eb5!important;}

/* Secondary buttons — muted, for inactive nav tabs and minor actions */
[data-testid="baseButton-secondary"]{background:#1a1a24!important;color:#8b89a0!important;border:1px solid rgba(155,142,196,0.25)!important;border-radius:10px!important;font-weight:400!important;}
[data-testid="baseButton-secondary"]:hover{background:#22222f!important;color:#c4b8f0!important;}

input,textarea,[data-baseweb="input"] input,[data-baseweb="select"] div,[data-baseweb="textarea"] textarea{background:#1a1a24!important;color:#e8e6f0!important;border-color:rgba(155,142,196,0.3)!important;border-radius:8px!important;}
[data-testid="stMetric"]{background:#1a1a24;border-radius:12px;border:0.5px solid rgba(155,142,196,0.2);padding:10px 12px!important;text-align:center;}
[data-testid="stMetricLabel"]{color:#8b89a0!important;font-size:0.7rem!important;}
[data-testid="stMetricValue"]{color:#e8e6f0!important;font-size:1.5rem!important;}
[data-testid="stExpander"]{background:#1a1a24!important;border:0.5px solid rgba(155,142,196,0.2)!important;border-radius:12px!important;}
[data-testid="stRadio"] label{color:#e8e6f0!important;}
hr{border-color:rgba(155,142,196,0.15)!important;}
.supp-card{background:#1a1a24;border-radius:14px;border:0.5px solid rgba(155,142,196,0.2);padding:12px 14px;margin-bottom:8px;}
.supp-card.due{border-left:3px solid #fbbf24;}
.supp-card.done{border-left:3px solid #4ade80;opacity:0.65;}
.ai-banner{background:#1e1830;border:0.5px solid #6b5fa0;border-radius:12px;padding:12px 14px;margin-bottom:12px;}
.ai-label{font-size:9px;color:#9b8ec4;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:5px;}
.bar-track{background:#22222f;border-radius:4px;height:7px;flex:1;overflow:hidden;}
.section-lbl{font-size:10px;color:#8b89a0;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin:12px 0 6px;}

/* Hide Streamlit branding */
[data-testid="stToolbar"]{display:none!important;}
footer{visibility:hidden!important;}

/* Keep columns side-by-side on mobile (Streamlit stacks them by default <640px).
   This makes the bottom nav, Manage action buttons, and metric cards stay inline. */
[data-testid="stHorizontalBlock"]{flex-wrap:nowrap!important;gap:0.4rem!important;}
[data-testid="column"]{min-width:0!important;}
[data-testid="column"] [data-testid="baseButton-secondary"],
[data-testid="column"] [data-testid="baseButton-primary"]{padding-left:0!important;padding-right:0!important;}

</style>
""", unsafe_allow_html=True)

# Build exactly ONE CookieManager per run and share it with auth.py.
# (Constructing it more than once per run raises DuplicateWidgetID.)
attach_cookie_manager(stx.CookieManager(key="supp_cookie_mgr"))

handle_magic_link_token()
if not is_logged_in():
    show_login_screen()
    st.stop()

if "page" not in st.session_state:
    st.session_state.page = "today"
if "editing_id" not in st.session_state:
    st.session_state.editing_id = None
if "close_sidebar" not in st.session_state:
    st.session_state.close_sidebar = False

with st.sidebar:
    st.markdown("### Navigate")
    if st.button("🏠 Today",  use_container_width=True):
        st.session_state.page = "today";  st.session_state.close_sidebar = True; st.rerun()
    if st.button("💊 Manage", use_container_width=True):
        st.session_state.page = "manage"; st.session_state.close_sidebar = True; st.rerun()
    if st.button("📊 Trends", use_container_width=True):
        st.session_state.page = "trends"; st.session_state.close_sidebar = True; st.rerun()
    st.markdown("---")
    if st.button("🚪 Logout", use_container_width=True):
        logout()  # clears the cookie and reloads the page via JS

if st.session_state.close_sidebar:
    st.session_state.close_sidebar = False
    components.html("""<script>
        var btn = window.parent.document.querySelector('[data-testid="collapsedControl"]');
        if (btn) btn.click();
    </script>""", height=0)


def nav_bar(active):
    """Actual Streamlit buttons fixed to the bottom of the viewport via JS."""
    c1, c2, c3 = st.columns(3)
    items = [("🏠", "Today", "today"), ("💊", "Manage", "manage"), ("📊", "Trends", "trends")]
    for col, (icon, label, page) in zip([c1, c2, c3], items):
        with col:
            if st.button(
                f"{icon}  {label}",
                key=f"nav_{page}",
                use_container_width=True,
                type="primary" if active == page else "secondary",
            ):
                st.session_state.page = page
                st.rerun()

    # JS: grab the last horizontal block (always our nav columns) and pin it to bottom
    components.html("""<script>
    (function() {
        function fixNav() {
            var doc = window.parent.document;
            var blocks = doc.querySelectorAll('[data-testid="stHorizontalBlock"]');
            if (!blocks.length) { setTimeout(fixNav, 100); return; }
            var nav = blocks[blocks.length - 1];
            var s = nav.style;
            s.position   = 'fixed';
            s.bottom     = '0';
            s.left       = '0';
            s.right      = '0';
            s.width      = '100%';
            s.maxWidth   = 'none';
            s.background = '#1a1a24';
            s.borderTop  = '0.5px solid rgba(155,142,196,0.2)';
            s.zIndex     = '9999';
            s.padding    = '6px 12px 10px';
            s.boxSizing  = 'border-box';
            s.margin     = '0';
        }
        setTimeout(fixNav, 150);
    })();
    </script>""", height=0)


FREQ_DAYS  = {"Daily":1,"Every 2 Days":2,"Every 3 Days":3,"Weekly":7,"Twice Weekly":3,"Monthly":30}
TIME_ORDER = {"Morning":0,"Afternoon":1,"Evening":2,"Anytime":3,"":4}
CATEGORIES = ["Vitamin","Mineral","Supplement","Adaptogen","Performance","Gut Health","Herb","Other"]
UNITS      = ["mg","mcg","IU","g","ml","B CFU","other"]
TOD_OPTS   = ["Morning","Afternoon","Evening","Anytime"]

def is_due(name, frequency, log_df):
    if log_df.empty: return True
    taken = log_df[(log_df["supplement_name"]==name)&(log_df["taken"]==True)]
    if taken.empty: return True
    last = pd.to_datetime(taken["date"]).max().date()
    return (date.today()-last).days >= FREQ_DAYS.get(frequency,1)

def compute_streak(name, log_df, frequency):
    if log_df.empty or "supplement_name" not in log_df.columns: return 0
    taken = log_df[(log_df["supplement_name"]==name)&(log_df["taken"]==True)]
    if taken.empty: return 0
    interval = FREQ_DAYS.get(frequency,1)
    dates = sorted(taken["date"].unique(), reverse=True)
    streak, check = 0, date.today()
    for d in dates:
        if (check-d).days <= interval: streak+=1; check=d
        else: break
    return streak

def streak_label(n):
    if n==0: return "no streak"
    if n>=30: return f"🔥🔥 {n}d"
    if n>=7:  return f"🔥 {n}d"
    return f"✨ {n}d"

def compliance_color(pct):
    if pct>=85: return "#4ade80"
    if pct>=60: return "#c4b8f0"
    if pct>=40: return "#fbbf24"
    return "#f87171"

def safe_index(lst, val, default=0):
    return lst.index(val) if val in lst else default


# ══════════════════════════════════════════════════════════════════
# TODAY
# ══════════════════════════════════════════════════════════════════
if st.session_state.page == "today":
    st.markdown(f"### 💊 {date.today().strftime('%A, %d %b')}")

    supplements = get_supplements()
    log_30      = get_log(30)

    if supplements.empty:
        st.info("No supplements yet. Head to Manage to add some.")
    else:
        active = supplements[supplements["active"]==True].copy()
        active["_tod"] = active.get("time_of_day", pd.Series(["Anytime"]*len(active))).map(TIME_ORDER).fillna(4)
        active = active.sort_values("_tod")

        due_list, done_list, not_due_list = [], [], []
        for _, s in active.iterrows():
            if already_logged_today(str(s["id"])): done_list.append(s)
            elif is_due(s["name"], s["frequency"], log_30): due_list.append(s)
            else: not_due_list.append(s)

        ai = get_ai_summary()
        if ai and ai.get("short"):
            st.markdown(f'<div class="ai-banner"><div class="ai-label">✨ AI insight</div>'
                        f'<div style="font-size:13px;color:#e8e6f0;line-height:1.55;">{ai["short"]}</div></div>',
                        unsafe_allow_html=True)

        c1,c2,c3 = st.columns(3)
        c1.metric("⚠️ Due",    len(due_list))
        c2.metric("✅ Taken",  len(done_list))
        c3.metric("💊 Active", len(active))

        if due_list:
            st.markdown('<div class="section-lbl">Due now</div>', unsafe_allow_html=True)
            for s in due_list:
                streak = compute_streak(s["name"], log_30, s["frequency"])
                tod    = s.get("time_of_day","")
                st.markdown(f"""
                <div class="supp-card due">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                      <div style="font-size:14px;font-weight:500;color:#e8e6f0;">{s['name']}</div>
                      <div style="font-size:11px;color:#8b89a0;margin-top:2px;">{s['dosage']} {s['unit']} · {tod or s['frequency']} · {s.get('best_taken_with','')}</div>
                    </div>
                    <div style="font-size:11px;color:#c4b8f0;white-space:nowrap;">{streak_label(streak)}</div>
                  </div>
                </div>""", unsafe_allow_html=True)
                ct, cb = st.columns([1,1])
                with ct:
                    time_val = st.time_input("t", value=None, key=f"time_{s['id']}", label_visibility="collapsed")
                with cb:
                    if st.button("✅ Mark taken", key=f"take_{s['id']}", use_container_width=True, type="primary"):
                        t_str = str(time_val) if time_val else datetime.now().strftime("%H:%M")
                        log_supplement(str(s["id"]), s["name"], taken=True, time_taken=t_str)
                        st.rerun()

        if done_list:
            st.markdown('<div class="section-lbl">Taken today</div>', unsafe_allow_html=True)
            for s in done_list:
                te = log_30[(log_30["supplement_name"]==s["name"])&(log_30["date"]==date.today())&(log_30["taken"]==True)]
                t_str = f" at {te.iloc[-1]['time_taken']}" if not te.empty and te.iloc[-1].get("time_taken") else ""
                st.markdown(f"""<div class="supp-card done">
                  <div style="display:flex;justify-content:space-between;">
                    <div style="font-size:13px;font-weight:500;color:#e8e6f0;">✅ {s['name']}</div>
                    <div style="font-size:11px;color:#4ade80;">{t_str}</div>
                  </div>
                  <div style="font-size:11px;color:#8b89a0;">{s['dosage']} {s['unit']}</div>
                </div>""", unsafe_allow_html=True)

        if not_due_list:
            with st.expander(f"🕐 Not due yet ({len(not_due_list)})"):
                for s in not_due_list:
                    st.markdown(f"- **{s['name']}** · {s['frequency']}")

        if not due_list and not done_list:
            st.success("🎉 Nothing due right now. You are on top of it!")

    nav_bar("today")


# ══════════════════════════════════════════════════════════════════
# MANAGE
# ══════════════════════════════════════════════════════════════════
elif st.session_state.page == "manage":
    st.markdown("### 💊 Manage Supplements")
    supplements = get_supplements()
    active_df = supplements[supplements["active"]==True]  if not supplements.empty else pd.DataFrame()
    paused_df = supplements[supplements["active"]==False] if not supplements.empty else pd.DataFrame()
    st.markdown(f"<div style='color:#8b89a0;font-size:12px;margin-bottom:12px;'>{len(active_df)} active · {len(paused_df)} paused</div>", unsafe_allow_html=True)

    with st.expander("➕ Add supplement", expanded=False):
        with st.form("add_form", clear_on_submit=True):
            name = st.text_input("Name *")
            c1,c2 = st.columns(2)
            cat  = c1.selectbox("Category", CATEGORIES)
            freq = c2.selectbox("Frequency", list(FREQ_DAYS.keys()))
            c3,c4 = st.columns(2)
            dose = c3.number_input("Dosage *", min_value=0.0, step=0.5)
            unit = c4.selectbox("Unit", UNITS)
            c5,c6 = st.columns(2)
            tod  = c5.selectbox("Time of day", TOD_OPTS)
            tpd  = c6.number_input("Times/day", min_value=1, max_value=6, value=1)
            bw   = st.text_input("Best taken with")
            notes= st.text_area("Notes", height=68)
            if st.form_submit_button("Add", type="primary", use_container_width=True):
                if not name or dose==0:
                    st.error("Name and dosage required.")
                else:
                    add_supplement(name, cat, dose, unit, freq, tpd, bw, notes, tod)
                    st.success(f"✅ {name} added!")
                    st.rerun()

    if st.session_state.editing_id and not supplements.empty:
        row = supplements[supplements["id"].astype(str)==str(st.session_state.editing_id)]
        if not row.empty:
            s = row.iloc[0]
            with st.expander(f"✏️ Editing: {s['name']}", expanded=True):
                with st.form("edit_form"):
                    name_e = st.text_input("Name", value=s["name"])
                    c1,c2  = st.columns(2)
                    cat_e  = c1.selectbox("Category", CATEGORIES, index=safe_index(CATEGORIES, s["category"]))
                    freq_e = c2.selectbox("Frequency", list(FREQ_DAYS.keys()), index=safe_index(list(FREQ_DAYS.keys()), s["frequency"]))
                    c3,c4  = st.columns(2)
                    dose_e = c3.number_input("Dosage", value=float(s["dosage"]), min_value=0.0, step=0.5)
                    unit_e = c4.selectbox("Unit", UNITS, index=safe_index(UNITS, s["unit"]))
                    tod_e  = st.selectbox("Time of day", TOD_OPTS, index=safe_index(TOD_OPTS, s.get("time_of_day","Anytime")))
                    bw_e   = st.text_input("Best taken with", value=s.get("best_taken_with",""))
                    notes_e= st.text_area("Notes", value=s.get("notes",""), height=68)
                    cs,cc  = st.columns(2)
                    if cs.form_submit_button("💾 Save", type="primary", use_container_width=True):
                        edit_supplement(str(st.session_state.editing_id), name_e, cat_e, dose_e, unit_e, freq_e, 1, bw_e, notes_e, tod_e)
                        st.session_state.editing_id = None
                        st.rerun()
                    if cc.form_submit_button("Cancel", use_container_width=True):
                        st.session_state.editing_id = None
                        st.rerun()

    if not active_df.empty:
        st.markdown('<div class="section-lbl">Active</div>', unsafe_allow_html=True)
        for _, s in active_df.iterrows():
            # Info column + 3 action buttons side by side
            col_info, col_actions = st.columns([4, 3])
            with col_info:
                st.markdown(
                    f"<div style='font-size:13px;font-weight:500;color:#e8e6f0;padding-top:4px;'>{s['name']}</div>"
                    f"<div style='font-size:11px;color:#8b89a0;'>{s['dosage']} {s['unit']} · {s.get('time_of_day','')}</div>",
                    unsafe_allow_html=True
                )
            with col_actions:
                b1, b2, b3 = st.columns(3)
                with b1:
                    if st.button("✏️", key=f"edit_{s['id']}", use_container_width=True):
                        st.session_state.editing_id = str(s["id"]); st.rerun()
                with b2:
                    if st.button("⏸", key=f"pause_{s['id']}", use_container_width=True):
                        update_supplement_active(str(s["id"]), False); st.rerun()
                with b3:
                    if st.button("🗑️", key=f"del_{s['id']}", use_container_width=True):
                        delete_supplement(str(s["id"])); st.rerun()
            st.divider()

    if not paused_df.empty:
        with st.expander(f"⏸ Paused ({len(paused_df)})"):
            for _, s in paused_df.iterrows():
                col_info, col_actions = st.columns([4, 2])
                with col_info:
                    st.markdown(
                        f"<div style='font-size:13px;color:#8b89a0;padding-top:4px;'>{s['name']} · {s['dosage']} {s['unit']}</div>",
                        unsafe_allow_html=True
                    )
                with col_actions:
                    b1, b2 = st.columns(2)
                    with b1:
                        if st.button("▶️", key=f"res_{s['id']}", use_container_width=True):
                            update_supplement_active(str(s["id"]), True); st.rerun()
                    with b2:
                        if st.button("🗑️", key=f"delp_{s['id']}", use_container_width=True):
                            delete_supplement(str(s["id"])); st.rerun()

    nav_bar("manage")


# ══════════════════════════════════════════════════════════════════
# TRENDS
# ══════════════════════════════════════════════════════════════════
elif st.session_state.page == "trends":
    st.markdown("### 📊 Trends")
    st.markdown("<div style='color:#8b89a0;font-size:12px;margin-bottom:12px;'>Last 30 days</div>", unsafe_allow_html=True)

    log         = get_log(30)
    supplements = get_supplements()

    if log.empty:
        st.info("No log data yet. Start from the Today tab.")
    else:
        active_supp  = supplements[supplements["active"]==True]
        active_names = active_supp["name"].tolist()
        freq_map     = dict(zip(active_supp["name"], active_supp["frequency"]))

        st.markdown("#### 30-day compliance")
        compliance = []
        for name in active_names:
            sl    = log[log["supplement_name"]==name]
            taken = int(sl["taken"].sum())
            total = len(sl)
            pct   = round(taken/total*100,1) if total>0 else 0.0
            compliance.append({"name":name,"pct":pct})
        compliance.sort(key=lambda x:-x["pct"])

        for row in compliance:
            color = compliance_color(row["pct"])
            st.markdown(f"""
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
              <div style="font-size:12px;color:#e8e6f0;width:100px;flex-shrink:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{row['name']}</div>
              <div class="bar-track"><div style="width:{int(row['pct'])}%;height:100%;background:{color};border-radius:4px;"></div></div>
              <div style="font-size:11px;color:#8b89a0;width:36px;text-align:right;">{row['pct']}%</div>
            </div>""", unsafe_allow_html=True)

        st.markdown("<div style='font-size:10px;color:#8b89a0;margin-bottom:12px;'>🟢 85%+  🟣 60-84%  🟡 40-59%  🔴 below 40%</div>", unsafe_allow_html=True)

        st.markdown("#### Streaks")
        streaks = sorted(
            [(n, compute_streak(n, log, freq_map.get(n,"Daily"))) for n in active_names],
            key=lambda x:-x[1]
        )
        for name, n in streaks:
            lbl   = streak_label(n) if n>0 else "❌ no streak"
            color = "#4ade80" if n>=7 else ("#c4b8f0" if n>=3 else "#8b89a0")
            st.markdown(f"""
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:7px 0;border-bottom:0.5px solid rgba(155,142,196,0.12);">
              <span style="font-size:13px;color:#e8e6f0;">{name}</span>
              <span style="font-size:12px;color:{color};">{lbl}</span>
            </div>""", unsafe_allow_html=True)

        st.markdown("#### AI summary")
        ai = get_ai_summary()
        if ai and ai.get("long"):
            st.markdown(f"""<div class="ai-banner" style="margin-top:8px;">
              <div class="ai-label">Last updated {ai.get('updated_at','')}</div>
              <div style="font-size:13px;color:#e8e6f0;line-height:1.6;">{ai['long']}</div>
            </div>""", unsafe_allow_html=True)
        else:
            st.info("AI summary appears here after your first daily digest is sent via Telegram.")

        with st.expander("📜 Raw log"):
            disp = log[["date","supplement_name","taken","time_taken"]].copy()
            disp["taken"] = disp["taken"].map({True:"✅",False:"❌"})
            st.dataframe(disp.sort_values("date",ascending=False), use_container_width=True, hide_index=True)

    nav_bar("trends")
