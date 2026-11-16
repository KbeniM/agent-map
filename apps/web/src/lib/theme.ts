import { useSyncExternalStore } from "react";
import { usePreferences } from "@/stores/preferences";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const resolved = () => {
  const { theme } = usePreferences.getState();
  return theme === "system" ? (media.matches ? "dark" : "light") : theme;
};

let applied = "";
const listeners = new Set<() => void>();

// why: the map reads colour tokens while it renders, so React hears of a theme only after the class has flipped
function flip(theme: string) {
  const root = document.documentElement;
  // why: every color transition would fire at once during the swap, so transitions pause for one frame
  const pause = document.createElement("style");
  pause.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(pause);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  void getComputedStyle(root).opacity;
  requestAnimationFrame(() => pause.remove());
  applied = theme;
  for (const listener of listeners) listener();
}

function apply() {
  const theme = resolved();
  if (theme === applied) return;
  if (!applied || reduced.matches || !document.startViewTransition) return flip(theme);
  // why: a hard light/dark swap flashes the screen; the cross-fade's new page is live, so the map's later repaint lands inside it
  document.startViewTransition(() => flip(theme));
}

usePreferences.subscribe(apply);
media.addEventListener("change", apply);
apply();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export const useResolvedTheme = () => useSyncExternalStore(subscribe, () => applied);
