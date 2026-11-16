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
    <div className="surface absolute top-4 right-4 flex h-12 items-center gap-2 rounded-xl px-2">
      <fieldset className="relative flex h-8 rounded-md border bg-control p-0.5 pointer-coarse:h-11" aria-label="View">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0.5 left-0.5 w-10 rounded-[5px] border bg-background shadow-[var(--shadow-resting-small)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
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
              "type-body relative w-10 rounded-md font-medium uppercase transition-[color,scale] duration-150 ease-out active:scale-[0.96]",
              view === option ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </fieldset>
      <Button size="icon" aria-label={`Theme: ${label}`} title={`Theme: ${label}`} onClick={() => setTheme(next)}>
        <HugeiconsIcon key={theme} icon={icon} className="animate-in fade-in spin-in-45 duration-300" />
      </Button>
    </div>
  );
}
