import "server-only";
import { getRepository } from "./repository";
import { complianceDays, FREQ_DAYS, istLongDate } from "./core/logic";
import { sendTelegram } from "./notify";
import type { LogEntry, TrackableItem } from "./core/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

interface Stat {
  name: string;
  freq: string;
  freqDays: number;
  pct: number;
  takenDays: number;
  expectedDays: number;
  daysSince: number | null;
  /** true only when the item is genuinely due or overdue today (not merely "a while ago"). */
  dueNow: boolean;
  /** whole days past its scheduled due day; 0 = due exactly today, null = not due / never. */
  overdueDays: number | null;
  needsAttention: boolean;
}

/** Per-item adherence with a CORRECT "due" signal: a weekly item taken 6 days
 *  ago is on track (due day 7), so it is NOT flagged as a miss. */
function buildStats(items: TrackableItem[], logs: LogEntry[]): Stat[] {
  return items.map((it) => {
    const freqDays = FREQ_DAYS[it.frequency] ?? 1;
    const c = complianceDays(it, logs, 30);
    const dueNow = c.daysSince !== null && c.daysSince >= freqDays;
    const overdueDays = dueNow ? (c.daysSince as number) - freqDays : null;
    const needsAttention = c.daysSince === null || dueNow || c.pct < 70;
    return {
      name: it.name,
      freq: it.frequency,
      freqDays,
      pct: c.pct,
      takenDays: c.takenDays,
      expectedDays: c.expectedDays,
      daysSince: c.daysSince,
      dueNow,
      overdueDays,
      needsAttention,
    };
  });
}

function statusPhrase(st: Stat): string {
  if (st.daysSince === null) return "NEVER taken";
  if (st.daysSince === 0) return "taken today";
  if (st.dueNow) {
    return st.overdueDays && st.overdueDays > 0
      ? `OVERDUE by ${st.overdueDays}d (due every ${st.freqDays}d)`
      : "DUE TODAY";
  }
  return `on track — last taken ${st.daysSince}d ago, due every ${st.freqDays}d`;
}

/**
 * The default editable "guidance" — persona + rules only. The app always appends
 * the live stats block and the strict JSON contract in buildPrompt(), so editing
 * this text can never break parsing.
 */
export const DEFAULT_GUIDANCE =
  `You are a warm but HONEST health coach.\n\n` +
  `Rules:\n` +
  `- Be encouraging, but do NOT claim everything is perfect if it isn't.\n` +
  `- Only nudge supplements that are NEVER taken, DUE TODAY, or OVERDUE.\n` +
  `- IMPORTANT: a supplement marked "on track" is NOT a miss. Never say an on-track item (e.g. a weekly supplement taken a few days ago) has been "missed" or "not taken for N days". If it's simply due today, say it's due today — not that it was missed.\n` +
  `- Explicitly name any ⚠ NEEDS ATTENTION item, say its real status, and nudge the user to take it today.\n` +
  `- If everything is genuinely strong, celebrate.`;

export const DEFAULT_TEMPERATURE = 0.6;

export interface SummaryConfig {
  guidance: string;
  temperature: number;
}

/** Load the tunable digest config from the repo's `settings`, with defaults. */
export async function getSummaryConfig(): Promise<SummaryConfig> {
  try {
    const settings = await getRepository().getSettings();
    const guidance = (settings["summary_prompt"] ?? "").trim() || DEFAULT_GUIDANCE;
    const t = Number(settings["summary_temperature"]);
    const temperature = Number.isFinite(t) && t >= 0 && t <= 2 ? t : DEFAULT_TEMPERATURE;
    return { guidance, temperature };
  } catch {
    return { guidance: DEFAULT_GUIDANCE, temperature: DEFAULT_TEMPERATURE };
  }
}

