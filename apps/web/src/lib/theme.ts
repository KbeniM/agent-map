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
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
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
