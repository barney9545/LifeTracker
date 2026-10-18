"use client";

import { useState } from "react";
import { istToday } from "@/lib/core/logic";

const inputCls =
  "flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
const primaryBtn =
  "rounded-xl bg-[var(--c-accent-strong)] px-3 py-2 text-[13px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.98] disabled:opacity-40";
const ghostBtn =
  "rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-text)] transition active:scale-[0.98] disabled:opacity-40";

/** yyyy-mm-dd for `n` days after IST today (for the date input's min). */
function daysFromTodayISO(n: number): string {
  return new Date(Date.parse(istToday() + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}
function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The yyyy-mm-dd part of a stored resume date, or null when unset/malformed. */
export function scheduledResume(resumeOn?: string): string | null {
  return /^\d{4}-\d{2}-\d{2}/.test(resumeOn ?? "") ? resumeOn!.slice(0, 10) : null;
}

/** "▶ Resumes 24 Oct" chip for a paused row with a scheduled resume date. */
export function ResumeChip({ date }: { date: string }) {
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--c-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-accent)]">
      ▶ Resumes {formatDate(date)}
    </div>
  );
}

/**
 * The pause / resume panel shared by supplement and chore rows. "pause" asks
 * when to resume (a date, or indefinitely); "resume" offers resume-now, a
 * start date, or cancelling a scheduled resume. The row owns the server calls
 * (and their error); this owns only the date picker.
 */
export default function PausePanel({
  mode, name, scheduledOn, pending, error, onPause, onResumeNow, onSchedule,
}: {
  mode: "pause" | "resume";
  name: string;
  /** Pending scheduled-resume date (yyyy-mm-dd), if any. */
  scheduledOn: string | null;
  pending: boolean;
  /** Error from the row's last server call. */
  error: string | null;
  /** Pause indefinitely (also cancels a scheduled resume). */
  onPause: () => void;
  onResumeNow: () => void;
  /** Pause until `dateISO`, then auto-resume. */
  onSchedule: (dateISO: string) => void;
}) {
  const [date, setDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const tomorrow = daysFromTodayISO(1);

  const pause = () => { setDateError(null); onPause(); };
  const resumeNow = () => { setDateError(null); onResumeNow(); };
  const setResumeDate = () => {
    if (!date) { setDateError("Pick a date"); return; }
    setDateError(null);
    onSchedule(date);
  };
  const shownError = dateError ?? error;

  if (mode === "pause") {
    return (
      <div className="border-t border-[var(--c-border)] p-3.5">
        <p className="mb-2 text-[13px] text-[var(--c-text)]">When should <span className="font-medium">{name}</span> resume?</p>
        <div className="flex gap-2">
          <input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <button onClick={setResumeDate} disabled={pending} className={primaryBtn}>Set date</button>
        </div>
        <button onClick={pause} disabled={pending} className={`${ghostBtn} mt-2 w-full`}>
          Pause, I&apos;ll pick later
        </button>
        {shownError && <p className="mt-2 text-[12px] text-[#fca5a5]">{shownError}</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--c-border)] p-3.5">
      <button onClick={resumeNow} disabled={pending} className={`${primaryBtn} w-full`}>Resume now</button>
      <p className="my-2 text-center text-[11px] text-[var(--c-muted)]">or start on a specific day</p>
      <div className="flex gap-2">
        <input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <button onClick={setResumeDate} disabled={pending} className={primaryBtn}>{scheduledOn ? "Change" : "Set date"}</button>
      </div>
      {scheduledOn && (
        <button onClick={pause} disabled={pending} className={`${ghostBtn} mt-2 w-full`}>
          Cancel scheduled resume
        </button>
      )}
      {shownError && <p className="mt-2 text-[12px] text-[#fca5a5]">{shownError}</p>}
    </div>
  );
}
