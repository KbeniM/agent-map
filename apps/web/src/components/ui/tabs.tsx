import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "mx-4 mt-3 mb-1 grid grid-flow-col auto-cols-fr items-center gap-1 rounded-xl border border-border/70 bg-secondary/75 p-1",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "flex h-8 pointer-coarse:h-10 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground data-active:bg-background/95 data-active:text-foreground data-active:shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
