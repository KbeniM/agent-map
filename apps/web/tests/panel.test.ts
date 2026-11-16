import { describe, expect, test } from "bun:test";
import { clampPanelWidth } from "../src/stores/preferences";

describe("clampPanelWidth", () => {
  test("clamps panel width between 240, 60% of viewport, and 640", () => {
    expect(clampPanelWidth(120, 1280)).toBe(240);
    expect(clampPanelWidth(900, 1280)).toBe(640);
    expect(clampPanelWidth(500, 700)).toBe(420);
    expect(clampPanelWidth(380, 1280)).toBe(380);
  });
});
