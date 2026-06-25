"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrackableItem } from "@/lib/core/types";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { editItem, removeItem, toggleActive } from "@/actions/items";
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

export default function ItemRow({ item }: { item: TrackableItem }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pause = () =>
    startTransition(async () => { await toggleActive(item.id, !item.active); router.refresh(); });
  const del = () => {
    if (!confirm(`Delete ${item.name}? This can't be undone.`)) return;
    startTransition(async () => { await removeItem(item.id); router.refresh(); });
  };

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-[var(--c-text)]">{item.name}</div>
          <div className="truncate text-[12px] text-[var(--c-muted)]">{T.detail(item)}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <IconBtn onClick={() => setEditing((e) => !e)} label="Edit" disabled={pending}>✏️</IconBtn>
          <IconBtn onClick={pause} label={item.active ? "Pause" : "Resume"} disabled={pending}>
            {item.active ? "⏸" : "▶️"}
          </IconBtn>
          <IconBtn onClick={del} label="Delete" disabled={pending}>🗑️</IconBtn>
        </div>
      </div>
      {editing && (
        <div className="border-t border-[var(--c-border)] p-3.5">
          <ItemForm action={editItem.bind(null, item.id)} item={item}
            submitLabel="Save changes" onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
