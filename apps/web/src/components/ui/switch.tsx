import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-md border border-[var(--controlTrack-borderColor-rest)] bg-track transition-colors duration-[80ms] after:absolute after:-inset-2 data-checked:border-transparent data-checked:bg-accent-emphasis data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[18px] -translate-x-px rounded-md border border-[var(--fgColor-muted)] bg-knob shadow-[var(--shadow-resting-small)] transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] data-checked:translate-x-[15px] data-checked:border-[var(--controlKnob-borderColor-checked)]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
