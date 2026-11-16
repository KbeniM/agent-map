import type { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="type-body">{label}</span>
        {hint && <span className="type-caption text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col py-2">
      <h3 className="type-title border-b border-border/70 pt-2 pb-2">{title}</h3>
      {children}
    </section>
  );
}
