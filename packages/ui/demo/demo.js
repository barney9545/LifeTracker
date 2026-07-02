// Standalone demo entry. Imports the BUILT bundle (../dist/index.js) + uses
// React from the import map. No JSX (so no compile step) — h = createElement.
import React from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  SectionLabel,
  Chip,
  ProgressBar,
  CheckCircle,
  Avatar,
  SupplementCard,
  ProgressCard,
  ItemRow,
  MonthCalendar,
  CalendarDayCell,
  TabSwitch,
  BottomNav,
  HomeIcon,
  PillIcon,
  ChartIcon,
  complianceColor,
} from "../dist/index.js";

const h = React.createElement;
const { useState } = React;

function Group(props) {
  return h(
    "div",
    { style: { marginBottom: 20 } },
    h(SectionLabel, null, props.title),
    props.children,
  );
}

// Realistic sample data (matches the brief).
const supplements = [
  { name: "Vitamin D3", detail: "Vitamin D3 · 60000 IU", timeOfDay: "Morning", streak: "🔥 7d" },
  { name: "Omega-3", detail: "Omega-3 · 1000 mg", timeOfDay: "Afternoon" },
  { name: "Magnesium", detail: "Magnesium · 400 mg", timeOfDay: "Evening", streak: "✨ 3d" },
  { name: "Zinc", detail: "Zinc · 25 mg", timeOfDay: "Anytime" },
];

// A month with varied compliance colors across the scale.
const compliancePattern = [95, 88, 100, 72, 65, 45, 30, 82, 90, 60, 55, 38, 100, 91,
  84, 77, 42, 20, 68, 86, 93, 99, 51, 34, 70, 88, 96, 62, 47, 100, 90];
const monthDays = compliancePattern.map((c, i) => ({ day: i + 1, compliance: c }));

