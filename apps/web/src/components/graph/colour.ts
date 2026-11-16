// why: Primer's data-visualisation palette is tuned per theme; red, green and blue stay out because they mean failed, live and message
const PALETTE = ["purple", "pink", "teal", "plum", "lemon", "auburn", "yellow", "brown"];

function hash(key: string) {
  let value = 0;
  for (const char of key) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

export const colourToken = (key: string) => `--data-${PALETTE[hash(key) % PALETTE.length]}-color-emphasis`;

export const sessionColour = (key: string) => `var(${colourToken(key)})`;

export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
