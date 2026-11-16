import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { type Theme, usePreferences, type View } from "@/stores/preferences";

const THEMES: Record<Theme, { next: Theme; icon: typeof Sun03Icon; label: string }> = {
  system: { next: "light", icon: ComputerIcon, label: "System" },
  light: { next: "dark", icon: Sun03Icon, label: "Light" },
  dark: { next: "system", icon: Moon02Icon, label: "Dark" },
};

const VIEWS: View[] = ["2d", "3d"];

export function MapControls() {
  const { theme, view, setTheme, setView } = usePreferences();
  const { next, icon, label } = THEMES[theme];

  return (
    <div className="surface absolute top-4 right-4 flex h-11 items-center gap-1.5 rounded-2xl px-1.5 pointer-coarse:h-13">
      <fieldset
        className="relative flex h-8 rounded-lg border border-border/60 bg-secondary/80 p-0.5 pointer-coarse:h-11"
        aria-label="View"
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0.5 left-0.5 w-10 rounded-md bg-elevated shadow-xs ring-1 ring-border/60 transition-transform duration-200 ease-[var(--ease-drawer)]",
            view === "3d" && "translate-x-10",
          )}
        />
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={cn(
              "type-caption relative w-10 rounded-md font-semibold uppercase transition-[color,scale] duration-150 ease-out active:scale-[0.96]",
              view === option ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </fieldset>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Theme: ${label}`}
        title={`Theme: ${label}`}
        onClick={() => setTheme(next)}
      >
        <HugeiconsIcon key={theme} icon={icon} className="animate-in fade-in spin-in-45 duration-300" />
      </Button>
    </div>
  );
}
