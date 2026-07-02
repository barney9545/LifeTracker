# @lifetracker/ui

A **framework-agnostic**, pure-presentational React + TypeScript design kit
extracted from the LifeTracker supplement-tracker app. It has **no** dependency on
Next.js, Tailwind, server actions, or data fetching — every interaction is a prop
callback, every link is a prop, every piece of data comes in via props. Styling is
shipped as a single self-contained `styles.css` (design tokens as CSS custom
properties + all component classes), so components render with zero app context.

Importable into Claude Design / Figma / any React app.

## Install & use

```bash
npm install @lifetracker/ui
```

```tsx
import "@lifetracker/ui/styles.css";
import { SupplementCard, ProgressCard } from "@lifetracker/ui";

export function App() {
  return (
    // Pick a theme class on a wrapper. .theme-lavender is the default palette.
    <div className="theme-lavender ds-shell">
      <div className="ds-column">
        <ProgressCard
          label="Today's progress"
          percent={60}
          stats={[
            { label: "Due", value: 2, color: "var(--c-due)" },
            { label: "Done", value: 3, color: "var(--c-done)" },
            { label: "Active", value: 4, color: "var(--c-accent)" },
          ]}
        />
        <SupplementCard
          variant="due"
          name="Vitamin D3"
          detail="Vitamin D3 · 60000 IU"
          timeOfDay="Morning"
          streak="🔥 7d"
          onMarkDone={() => {}}
        />
      </div>
    </div>
  );
}
```

## Design tokens

Two theme classes. Apply one to a wrapper element; components read the CSS custom
properties. `.theme-lavender` is the default.

| Token | Lavender | Green |
| --- | --- | --- |
| `--c-bg` | `#0d0a14` | `#07120d` |
| `--c-surface` | `#171022` | `#0f1f17` |
| `--c-surface-2` | `#1e1630` | `#142a1f` |
| `--c-border` | `rgba(167,139,250,0.16)` | `rgba(52,211,153,0.16)` |
| `--c-text` | `#efecf8` | `#e8f5ee` |
| `--c-muted` | `#9b93b5` | `#8aa89a` |
| `--c-accent` | `#a78bfa` | `#34d399` |
| `--c-accent-strong` | `#8b5cf6` | `#10b981` |
| `--c-accent-ink` | `#ffffff` | `#04130c` |
| `--c-accent-soft` | `rgba(139,92,246,0.16)` | `rgba(16,185,129,0.15)` |
| `--c-due` | `#fbbf24` | `#fbbf24` |
| `--c-done` | `#4ade80` | `#4ade80` |

Each theme also defines `--c-bg-glow` (radial glow used by `.ds-shell`).

**Radii:** cards `16px` (rounded-2xl), inputs/buttons `12px`, pills/progress fully
rounded. **Typography:** headings 22px semibold; body 13–15px; section labels
10–11px uppercase muted. Mobile column max-width **430px** (`.ds-column`).

**Time-of-day stripe colors** (SupplementCard `due`):
Morning `#fbbf24`, Afternoon `#60a5fa`, Evening `#a78bfa`, Anytime `#6b7280`.

**Compliance scale** — `complianceColor(pct)`:
`≥85 → #4ade80` · `60–84 → #c4b8f0` · `40–59 → #fbbf24` · `<40 → #f87171`.

These values are also exported from JS: `themes`, `radii`, `timeOfDayColors`,
`todColor(tod)`, `complianceColor(pct)`.

## Components

### Primitives (`web/components/ui.tsx` origin)

| Component | Key props |
| --- | --- |
| `Button` | `variant?: "primary" \| "secondary" \| "ghost"`, `block?`, plus native button attrs |
| `Input` | `label?`, native input attrs |
| `Textarea` | `label?`, native textarea attrs |
| `Select` | `label?`, `options?: (string \| {value,label})[]`, native select attrs |
| `Card` | `alt?` (surface-2 bg), `flush?` (no padding), `className?`, `style?` |
| `SectionLabel` | `children` — 11px uppercase muted label |
| `Chip` / `Badge` | `tone?: "accent" \| "muted" \| "done" \| "due" \| "danger" \| "bare"` |
| `ProgressBar` | `value: number` (0–100), `color?` |
| `CheckCircle` | `filled?`, `size?` |
| `Avatar` | `initials?`, `src?`, `alt?`, `size?` |

### Composites (the brand)

**`SupplementCard`** — `variant: "due" | "done" | "missed"`
- Common: `name`, `detail?`, `disabled?`, `className?`
- `due`: `timeOfDay?` / `stripeColor?` (colored left stripe), `streak?`, `onMarkDone?` (outline check button)
- `done`: green check + strikethrough name, `time?` + `onTimeChange?` (editable time input), `onUndo?`
- `missed`: red left stripe + red name, `onMarkTaken?` ("Mark taken" button)

**`ProgressCard`** — `label`, `percent` (0–100), `stats?: {label,value,color?}[]` (3-up row), `barColor?`

**`ItemRow`** — `name`, `detail?`, `actions?: {icon,label,onClick?,disabled?}[]`, `children?` (expanded content below row)

**`CalendarDayCell`** — `day: number | null`, `compliance?` (0–100 → heatmap color), `color?`, `muted?`

**`MonthCalendar`** — `title`, `days: ({day,compliance?,color?,muted?} | null)[]`, `leadingBlanks?`, `weekdays?`, `onPrev?`, `onNext?`, `prevDisabled?`, `nextDisabled?`

**`TabSwitch`** — `tabs: (string | {value,label})[]`, `value`, `onChange?`

**`BottomNav`** — `items: {href,label,icon?}[]`, `active?`, `onNavigate?(href)`, `renderLink?` (render-prop for framework `<Link>`), `fixed?`. Ships `HomeIcon`, `PillIcon`, `ChartIcon`.

All interactions are prop callbacks; all links are props. No `next/*`, no server code.

## Build

```bash
cd packages/ui
npm install
npm run build      # tsup: dist/index.js (ESM) + dist/index.d.ts, then copies dist/styles.css
npm run typecheck  # tsc --noEmit
```

Outputs `dist/index.js`, `dist/index.d.ts`, `dist/styles.css`.

## Preview the demo standalone

The demo renders a gallery of every component with realistic sample data
(Vitamin D3 60000 IU, Omega-3 1000 mg, Magnesium 400 mg, Zinc 25 mg; all three
SupplementCard variants; a MonthCalendar with varied compliance colors). It imports
the **built** `dist/index.js` + `dist/styles.css`, and loads React from an import-map
CDN — so **no dev server or build step is required**.

1. `npm run build` (produces `dist/`).
2. Open the demo. Either:
   - Serve statically: `npx serve packages/ui` then visit `/demo/` **(recommended — reliable ES-module + CDN loading over http)**, or
   - Open `packages/ui/demo/index.html` directly in a browser.

> Note: the demo fetches React from `https://esm.sh` via the import map, so it needs
> network access the first time. The kit itself has **no** runtime CDN dependency —
> that is purely a convenience for the zero-build demo. In a real app you provide
> React via your bundler (it's a peer dependency).
