import type { Object3D } from "three";

type Tween = { from: number; start: number; duration: number };

const tweens = new Map<Object3D, Tween>();
const pulses = new Set<Object3D>();
let running = false;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

function tick(now: number) {
  for (const [object, tween] of tweens) {
    const t = Math.min(1, (now - tween.start) / tween.duration);
    object.scale.setScalar(tween.from + (1 - tween.from) * easeOutExpo(t));
    if (t === 1) tweens.delete(object);
  }
  for (const object of pulses) {
    const base = object.userData.base as number;
    // why: about one breath per 1.4 s reads as activity without the slow 0.2 Hz sway that causes motion sickness
    const wave = (Math.sin((now / 1400) * Math.PI * 2) + 1) / 2;
    object.scale.setScalar(base * (1 + 0.35 * wave));
    const material = (object as Object3D & { material?: { opacity: number } }).material;
    if (material) material.opacity = 0.55 - 0.35 * wave;
  }
  running = tweens.size > 0 || pulses.size > 0;
  if (running) requestAnimationFrame(tick);
}

function run() {
  if (running) return;
  running = true;
  requestAnimationFrame(tick);
}

export function settle(object: Object3D, from: number, duration = 520) {
  if (reduced()) return;
  object.scale.setScalar(from);
  tweens.set(object, { from, start: performance.now(), duration });
  run();
}

export function pulse(object: Object3D) {
  if (reduced()) return;
  object.userData.base = object.scale.x;
  pulses.add(object);
  run();
}

export function release(object: Object3D) {
  object.traverse((child) => {
    tweens.delete(child);
    pulses.delete(child);
  });
}
