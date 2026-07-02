import type { ComponentType, ReactNode } from "react";
import { cx } from "./cx";

/* ── Built-in icons (match web/components/bottom-nav.tsx) ────────────────── */
export function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
export function PillIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M12 8v8" />
    </svg>
  );
}
export function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  );
}

/* ── BottomNav ───────────────────────────────────────────────────────────── */
export interface BottomNavItem {
  /** Stable key + navigation target. */
  href: string;
  label: ReactNode;
  /** Icon component (e.g. HomeIcon) or any node. */
  icon?: ComponentType | ReactNode;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  /** href of the active item. */
  active?: string;
  /** Called with the item's href when tapped (for router integrations). */
  onNavigate?: (href: string) => void;
  /**
   * Render-prop for links. Return an anchor/Link wrapping `children`.
   * When provided, items render as links (href honored). Otherwise buttons
   * that call onNavigate.
   * e.g. renderLink={({href, className, children}) => <Link href={href} className={className}>{children}</Link>}
   */
  renderLink?: (args: {
    href: string;
    className: string;
    active: boolean;
    children: ReactNode;
  }) => ReactNode;
  /** Position fixed to the viewport bottom. */
  fixed?: boolean;
  className?: string;
}

/** Presentational bottom tab bar. Ported from web/components/bottom-nav.tsx. */
export function BottomNav({
  items,
  active,
  onNavigate,
  renderLink,
  fixed,
  className,
}: BottomNavProps) {
  return (
    <nav className={cx("ds-bottom-nav", fixed && "ds-bottom-nav--fixed", className)}>
      <div className="ds-bottom-nav__inner">
        {items.map((item) => {
          const isActive = item.href === active;
          const cls = cx("ds-bottom-nav__item", isActive && "ds-bottom-nav__item--active");
          const inner = (
            <>
              {renderIcon(item.icon)}
              <span className="ds-bottom-nav__label">{item.label}</span>
            </>
          );
          if (renderLink) {
            return (
              <span key={item.href} style={{ display: "flex", flex: 1 }}>
                {renderLink({ href: item.href, className: cls, active: isActive, children: inner })}
              </span>
            );
          }
          return (
            <button
              key={item.href}
              type="button"
              className={cls}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate?.(item.href)}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function renderIcon(icon: ComponentType | ReactNode): ReactNode {
  if (typeof icon === "function") {
    const Icon = icon as ComponentType;
    return <Icon />;
  }
  return icon ?? null;
}
