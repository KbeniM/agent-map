import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-[80ms] disabled:pointer-events-none disabled:opacity-50 enabled:active:not-aria-[haspopup]:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-border bg-control text-foreground shadow-[var(--button-default-shadow-resting)] hover:bg-control-hover aria-expanded:bg-control-hover",
        primary:
          "border-[var(--button-primary-borderColor-rest)] bg-[var(--button-primary-bgColor-rest)] text-[var(--button-primary-fgColor-rest)] hover:bg-[var(--button-primary-bgColor-hover)]",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-[var(--button-invisible-bgColor-hover)] aria-expanded:bg-[var(--button-invisible-bgColor-hover)]",
        destructive:
          "border-border bg-control text-[var(--button-danger-fgColor-rest)] hover:border-transparent hover:bg-[var(--button-danger-bgColor-hover)] hover:text-[var(--button-danger-fgColor-hover)]",
        link: "h-auto border-transparent px-0 text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 text-sm pointer-coarse:h-11",
        sm: "h-7 px-2 text-xs pointer-coarse:h-11 pointer-coarse:px-3",
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
