import { useSyncExternalStore } from "react";
import { usePreferences } from "@/stores/preferences";

const media = window.matchMedia("(prefers-color-scheme: dark)");

const resolved = () => {
  const { theme } = usePreferences.getState();
  return theme === "system" ? (media.matches ? "dark" : "light") : theme;
};

// why: the map reads colour tokens while it renders, so the class must flip before React re-renders, not in an effect
function apply() {
  const theme = resolved();
  const root = document.documentElement;
  // why: every color transition would fire at once during the swap, so transitions pause for one frame
  const pause = document.createElement("style");
  pause.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(pause);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  void getComputedStyle(root).opacity;
  requestAnimationFrame(() => pause.remove());
}

usePreferences.subscribe(apply);
media.addEventListener("change", apply);
apply();

function subscribe(onChange: () => void) {
  const unsubscribe = usePreferences.subscribe(onChange);
  media.addEventListener("change", onChange);
  return () => {
    unsubscribe();
    media.removeEventListener("change", onChange);
  };
}

export const useResolvedTheme = () => useSyncExternalStore(subscribe, resolved);
