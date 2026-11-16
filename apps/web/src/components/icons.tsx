import type { Provider } from "@agent-map/shared/providers";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { AGENT_ICON, isMonoLogo, providerSvg, toolIcon } from "@/lib/icons";

export function ProviderIcon({ provider, className }: { provider: Provider; className?: string }) {
  const svg = providerSvg(provider, "black");
  if (!svg)
    return (
      <HugeiconsIcon
        icon={AGENT_ICON}
        size={16}
        aria-hidden
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
      />
    );
  return (
    <img
      alt=""
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      className={cn("size-4 shrink-0", isMonoLogo(provider) && "dark:invert", className)}
    />
  );
}

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  return (
    <HugeiconsIcon
      icon={toolIcon(name)}
      aria-hidden
      strokeWidth={1.75}
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
    />
  );
}
