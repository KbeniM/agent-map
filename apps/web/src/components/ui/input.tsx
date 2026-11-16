import { cn } from "cn";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 pointer-coarse:h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground max-sm:text-base shadow-[inset_0_1px_0_0_var(--borderColor-translucent)] transition-colors placeholder:text-muted-foreground focus-visible:border-[var(--borderColor-accent-emphasis)] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-canvas-muted disabled:text-muted-foreground aria-invalid:border-[var(--borderColor-danger-emphasis)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
