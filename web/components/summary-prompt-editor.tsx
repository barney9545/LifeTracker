"use client";

import { useState, useTransition } from "react";
import { saveSummaryConfig, previewSummary } from "@/actions/items";

const inputCls =
  "w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[14px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
const labelCls = "mb-1 block text-[12px] text-[var(--c-muted)]";

export default function SummaryPromptEditor({
  initialPrompt, initialTemperature, defaultPrompt, defaultTemperature,
}: {
  initialPrompt: string;
  initialTemperature: number;
  defaultPrompt: string;
  defaultTemperature: number;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [temperature, setTemperature] = useState(String(initialTemperature));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ short: string; long: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null); setStatus(null);
    startTransition(async () => {
      const res = await saveSummaryConfig(prompt, Number(temperature));
      if (!res.ok) setError(res.error);
      else setStatus("Saved.");
    });
  }

  function handlePreview() {
    setError(null); setStatus(null); setPreview(null);
    startTransition(async () => {
      const res = await previewSummary(prompt, Number(temperature));
      if (!res.ok) setError(res.error);
      else setPreview({ short: res.short, long: res.long, message: res.message });
    });
  }

  function handleReset() {
    setPrompt(defaultPrompt);
    setTemperature(String(defaultTemperature));
    setError(null);
    setStatus("Reset to default (not yet saved).");
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Guidance (persona + rules)</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={10}
          className={`${inputCls} font-mono text-[12px] leading-relaxed`} />
        <p className="mt-1 text-[11px] text-[var(--c-muted)]">
          The app always appends today&apos;s live stats and a strict JSON contract, so edits here can&apos;t break parsing.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="w-28">
          <label className={labelCls}>Temperature</label>
          <input type="number" min="0" max="2" step="0.1" value={temperature}
            onChange={(e) => setTemperature(e.target.value)} className={inputCls} />
        </div>
        <button type="button" onClick={handleReset} disabled={pending}
          className="pb-3 text-[12px] text-[var(--c-accent)] disabled:opacity-40">
          Reset to default
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
          {error}
        </p>
      )}
      {status && !error && (
        <p className="text-[12px] text-[var(--c-done)]">{status}</p>
      )}

      <div className="flex gap-2.5">
        <button type="button" onClick={handleSave} disabled={pending}
          className="flex-1 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3 text-[14px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.99] disabled:opacity-50">
          {pending ? "…" : "Save"}
        </button>
        <button type="button" onClick={handlePreview} disabled={pending}
          className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 text-[14px] font-medium text-[var(--c-text)] transition active:scale-[0.99] disabled:opacity-50">
          {pending ? "…" : "Preview"}
        </button>
      </div>

      {preview && (
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent)]">
            Preview — shown here, NOT sent
          </p>
          <p className="text-[11px] font-semibold text-[var(--c-muted)]">Short</p>
          <p className="mb-2 text-[13px] leading-relaxed text-[var(--c-text)]">{preview.short}</p>
          <p className="text-[11px] font-semibold text-[var(--c-muted)]">Long</p>
          <p className="mb-2 text-[13px] leading-relaxed text-[var(--c-text)]">{preview.long}</p>
          <details>
            <summary className="cursor-pointer list-none text-[11px] text-[var(--c-muted)]">Full Telegram message</summary>
            <pre className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--c-text)]">{preview.message}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
