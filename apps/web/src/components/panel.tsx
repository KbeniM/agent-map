import { cn } from "cn";
import type { ReactNode } from "react";

type Props = { side: "left" | "right"; children: ReactNode; label: string; wide?: boolean };

export function Panel({ side, children, label, wide }: Props) {
  return (
    <section
      aria-label={label}
      className={cn(
        "glass animate-in fade-in absolute top-18 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-3xl max-sm:inset-x-4 max-sm:top-auto max-sm:bottom-4 max-sm:max-h-[45dvh] max-sm:w-auto",
        wide ? "w-[28rem]" : "w-80",
        side === "left" ? "left-4 slide-in-from-left-2" : "right-4 slide-in-from-right-2",
      )}
    >
      {children}
    </section>
  );
}
