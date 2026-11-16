// why: tuned per theme in styles.css; red, green and blue stay out because they mean failed, live and message
const PALETTE = ["purple", "pink", "teal", "plum", "lemon", "auburn", "yellow", "brown"];

function hash(key: string) {
  let value = 0;
  for (const char of key) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

export const colourToken = (key: string) => `--data-${PALETTE[hash(key) % PALETTE.length]}-color-emphasis`;

export const sessionColour = (key: string) => `var(${colourToken(key)})`;

let cacheKey = "";
const tokenCache = new Map<string, string>();

export function token(name: string) {
  const root = document.documentElement;
  const nextKey = `${root.className}|${root.dataset.colorMode ?? ""}`;
  if (nextKey !== cacheKey) {
    cacheKey = nextKey;
    tokenCache.clear();
  }
  let value = tokenCache.get(name);
  if (value === undefined) {
    value = getComputedStyle(root).getPropertyValue(name).trim();
    tokenCache.set(name, value);
  }
  return value;
}
