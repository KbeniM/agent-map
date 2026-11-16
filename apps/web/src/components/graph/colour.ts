function sessionHue(sessionId: string) {
  let hash = 0;
  for (const char of sessionId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

export const sessionColour = (sessionId: string, lightness = "66%") =>
  `hsl(${sessionHue(sessionId)}, 70%, ${lightness})`;

export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
