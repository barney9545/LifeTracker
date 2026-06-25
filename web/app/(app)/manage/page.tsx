import { getRepository } from "@/lib/repository";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { addItem } from "@/actions/items";
import ItemForm from "@/components/item-form";
import ItemRow from "@/components/item-row";
import { SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const items = await getRepository().getItems();
  const activeItems = items.filter((i) => i.active);
  const pausedItems = items.filter((i) => !i.active);

  return (
    <>
      <header className="pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">
          {T.icon} Manage {T.labelPlural}
        </h1>
        <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">
          {activeItems.length} active · {pausedItems.length} paused
        </p>
      </header>

      <details className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ➕ Add {T.label.toLowerCase()}
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <ItemForm action={addItem} submitLabel={`Add ${T.label.toLowerCase()}`} />
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
}
