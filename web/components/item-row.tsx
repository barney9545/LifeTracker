"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrackableItem } from "@/lib/core/types";
import { istToday } from "@/lib/core/logic";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { editItem, removeItem, scheduleResume, toggleActive } from "@/actions/items";
import ItemForm from "./item-form";

function IconBtn({ onClick, label, children, disabled }: {
  onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[14px] transition active:scale-90 disabled:opacity-40">
      {children}
    </button>
  );
}

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

type Panel = null | "pause" | "resume" | "edit";

export default function ItemRow({ item }: { item: TrackableItem }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const tomorrow = daysFromTodayISO(1);
  const scheduledOn = /^\d{4}-\d{2}-\d{2}/.test(item.resumeOn ?? "") ? item.resumeOn!.slice(0, 10) : null;

  const close = () => { setPanel(null); setDate(""); setError(null); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res && res.ok === false) { setError(res.error ?? "Something went wrong"); return; }
      close();
      router.refresh();
    });

  const resumeNow = () => run(async () => { await toggleActive(item.id, true); });
  const pauseIndefinitely = () => run(async () => { await toggleActive(item.id, false); });
  const setResumeDate = () => {
    if (!date) { setError("Pick a date"); return; }
    run(() => scheduleResume(item.id, date));
  };
  const del = () => {
    if (!confirm(`Delete ${item.name}? This can't be undone.`)) return;
    run(async () => { await removeItem(item.id); });
  };

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-[var(--c-text)]">{item.name}</div>
          <div className="truncate text-[12px] text-[var(--c-muted)]">{T.detail(item)}</div>
          {!item.active && scheduledOn && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--c-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-accent)]">
              ▶ Resumes {formatDate(scheduledOn)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <IconBtn onClick={() => setPanel((p) => (p === "edit" ? null : "edit"))} label="Edit" disabled={pending}>✏️</IconBtn>
          {item.active ? (
            <IconBtn onClick={() => setPanel((p) => (p === "pause" ? null : "pause"))} label="Pause" disabled={pending}>⏸</IconBtn>
          ) : (
            <IconBtn onClick={() => setPanel((p) => (p === "resume" ? null : "resume"))} label="Resume" disabled={pending}>▶️</IconBtn>
          )}
          <IconBtn onClick={del} label="Delete" disabled={pending}>🗑️</IconBtn>
        </div>
      </div>

      {panel === "pause" && (
        <div className="border-t border-[var(--c-border)] p-3.5">
          <p className="mb-2 text-[13px] text-[var(--c-text)]">When should <span className="font-medium">{item.name}</span> resume?</p>
          <div className="flex gap-2">
            <input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <button onClick={setResumeDate} disabled={pending} className={primaryBtn}>Set date</button>
          </div>
          <button onClick={pauseIndefinitely} disabled={pending} className={`${ghostBtn} mt-2 w-full`}>
            Pause, I&apos;ll pick later
          </button>
          {error && <p className="mt-2 text-[12px] text-[#fca5a5]">{error}</p>}
        </div>
      )}

      {panel === "resume" && (
        <div className="border-t border-[var(--c-border)] p-3.5">
          <button onClick={resumeNow} disabled={pending} className={`${primaryBtn} w-full`}>Resume now</button>
          <p className="my-2 text-center text-[11px] text-[var(--c-muted)]">or start on a specific day</p>
          <div className="flex gap-2">
            <input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <button onClick={setResumeDate} disabled={pending} className={primaryBtn}>{scheduledOn ? "Change" : "Set date"}</button>
          </div>
          {scheduledOn && (
            <button onClick={pauseIndefinitely} disabled={pending} className={`${ghostBtn} mt-2 w-full`}>
              Cancel scheduled resume
            </button>
          )}
          {error && <p className="mt-2 text-[12px] text-[#fca5a5]">{error}</p>}
        </div>
      )}

      {panel === "edit" && (
        <div className="border-t border-[var(--c-border)] p-3.5">
          <ItemForm action={editItem.bind(null, item.id)} item={item}
            submitLabel="Save changes" onDone={close} />
        </div>
      )}
    </div>
  );
}
