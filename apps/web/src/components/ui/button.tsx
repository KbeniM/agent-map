import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 enabled:active:not-aria-[haspopup]:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-border bg-secondary/85 text-secondary-foreground shadow-[var(--control-shadow)] hover:bg-secondary aria-expanded:bg-secondary",
        primary:
          "border-transparent bg-primary text-primary-foreground shadow-[var(--control-shadow)] hover:bg-primary/90",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-accent/70 aria-expanded:bg-accent/70",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground",
        link: "h-auto border-transparent px-0 text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 text-sm pointer-coarse:h-11",
        sm: "h-7 px-2.5 text-xs pointer-coarse:h-11 pointer-coarse:px-3",
        lg: "h-10 px-4 text-base",
        icon: "size-8 pointer-coarse:size-11",
        "icon-sm": "size-7 pointer-coarse:size-11",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
