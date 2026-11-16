// why: the bridge serves the built app itself in production, so the page's own origin is the default bridge
export const DEFAULT_BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || window.location.origin;
