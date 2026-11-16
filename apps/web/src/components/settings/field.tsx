import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";
import { FieldContent, FieldDescription, FieldTitle, Field as ShadcnField } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

type FieldProps = { label: string; hint?: string; icon?: IconSvgElement; children: ReactNode };

export function Field({ label, hint, icon, children }: FieldProps) {
  return (
    <ShadcnField orientation="horizontal" className="justify-between gap-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />}
        <FieldContent className="min-w-0 gap-0">
          <FieldTitle className="type-body font-normal normal-case">{label}</FieldTitle>
          {hint && <FieldDescription className="type-caption">{hint}</FieldDescription>}
        </FieldContent>
      </div>
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
