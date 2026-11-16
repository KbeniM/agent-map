import { describe, expect, test } from "bun:test";
import { bindControls, panSpeedFor, syncPanSpeed } from "../src/components/graph/camera";

describe("panSpeedFor", () => {
  test("scales proportionally with camera fov, damping, and multiplier", () => {
    const defaultPan = panSpeedFor(50, 0.2);
    expect(defaultPan).toBeGreaterThan(0.2);
    expect(defaultPan).toBeLessThan(0.4);
    expect(panSpeedFor(70, 0.2)).toBeGreaterThan(defaultPan);
    expect(panSpeedFor(50, 0.4)).toBeCloseTo(defaultPan * 2, 5);
    expect(panSpeedFor(50, 0.2, 2.5)).toBeCloseTo(defaultPan * 2.5, 5);
  });
});

describe("bindControls", () => {
  test("calibrates panSpeed, syncs screen size via handleResize, and invokes onInteract on start", () => {
    const listeners = new Map<string, Set<() => void>>();
    let resized = 0;
    const controls = {
      panSpeed: 0.3,
      staticMoving: false,
      dynamicDampingFactor: 0.2,
      handleResize() {
        resized++;
      },
      addEventListener(type: string, fn: () => void) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)?.add(fn);
      },
      removeEventListener(type: string, fn: () => void) {
        listeners.get(type)?.delete(fn);
      },
    };
    let interacted = 0;
    const unbind = bindControls(controls as never, 50, () => {
      interacted++;
    });

    expect(controls.panSpeed).toBeCloseTo(panSpeedFor(50, 0.2), 5);
    expect(resized).toBe(1);
    for (const fn of listeners.get("start") ?? []) fn();
    expect(interacted).toBe(1);

    syncPanSpeed(controls as never, 50, 2);
    expect(controls.panSpeed).toBeCloseTo(panSpeedFor(50, 0.2, 2), 5);

    unbind();
    for (const fn of listeners.get("start") ?? []) fn();
    expect(interacted).toBe(1);
  });
});
