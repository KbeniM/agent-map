const hasWindow = typeof window !== "undefined";
// why: inside the desktop app the page is served by Tauri, so the bridge is the sidecar on loopback, not the page origin
const insideTauri = hasWindow && "__TAURI_INTERNALS__" in window;

export const DEFAULT_BRIDGE_URL =
  import.meta.env.VITE_BRIDGE_URL ||
  (insideTauri ? "http://127.0.0.1:4000" : hasWindow ? window.location.origin : "http://127.0.0.1:4000");
