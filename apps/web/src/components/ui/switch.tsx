import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-input/80 p-0.5 transition-colors duration-150 after:absolute after:-inset-2 data-checked:border-transparent data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-background shadow-sm ring-1 ring-border/40 transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] data-checked:translate-x-4 data-checked:bg-primary-foreground data-checked:ring-transparent"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
