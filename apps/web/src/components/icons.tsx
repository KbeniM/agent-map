import type { Provider } from "@agent-map/shared/providers";
import { cn } from "cn";
import { Bot } from "lucide-react";
import { isMonoLogo, providerSvg, toolIcon } from "@/lib/icons";

export function ProviderIcon({ provider, className }: { provider: Provider; className?: string }) {
  const svg = providerSvg(provider, "black");
  if (!svg) return <Bot aria-hidden className={cn("size-4 text-muted-foreground", className)} />;
  return (
    <img
      alt=""
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      className={cn("size-4 shrink-0", isMonoLogo(provider) && "dark:invert", className)}
    />
  );
}

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = toolIcon(name);
  return <Icon aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}