/** Compose the full prompt: editable guidance + live stats + the fixed JSON contract. */
function buildPrompt(stats: Stat[], guidance: string): string {
  const lines = stats
    .map((st) => {
      const flag = st.needsAttention ? "  ⚠ NEEDS ATTENTION" : "";
      return `• ${st.name} (${st.freq}): ${st.takenDays} of ${st.expectedDays} due days taken = ${st.pct}%, ${statusPhrase(st)}${flag}`;
    })
    .join("\n");

  return (
    `${guidance}\n\n` +
    `Today is ${istLongDate()}.\n` +
    `Here is the user's real supplement adherence (compliance = days actually taken ÷ days it was due since the supplement was added):\n` +
    lines +
    `\n\n` +
    `Respond ONLY with a JSON object — no markdown, no text outside the JSON:\n` +
    `{\n` +
    `  "short": "<1-2 sentences for a daily phone nudge; lead with the biggest gap if any>",\n` +
    `  "long": "<3-5 sentences: what is going well, the biggest real gap by name, and one specific, gentle suggestion>"\n` +
    `}`
  );
}

async function generateAi(
  stats: Stat[],
  config: SummaryConfig,
): Promise<{ short: string; long: string }> {
  const fallback = {
    short: "Check in on your supplements today — consistency is what makes them work.",
    long: "(AI summary unavailable today.)",
  };
  const key = process.env.GROQ_API_KEY;
  if (!key) return fallback;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: buildPrompt(stats, config.guidance) }],
        temperature: config.temperature,
        max_tokens: 2000,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    if (!cleaned) return fallback;
    const parsed = JSON.parse(cleaned);
    return parsed.short && parsed.long ? { short: parsed.short, long: parsed.long } : fallback;
  } catch {
    return fallback;
  }
}

function complianceLines(stats: Stat[]): string {
  return [...stats]
    .sort((a, b) => a.pct - b.pct) // worst first, so gaps are seen
    .map((st) => {
      const emoji = st.pct >= 85 ? "🟢" : st.pct >= 60 ? "🟣" : st.pct >= 40 ? "🟡" : "🔴";
      const gap =
        st.daysSince === null ? " (never taken)"
        : st.overdueDays && st.overdueDays > 0 ? ` (${st.overdueDays}d overdue)`
        : st.dueNow ? " (due today)"
        : "";
      return `${emoji} ${st.name}: ${st.pct}%${gap}`;
    })
    .join("\n");
}

function buildMessage(short: string, long: string, stats: Stat[]): string {
  return (
    `💊 <b>Daily Supplement Digest</b>\n${istLongDate()}\n\n` +
    `✨ <b>Today's nudge</b>\n${short}\n\n` +
    `📊 <b>Compliance (since added)</b>\n${complianceLines(stats) || "(no data yet)"}\n\n` +
    `📈 <b>Trend</b>\n${long}`
  );
}

/**
 * Build the daily digest from live data, persist it (so the Today page's AI
 * Insight refreshes), and send it to Telegram. Returns a small status object.
 */
export async function runDailyDigest(): Promise<{ short: string; items: number }> {
  const repo = getRepository();
  const [items, logs, config] = await Promise.all([
    repo.getItems(), repo.getLogs(30), getSummaryConfig(),
  ]);
  const active = items.filter((i) => i.active);
  if (active.length === 0) return { short: "", items: 0 };

  const stats = buildStats(active, logs);
  const { short, long } = await generateAi(stats, config);
  await repo.saveAiSummary({ short, long });
  await sendTelegram(buildMessage(short, long, stats));
  return { short, items: active.length };
}

/**
 * Preview a digest with the given guidance/temperature against LIVE data, WITHOUT
 * persisting (no saveAiSummary) or sending (no sendTelegram). Powers the Manage
 * "Daily summary prompt" preview button.
 */
export async function previewDigest(
  guidance: string,
  temperature: number,
): Promise<{ short: string; long: string; message: string; debug: string }> {
  const repo = getRepository();
  const [items, logs] = await Promise.all([repo.getItems(), repo.getLogs(30)]);
  const active = items.filter((i) => i.active);
  const stats = buildStats(active, logs);
  const config: SummaryConfig = { guidance, temperature };
  const { short, long } = await generateAi(stats, config);
  const message = buildMessage(short, long, stats);
  const debug = buildPrompt(stats, guidance);
  return { short, long, message, debug };
}
