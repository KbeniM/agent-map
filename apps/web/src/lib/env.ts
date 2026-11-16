const hasWindow = typeof window !== "undefined";
// why: in Tauri or Vite dev without VITE_BRIDGE_URL, the bridge listens on :4000 rather than the page origin
const separateBridge = (hasWindow && "__TAURI_INTERNALS__" in window) || import.meta.env.DEV || !hasWindow;

export const DEFAULT_BRIDGE_URL =
  import.meta.env.VITE_BRIDGE_URL || (separateBridge ? "http://127.0.0.1:4000" : window.location.origin);