function App() {
  const [theme, setTheme] = useState("lavender");
  const [tab, setTab] = useState("today");
  const [nav, setNav] = useState("/");
  const [doneTime, setDoneTime] = useState("08:30");

  return h(
    "div",
    { className: `theme-${theme} ds-shell` },
    h(
      "div",
      { className: "demo-wrap" },

      // ── Column 1: primitives + brand cards ──────────────────────────────
      h(
        "div",
        { className: "ds-column", style: { background: "var(--c-bg)" } },
        h(
          "header",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 } },
          h(
            "div",
            null,
            h("p", { className: "demo-note" }, "Good morning"),
            h("h1", { className: "ds-heading" }, "@lifetracker/ui"),
          ),
          h(Avatar, { initials: "D" }),
        ),

        h(TabSwitch, {
          tabs: [
            { value: "today", label: "Today" },
            { value: "manage", label: "Manage" },
            { value: "trends", label: "Trends" },
          ],
          value: tab,
          onChange: setTab,
        }),

        h("div", { style: { height: 16 } }),

        h(
          Group,
          { title: "Theme" },
          h(TabSwitch, {
            tabs: [
              { value: "lavender", label: "Lavender" },
              { value: "green", label: "Green" },
            ],
            value: theme,
            onChange: setTheme,
          }),
        ),

        h(
          Group,
          { title: "Buttons" },
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            h(Button, { variant: "primary" }, "Primary"),
            h(Button, { variant: "secondary" }, "Secondary"),
            h(Button, { variant: "ghost" }, "Ghost"),
            h(Button, { variant: "primary", disabled: true }, "Disabled"),
          ),
        ),

        h(
          Group,
          { title: "Chips / Badges" },
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            h(Chip, { tone: "accent" }, "🔥 7d"),
            h(Chip, { tone: "done" }, "Done"),
            h(Chip, { tone: "due" }, "Due"),
            h(Chip, { tone: "danger" }, "Missed"),
            h(Chip, { tone: "muted" }, "Daily"),
          ),
        ),

        h(
          Group,
          { title: "Inputs" },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 10 } },
            h(Input, { label: "Name", defaultValue: "Vitamin D3" }),
            h(Select, {
              label: "Time of day",
              options: ["Morning", "Afternoon", "Evening", "Anytime"],
              defaultValue: "Morning",
            }),
            h(Textarea, { label: "Notes", defaultValue: "Take with a fatty meal.", rows: 2 }),
          ),
        ),

        h(
          Group,
          { title: "Progress bar / CheckCircle" },
          h(ProgressBar, { value: 72 }),
          h("div", { style: { height: 10 } }),
          h(
            "div",
            { style: { display: "flex", gap: 12, alignItems: "center" } },
            h(CheckCircle, null),
            h(CheckCircle, { filled: true }),
          ),
        ),

        h(
          Group,
          { title: "Today's progress (ProgressCard)" },
          h(ProgressCard, {
            label: "Today's progress",
            percent: 60,
            stats: [
              { label: "Due", value: 2, color: "var(--c-due)" },
              { label: "Done", value: 3, color: "var(--c-done)" },
              { label: "Active", value: 4, color: "var(--c-accent)" },
            ],
          }),
        ),

        h(
          Group,
          { title: "SupplementCard — due / done / missed" },
          h(
            "div",
            { className: "ds-stack" },
            h(SupplementCard, {
              variant: "due",
              name: "Vitamin D3",
              detail: "Vitamin D3 · 60000 IU",
              timeOfDay: "Morning",
              streak: "🔥 7d",
              onMarkDone: () => alert("mark done: Vitamin D3"),
            }),
            h(SupplementCard, {
              variant: "due",
              name: "Omega-3",
              detail: "Omega-3 · 1000 mg",
              timeOfDay: "Afternoon",
              onMarkDone: () => {},
            }),
            h(SupplementCard, {
              variant: "done",
              name: "Magnesium",
              detail: "400 mg",
              time: doneTime,
              onTimeChange: setDoneTime,
              onUndo: () => alert("undo: Magnesium"),
            }),
            h(SupplementCard, {
              variant: "missed",
              name: "Zinc",
              detail: "Zinc · 25 mg · yesterday",
              onMarkTaken: () => alert("mark taken: Zinc"),
            }),
          ),
        ),

        h(
          Group,
          { title: "Manage rows (ItemRow)" },
          h(
            "div",
            { className: "ds-stack" },
            supplements.slice(0, 3).map((s) =>
              h(ItemRow, {
                key: s.name,
                name: s.name,
                detail: s.detail,
                actions: [
                  { icon: "✏️", label: "Edit" },
                  { icon: "⏸", label: "Pause" },
                  { icon: "🗑️", label: "Delete" },
                ],
              }),
            ),
          ),
        ),
      ),

      // ── Column 2: calendar + swatches + nav ─────────────────────────────
      h(
        "div",
        { className: "ds-column", style: { background: "var(--c-bg)" } },
        h(
          Group,
          { title: "MonthCalendar (compliance heatmap)" },
          h(MonthCalendar, {
            title: "July 2026",
            days: monthDays,
            leadingBlanks: 3, // July 1 2026 falls mid-week in the demo
            onPrev: () => {},
            onNext: () => {},
          }),
        ),

        h(
          Group,
          { title: "CalendarDayCell scale" },
          h(
            "div",
            { className: "swatches" },
            [95, 70, 50, 25].map((pct) =>
              h(
                "div",
                { className: "swatch", key: pct },
                h("div", { style: { width: 40 } }, h(CalendarDayCell, { day: pct, compliance: pct })),
                h("span", null, `${pct}%`),
              ),
            ),
          ),
          h("p", { className: "demo-note" }, "🟢 85%+  🟣 60–84%  🟡 40–59%  🔴 <40%"),
        ),

        h(
          Group,
          { title: "complianceColor() swatches" },
          h(
            "div",
            { className: "swatches" },
            [90, 70, 50, 20].map((pct) =>
              h(
                "div",
                { className: "swatch", key: pct },
                h("i", { style: { background: complianceColor(pct) } }),
                h("span", null, `${pct}%`),
              ),
            ),
          ),
        ),

        h(
          Group,
          { title: "Cards" },
          h(
            Card,
            { alt: true, style: { marginBottom: 10 } },
            h("p", { style: { margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-accent)" } }, "✨ AI Insight"),
            h("p", { style: { margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--c-text)" } }, "You're on a 7-day D3 streak — consistency is paying off."),
          ),
          h(Card, null, h("p", { style: { margin: 0, fontSize: 14, color: "var(--c-text)" } }, "A plain surface card (rounded-2xl, 16px padding).")),
        ),

        h(
          Group,
          { title: "BottomNav (presentational)" },
          h(BottomNav, {
            active: nav,
            onNavigate: setNav,
            items: [
              { href: "/", label: "Today", icon: HomeIcon },
              { href: "/manage", label: "Manage", icon: PillIcon },
              { href: "/trends", label: "Trends", icon: ChartIcon },
            ],
          }),
        ),
      ),
    ),
  );
}

createRoot(document.getElementById("root")).render(h(App));
