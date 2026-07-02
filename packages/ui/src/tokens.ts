/**
 * Design tokens + helpers, mirrored from web/app/globals.css and
 * web/lib/core/logic.ts / web/components/ui.tsx so consumers can read the same
 * values in JS (e.g. to pass a stripe color into SupplementCard).
 *
 * The canonical source of truth for rendering is styles.css (CSS custom
 * properties). These JS values are convenience copies for computed styling.
 */

export type ThemeName = "lavender" | "green";

export type TimeOfDay = "Morning" | "Afternoon" | "Evening" | "Anytime";

/** Palette values per theme (hex/rgba), identical to the CSS custom props. */
export const themes = {
  lavender: {
    bg: "#0d0a14",
    bgGlow: "radial-gradient(120% 70% at 50% -10%, #1d1430 0%, #0d0a14 55%)",
    surface: "#171022",
    surface2: "#1e1630",
    border: "rgba(167, 139, 250, 0.16)",
    text: "#efecf8",
    muted: "#9b93b5",
    accent: "#a78bfa",
    accentStrong: "#8b5cf6",
    accentInk: "#ffffff",
    accentSoft: "rgba(139, 92, 246, 0.16)",
    due: "#fbbf24",
    done: "#4ade80",
  },
  green: {
    bg: "#07120d",
    bgGlow: "radial-gradient(120% 70% at 50% -10%, #0d2a1d 0%, #07120d 55%)",
    surface: "#0f1f17",
    surface2: "#142a1f",
    border: "rgba(52, 211, 153, 0.16)",
    text: "#e8f5ee",
    muted: "#8aa89a",
    accent: "#34d399",
    accentStrong: "#10b981",
    accentInk: "#04130c",
    accentSoft: "rgba(16, 185, 129, 0.15)",
    due: "#fbbf24",
    done: "#4ade80",
  },
} as const;

/** Radii used across the kit. */
export const radii = {
  card: 16, // rounded-2xl
  control: 12, // inputs / buttons
  pill: 9999,
} as const;

/** Time-of-day left-stripe colors (SupplementCard "due" variant). */
export const timeOfDayColors: Record<TimeOfDay, string> = {
  Morning: "#fbbf24",
  Afternoon: "#60a5fa",
  Evening: "#a78bfa",
  Anytime: "#6b7280",
};

/** Accent stripe color by time of day. Mirrors web/components/ui.tsx todColor. */
export function todColor(tod: string): string {
  switch (tod) {
    case "Morning":
      return timeOfDayColors.Morning;
    case "Afternoon":
      return timeOfDayColors.Afternoon;
    case "Evening":
      return timeOfDayColors.Evening;
    default:
      return timeOfDayColors.Anytime;
  }
}

/**
 * Compliance heatmap color scale. Mirrors web/lib/core/logic.ts complianceColor.
 *   >=85 green · 60-84 lavender · 40-59 amber · <40 red
 */
export function complianceColor(pct: number): string {
  if (pct >= 85) return "#4ade80";
  if (pct >= 60) return "#c4b8f0";
  if (pct >= 40) return "#fbbf24";
  return "#f87171";
}
