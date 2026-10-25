"use client";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

type Variant = "primary" | "accent" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:opacity-90",
  accent: "bg-accent text-accent-fg hover:shadow-[0_0_0_5px_rgb(15_164_175/.2)]",
  ghost: "bg-surface text-foreground ring-1 ring-border-strong hover:ring-foreground/40",
};

export function Button({ variant = "primary", busy, className, children, disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button {...p} disabled={disabled || busy}
      className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50", VARIANT[variant], className)}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}

export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cx("rounded-xl bg-surface shadow-card ring-1 ring-border", pad && "p-4 sm:p-6", className)}>{children}</section>;
}

export function SectionTitle({ children, hint, action }: { children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>{hint && <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p>}</div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-xs font-medium",
      tone === "neutral" && "bg-surface-2 text-muted ring-1 ring-border", tone === "accent" && "bg-accent-soft text-accent-text", tone === "ok" && "bg-ok/12 text-ok", tone === "warn" && "bg-warn/12 text-warn")}>{children}</span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; badge?: string | number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto rounded-[12px] bg-surface-2 p-1 ring-1 ring-border">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx("inline-flex min-h-10 min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3.5 text-sm font-medium transition", value === t.id ? "bg-surface text-foreground shadow-card ring-1 ring-border" : "text-muted hover:text-foreground")}>
          {t.label}{t.badge !== undefined && <span className="rounded-full bg-border px-1.5 text-[11px] tabular-nums">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export const inputCls = "w-full rounded-[10px] bg-surface px-3.5 py-3 text-foreground shadow-card ring-1 ring-border-strong transition placeholder:text-muted/55 hover:ring-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground";
