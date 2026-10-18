"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrackableItem } from "@/lib/core/types";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { editItem, removeItem, scheduleResume, toggleActive } from "@/actions/items";
import ItemForm from "./item-form";
import PausePanel, { ResumeChip, scheduledResume } from "./pause-panel";
import { IconBtn } from "./ui";

type Panel = null | "pause" | "resume" | "edit";

export default function ItemRow({ item }: { item: TrackableItem }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scheduledOn = scheduledResume(item.resumeOn);

  const close = () => { setPanel(null); setError(null); };
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
  const setResumeDate = (date: string) => run(() => scheduleResume(item.id, date));
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
          {!item.active && scheduledOn && <ResumeChip date={scheduledOn} />}
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

      {(panel === "pause" || panel === "resume") && (
        <PausePanel mode={panel} name={item.name} scheduledOn={scheduledOn}
          pending={pending} error={error}
          onPause={pauseIndefinitely} onResumeNow={resumeNow} onSchedule={setResumeDate} />
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
