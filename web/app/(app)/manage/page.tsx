import { getChores, getItems } from "@/lib/data";
import { getRepository } from "@/lib/repository";
import { DEFAULT_GUIDANCE, DEFAULT_TEMPERATURE } from "@/lib/summary";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { istToday } from "@/lib/core/logic";
import { isActiveOn } from "@/lib/chores/logic";
import { addItem } from "@/actions/items";
import { addChore } from "@/actions/chores";
import ItemForm from "@/components/item-form";
import ItemRow from "@/components/item-row";
import ChoreForm from "@/components/chore-form";
import ChoreRow from "@/components/chore-row";
import SummaryPromptEditor from "@/components/summary-prompt-editor";
import Tabs from "@/components/tabs";
import { SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, items, settings, chores] = await Promise.all([
    searchParams, getItems(), getRepository().getSettings(), getChores(),
  ]);
  const activeItems = items.filter((i) => i.active);
  const pausedItems = items.filter((i) => !i.active);
  // A chore whose scheduled resume date has arrived is active even though its
  // stored flag is still off (nothing flips it), so split by isActiveOn.
  const today = istToday();
  const activeChores = chores.filter((c) => isActiveOn(c, today));
  const pausedChores = chores.filter((c) => !isActiveOn(c, today));

  const promptValue = (settings["summary_prompt"] ?? "").trim() || DEFAULT_GUIDANCE;
  const tRaw = Number(settings["summary_temperature"]);
  const temperatureValue = Number.isFinite(tRaw) && tRaw >= 0 && tRaw <= 2 ? tRaw : DEFAULT_TEMPERATURE;

  const supplementsTab = (
    <>
      <details className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ➕ Add {T.label.toLowerCase()}
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <ItemForm action={addItem} submitLabel={`Add ${T.label.toLowerCase()}`} />
        </div>
      </details>

      <details className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ✨ Daily summary prompt
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <SummaryPromptEditor
            initialPrompt={promptValue}
            initialTemperature={temperatureValue}
            defaultPrompt={DEFAULT_GUIDANCE}
            defaultTemperature={DEFAULT_TEMPERATURE}
          />
        </div>
      </details>

      {activeItems.length > 0 && (
        <>
          <SectionLabel>Active</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {activeItems.map((i) => <ItemRow key={i.id} item={i} />)}
          </div>
        </>
      )}

      {pausedItems.length > 0 && (
        <>
          <SectionLabel>Paused</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {pausedItems.map((i) => <ItemRow key={i.id} item={i} />)}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-muted)]">
          No {T.labelPlural.toLowerCase()} yet. Add your first one above.
        </div>
      )}
    </>
  );

  const choresTab = (
    <>
      <details className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ➕ Add chore
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <ChoreForm action={addChore} submitLabel="Add chore" />
        </div>
      </details>

      {activeChores.length > 0 && (
        <>
          <SectionLabel>Active</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {activeChores.map((c) => <ChoreRow key={c.id} chore={c} active />)}
          </div>
        </>
      )}

      {pausedChores.length > 0 && (
        <>
          <SectionLabel>Paused</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {pausedChores.map((c) => <ChoreRow key={c.id} chore={c} active={false} />)}
          </div>
        </>
      )}

      {chores.length === 0 && (
        <div className="mt-8 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-muted)]">
          No chores yet. Add your first one above.
        </div>
      )}
    </>
  );

  return (
    <>
      <header className="pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">🗂️ All tasks</h1>
        <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">
          {activeItems.length} {T.labelPlural.toLowerCase()} · {activeChores.length} chores active
        </p>
      </header>

      {/* Keyed by ?tab so following an "All tasks →" link re-opens the right tab. */}
      <Tabs key={tab ?? ""} initialKey={tab}
        tabs={[
          { key: "supplements", label: `${T.icon} ${T.labelPlural}`, content: supplementsTab },
          { key: "chores", label: "🧹 Chores", content: choresTab },
        ]}
      />
    </>
  );
}
