import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

/* ── Button ──────────────────────────────────────────────────────────────── */
export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretch to full width (ds-btn--block). */
  block?: boolean;
}

export function Button({
  variant = "primary",
  block,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("ds-btn", `ds-btn--${variant}`, block && "ds-btn--block", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Input ───────────────────────────────────────────────────────────────── */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
}

export function Input({ label, className, id, ...rest }: InputProps) {
  const input = <input id={id} className={cx("ds-input", className)} {...rest} />;
  if (!label) return input;
  return (
    <label className="ds-field">
      <span className="ds-field-label">{label}</span>
      {input}
    </label>
  );
}

/* ── Textarea ────────────────────────────────────────────────────────────── */
export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
}

export function Textarea({ label, className, ...rest }: TextareaProps) {
  const el = <textarea className={cx("ds-textarea", className)} {...rest} />;
  if (!label) return el;
  return (
    <label className="ds-field">
      <span className="ds-field-label">{label}</span>
      {el}
    </label>
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */
export interface SelectOption {
  value: string;
  label?: ReactNode;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  /** Convenience: render options from a list. Ignored if children provided. */
  options?: Array<SelectOption | string>;
}

export function Select({
  label,
  options,
  className,
  children,
  ...rest
}: SelectProps) {
  const el = (
    <select className={cx("ds-select", className)} {...rest}>
      {children ??
        options?.map((o) => {
          const opt = typeof o === "string" ? { value: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label ?? opt.value}
            </option>
          );
        })}
    </select>
  );
  if (!label) return el;
  return (
    <label className="ds-field">
      <span className="ds-field-label">{label}</span>
      {el}
    </label>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */
export interface CardProps {
  children: ReactNode;
  /** Surface-2 background instead of surface (used for AI-insight cards). */
  alt?: boolean;
  /** Remove default padding (for rows / lists that manage their own). */
  flush?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, alt, flush, className, style }: CardProps) {
  return (
    <div
      className={cx("ds-card", alt && "ds-card--alt", flush && "ds-card--flush", className)}
      style={style}
    >
      {children}
    </div>
  );
}

/* ── SectionLabel ────────────────────────────────────────────────────────── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="ds-section-label">{children}</p>;
}

/* ── Chip / Badge ────────────────────────────────────────────────────────── */
export type ChipTone = "accent" | "muted" | "done" | "due" | "danger" | "bare";

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  style?: React.CSSProperties;
}

export function Chip({ children, tone = "accent", className, style }: ChipProps) {
  return (
    <span className={cx("ds-chip", `ds-chip--${tone}`, className)} style={style}>
      {children}
    </span>
  );
}

/** Badge is a semantic alias of Chip. */
export const Badge = Chip;

/* ── ProgressBar ─────────────────────────────────────────────────────────── */
export interface ProgressBarProps {
  /** 0–100. Clamped. */
  value: number;
  /** Override fill color (defaults to --c-accent). */
  color?: string;
  className?: string;
}

export function ProgressBar({ value, color, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx("ds-progress", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="ds-progress__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ── CheckCircle ─────────────────────────────────────────────────────────── */
export interface CheckCircleProps {
  filled?: boolean;
  size?: number;
}

/** Circular check icon. Ported from web/components/ui.tsx. */
export function CheckCircle({ filled, size = 26 }: CheckCircleProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="11"
        fill={filled ? "var(--c-done)" : "transparent"}
        stroke={filled ? "var(--c-done)" : "var(--c-border)"}
        strokeWidth="2"
      />
      {filled && (
        <path
          d="M7 12.5l3.2 3.2L17 9"
          stroke="#04130c"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
export interface AvatarProps {
  /** Initials shown when no image. */
  initials?: string;
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
}

export function Avatar({ initials, src, alt, size = 40, className }: AvatarProps) {
  return (
    <span
      className={cx("ds-avatar", className)}
      style={{ height: size, width: size, fontSize: Math.round(size * 0.375) }}
    >
      {src ? <img src={src} alt={alt ?? ""} /> : initials}
    </span>
  );
}
