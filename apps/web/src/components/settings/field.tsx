import type { ReactNode } from "react";
import { FieldContent, FieldDescription, FieldTitle, Field as ShadcnField } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <ShadcnField orientation="horizontal" className="justify-between gap-4 py-2">
      <FieldContent className="min-w-0 gap-0">
        <FieldTitle className="type-body font-normal normal-case">{label}</FieldTitle>
        {hint && <FieldDescription className="type-caption">{hint}</FieldDescription>}
      </FieldContent>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </ShadcnField>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col py-2">
      <h3 className="type-title pt-2 pb-2">{title}</h3>
      <Separator />
      {children}
    </section>
  );
}
