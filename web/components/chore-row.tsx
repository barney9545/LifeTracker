"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Chore } from "@/lib/chores/types";
import { describeSchedule } from "@/lib/chores/logic";
import { editChore, removeChore, scheduleChoreResume, toggleChoreActive } from "@/actions/chores";
import ChoreForm from "./chore-form";
import PausePanel, { ResumeChip, scheduledResume } from "./pause-panel";
import { IconBtn } from "./ui";

type Panel = null | "pause" | "resume" | "edit";

/**
 * A chore on the Manage screen; mirrors ItemRow. `active` comes from the server
 * as isActiveOn(chore, today) — a chore whose resume date has arrived counts as
 * active even though its stored flag is still off.
 */
export default function ChoreRow({ chore, active }: { chore: Chore; active: boolean }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scheduledOn = scheduledResume(chore.resumeOn);

  const close = () => { setPanel(null); setError(null); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res && res.ok === false) { setError(res.error ?? "Something went wrong"); return; }
      close();
      router.refresh();
    });

  const resumeNow = () => run(async () => { await toggleChoreActive(chore.id, true); });
  const pauseIndefinitely = () => run(async () => { await toggleChoreActive(chore.id, false); });
  const setResumeDate = (date: string) => run(() => scheduleChoreResume(chore.id, date));
  const del = () => {
    if (!confirm(`Delete ${chore.name}? This can't be undone.`)) return;
    run(async () => { await removeChore(chore.id); });
  };

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-[var(--c-text)]">{chore.name}</div>
          <div className="truncate text-[12px] text-[var(--c-muted)]">{describeSchedule(chore)}</div>
          {!active && scheduledOn && <ResumeChip date={scheduledOn} />}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <IconBtn onClick={() => setPanel((p) => (p === "edit" ? null : "edit"))} label="Edit" disabled={pending}>✏️</IconBtn>
          {active ? (
            <IconBtn onClick={() => setPanel((p) => (p === "pause" ? null : "pause"))} label="Pause" disabled={pending}>⏸</IconBtn>
          ) : (
            <IconBtn onClick={() => setPanel((p) => (p === "resume" ? null : "resume"))} label="Resume" disabled={pending}>▶️</IconBtn>
          )}
          <IconBtn onClick={del} label="Delete" disabled={pending}>🗑️</IconBtn>
        </div>
      </div>

      {(panel === "pause" || panel === "resume") && (
        <PausePanel mode={panel} name={chore.name} scheduledOn={active ? null : scheduledOn}
          pending={pending} error={error}
          onPause={pauseIndefinitely} onResumeNow={resumeNow} onSchedule={setResumeDate} />
      )}

      {panel === "edit" && (
        <div className="border-t border-[var(--c-border)] p-3.5">
          <ChoreForm action={editChore.bind(null, chore.id)} chore={chore}
            submitLabel="Save changes" onDone={close} />
        </div>
      )}
    </div>
  );
}
