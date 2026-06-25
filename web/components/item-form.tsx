"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { TrackableItem } from "@/lib/core/types";
import { FREQUENCIES } from "@/lib/core/logic";
import { TIME_OF_DAY, supplementsTracker as T } from "@/lib/trackers/supplements";

const inputCls =
  "w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[14px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
const labelCls = "mb-1 block text-[12px] text-[var(--c-muted)]";

export default function ItemForm({
  action,
  item,
  submitLabel,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: TrackableItem;
  submitLabel: string;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function handle(formData: FormData) {
    await action(formData);
    formRef.current?.reset();
    onDone?.();
    router.refresh();
  }

  return (
    <form ref={formRef} action={handle} className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Name *</label>
        <input name="name" required defaultValue={item?.name ?? ""} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Frequency</label>
          <select name="frequency" defaultValue={item?.frequency ?? "Daily"} className={inputCls}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Time of day</label>
          <select name="time_of_day" defaultValue={item?.timeOfDay ?? "Anytime"} className={inputCls}>
            {TIME_OF_DAY.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {T.metaFields.map((f) => {
          const dv = item?.meta?.[f.key] ?? f.default ?? "";
          return (
            <div key={f.key} className={f.type === "text" ? "col-span-2" : ""}>
              <label className={labelCls}>{f.label}{f.required ? " *" : ""}</label>
              {f.type === "select" ? (
                <select name={f.key} defaultValue={dv} className={inputCls}>
                  {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input name={f.key} type={f.type === "number" ? "number" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  required={f.required} defaultValue={dv} className={inputCls} />
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} className={inputCls} />
      </div>

      <button type="submit"
        className="mt-1 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3 text-[14px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.99]">
        {submitLabel}
      </button>
    </form>
  );
}
