import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />;
}

// why: Primer's UnderlineNav: a bottom border with the active item marked by a coral underline
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex items-center gap-2 border-b", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group relative -mb-px flex h-12 items-center text-sm text-foreground transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors data-active:font-semibold data-active:after:bg-underline-active",
        className,
      )}
      {...props}
    >
      <span className="rounded-md px-2 py-1 transition-colors group-hover:bg-[var(--button-invisible-bgColor-hover)]">
        {props.children}
      </span>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
