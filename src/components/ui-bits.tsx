import type { ReactNode } from "react";

export function Section({
  title,
  children,
  right,
}: {
  title: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3 stripe-accent">
        <h2 className="pl-3 font-display text-lg font-bold">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "–"}</span>
    </div>
  );
}

export function RatingPill({ v }: { v: number }) {
  const cls =
    v >= 7.5
      ? "bg-primary text-primary-foreground"
      : v >= 6.8
        ? "bg-accent text-accent-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex min-w-10 justify-center rounded px-1.5 py-0.5 text-xs font-bold ${cls}`}
    >
      {v.toFixed(1)}
    </span>
  );
}

export function AttrBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 text-muted-foreground">{name}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${(value / 20) * 100}%` }} />
      </div>
      <span className={`w-6 text-right font-bold ${value >= 15 ? "text-primary" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export function Badge2({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
      {children}
    </span>
  );
}
