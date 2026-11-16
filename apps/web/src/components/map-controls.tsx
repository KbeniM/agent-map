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
    <div className="glass absolute top-4 right-4 flex items-center gap-1 rounded-full p-1">
      <fieldset className="relative flex rounded-full bg-secondary/60 p-0.5" aria-label="View">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0.5 left-0.5 w-10 rounded-full bg-card shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
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
              "type-caption relative w-10 rounded-full py-1 font-medium uppercase transition-colors active:scale-95",
              view === option ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </fieldset>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Theme: ${label}`}
        title={`Theme: ${label}`}
        onClick={() => setTheme(next)}
        className="active:scale-90"
      >
        <HugeiconsIcon key={theme} icon={icon} className="animate-in fade-in spin-in-45 duration-300" />
      </Button>
    </div>
  );
}
