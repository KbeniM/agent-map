import {
  ComputerIcon,
  MaximizeScreenIcon,
  Moon02Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMapStore } from "@/stores/map";
import { type Theme, usePreferences, type View } from "@/stores/preferences";

const THEMES: Record<Theme, { next: Theme; icon: typeof Sun03Icon; label: string }> = {
  system: { next: "light", icon: ComputerIcon, label: "System" },
  light: { next: "dark", icon: Sun03Icon, label: "Light" },
  dark: { next: "system", icon: Moon02Icon, label: "Dark" },
};

const VIEWS: View[] = ["2d", "3d"];

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

export function MapControls() {
  const { theme, view, setTheme, setView } = usePreferences();
  const { paused, togglePause, fit, reheat } = useMapStore();
  const navigate = useNavigate();
  const { next, icon, label } = THEMES[theme];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        fit();
      } else if (event.code === "Space") {
        // why: avoid hijacking spacebar activation on focused buttons or switches
        if (document.activeElement instanceof HTMLButtonElement) return;
        event.preventDefault();
        togglePause();
      } else if (event.key === "Escape") {
        void navigate({ to: "/", search: {} });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fit, togglePause, navigate]);

  return (
    <div className="surface absolute top-0 right-0 z-10 flex h-10 items-stretch border-t-0 border-r-0 pointer-coarse:h-11">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-full w-10" aria-label="Fit graph" onClick={fit}>
            <HugeiconsIcon icon={MaximizeScreenIcon} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit graph (F)</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-full w-10" aria-label="Reset layout" onClick={reheat}>
            <HugeiconsIcon icon={RefreshIcon} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset layout</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-full w-10"
            aria-label={paused ? "Resume physics" : "Pause physics"}
            aria-pressed={paused}
            onClick={togglePause}
          >
            <HugeiconsIcon icon={paused ? PlayIcon : PauseIcon} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{paused ? "Resume physics (Space)" : "Pause physics (Space)"}</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" />
      <ButtonGroup aria-label="View" className="items-stretch">
        {VIEWS.map((option, index) => (
          <Fragment key={option}>
            {index > 0 && <Separator orientation="vertical" />}
            <Toggle
              variant="default"
              className="h-full px-4"
              pressed={view === option}
              onPressedChange={(pressed) => {
                if (pressed) setView(option);
              }}
            >
              {option}
            </Toggle>
          </Fragment>
        ))}
      </ButtonGroup>
      <Separator orientation="vertical" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-full w-10"
            aria-label={`Theme: ${label}`}
            onClick={() => setTheme(next)}
          >
            <HugeiconsIcon key={theme} icon={icon} className="animate-in fade-in spin-in-45 duration-300" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Theme: {label}</TooltipContent>
      </Tooltip>
    </div>
  );
}
