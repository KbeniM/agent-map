import { cn } from "cn";
import { Slider as SliderPrimitive } from "radix-ui";
import type * as React from "react";

function Slider({
  className,
  value,
  defaultValue,
  "aria-label": label,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbs = (value ?? defaultValue ?? [0]).length;
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      className={cn("relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1 grow overflow-hidden rounded-full bg-track"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-accent-emphasis" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbs }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={label}
          className="block size-4 rounded-full border border-[var(--fgColor-muted)] bg-knob pointer-coarse:size-6 shadow-[var(--shadow-resting-small)] transition-transform duration-[80ms] active:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
