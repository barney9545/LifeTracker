import type { ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  value: string;
  label: ReactNode;
}

export interface TabSwitchProps {
  tabs: Array<TabItem | string>;
  /** Currently active tab value. */
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

/** Segmented tab control. Pure/presentational: active + onChange are props. */
export function TabSwitch({ tabs, value, onChange, className }: TabSwitchProps) {
  return (
    <div className={cx("ds-tabs", className)} role="tablist">
      {tabs.map((t) => {
        const tab = typeof t === "string" ? { value: t, label: t } : t;
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("ds-tab", active && "ds-tab--active")}
            onClick={() => onChange?.(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
