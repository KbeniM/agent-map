import { cn } from "cn";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 pointer-coarse:h-11 w-full min-w-0 rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground max-sm:text-base shadow-[inset_0_1px_2px_oklch(0_0_0/0.04)] transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/25",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
