import { useSyncExternalStore } from "react";
import { usePreferences } from "@/stores/preferences";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const contrast = window.matchMedia("(prefers-contrast: more)");

const resolved = () => {
  const { theme } = usePreferences.getState();
  return theme === "system" ? (media.matches ? "dark" : "light") : theme;
};

// why: the map reads colour tokens while it renders, so the class must flip before React re-renders, not in an effect
function apply() {
  const theme = resolved();
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  // why: every color transition would fire at once during the swap, so transitions pause for one frame
  const pause = document.createElement("style");
  pause.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(pause);
  // why: Primer's theme files select on these attributes, the class drives Tailwind's dark variant
  const high = contrast.matches ? "_high_contrast" : "";
  root.dataset.colorMode = theme;
  root.dataset.lightTheme = `light${high}`;
  root.dataset.darkTheme = `dark${high}`;
  void getComputedStyle(root).opacity;
  requestAnimationFrame(() => pause.remove());
}

usePreferences.subscribe(apply);
media.addEventListener("change", apply);
contrast.addEventListener("change", apply);
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
