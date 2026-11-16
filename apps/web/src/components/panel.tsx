import { cn } from "cn";
import type { ReactNode } from "react";

type Props = { side: "left" | "right"; children: ReactNode; label: string; wide?: boolean };

export function Panel({ side, children, label, wide }: Props) {
  return (
    <section
      aria-label={label}
      className={cn(
        "surface animate-in fade-in duration-200 absolute top-17 flex max-h-[calc(100dvh-5.25rem)] flex-col overflow-hidden rounded-2xl max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-3 max-sm:max-h-[45dvh] max-sm:w-auto",
        wide ? "w-[28rem]" : "w-80",
        side === "left" ? "left-4 slide-in-from-left-2" : "right-4 slide-in-from-right-2",
      )}
    >
      {children}
    </section>
  );
}
