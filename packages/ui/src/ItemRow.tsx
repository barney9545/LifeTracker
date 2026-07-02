import type { ReactNode } from "react";
import { Card } from "./primitives";
import { cx } from "./cx";

export interface ItemRowAction {
  /** Emoji/glyph or node shown inside the icon button. */
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface ItemRowProps {
  name: ReactNode;
  detail?: ReactNode;
  /** Trailing icon buttons (edit / pause / delete, etc.). */
  actions?: ItemRowAction[];
  /** Optional expanded content below the row (e.g. an edit form). */
  children?: ReactNode;
  className?: string;
}

/**
 * Manage-list row. Ported from web/components/item-row.tsx as pure UI —
 * actions are prop callbacks, no server actions / router.
 */
export function ItemRow({ name, detail, actions = [], children, className }: ItemRowProps) {
  return (
    <Card flush className={cx(className)}>
      <div className="ds-item-row">
        <div className="ds-item-row__body">
          <div className="ds-item-row__name">{name}</div>
          {detail != null && <div className="ds-item-row__detail">{detail}</div>}
        </div>
        {actions.length > 0 && (
          <div className="ds-item-row__actions">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className="ds-icon-btn"
                onClick={a.onClick}
                disabled={a.disabled}
                aria-label={a.label}
              >
                {a.icon}
              </button>
            ))}
          </div>
        )}
      </div>
      {children != null && (
        <div style={{ borderTop: "1px solid var(--c-border)", padding: 14 }}>{children}</div>
      )}
    </Card>
  );
}
