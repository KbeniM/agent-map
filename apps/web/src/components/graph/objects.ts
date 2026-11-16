import type { MapNode } from "@agent-map/shared/layout";
import { Bot, SquareTerminal } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { sessionColour, token } from "./colour";

const RADIUS = { session: 9, agent: 6, tool: 2.2 };
const sphere = new THREE.SphereGeometry(1, 24, 16);
const icons = new Map<string, THREE.Texture>();

function icon(name: "session" | "agent") {
  const cached = icons.get(name);
  if (cached) return cached;
  const svg = renderToStaticMarkup(
    createElement(name === "session" ? SquareTerminal : Bot, { size: 128, color: "white", strokeWidth: 1.75 }),
  );
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // why: a failed glyph leaves the sphere and label, and the next node retries the load
  const texture = new THREE.TextureLoader().load(url, undefined, undefined, () => icons.delete(name));
  texture.colorSpace = THREE.SRGBColorSpace;
  icons.set(name, texture);
  return texture;
}

function label(text: string, colour: string, height: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Object3D();
  const font = "500 44px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + 16;
  canvas.height = 60;
  context.font = font;
  context.fillStyle = colour;
  context.textBaseline = "middle";
  context.fillText(text, 8, 30);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

function ball(radius: number, colour: string, opacity: number) {
  const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(sphere, material);
  mesh.scale.setScalar(radius);
  return mesh;
}

export const objectKey = (node: MapNode, selected: boolean) =>
  `${node.type}|${node.label}|${node.live}|${node.ok}|${selected}`;

export function nodeObject(node: MapNode, selected: boolean) {
  const group = new THREE.Group();
  if (node.type === "tool") {
    const colour = node.live
      ? token("--graph-particle")
      : node.ok === false
        ? token("--graph-tool-error")
        : token("--graph-tool");
    group.add(ball(RADIUS.tool * (selected ? 1.6 : 1), colour, node.live ? 1 : 0.75));
    return group;
  }
  const radius = RADIUS[node.type];
  const colour = sessionColour(node.sessionId);
  group.add(ball(radius, colour, selected ? 0.6 : node.live ? 0.4 : 0.22));
  const glyph = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: icon(node.type), color: colour, transparent: true, depthWrite: false }),
  );
  glyph.scale.setScalar(radius * 1.2);
  // why: the glyph sits inside a translucent sphere and must draw after it to stay visible
  glyph.renderOrder = 1;
  group.add(glyph);
  const short = node.label.length > 36 ? `${node.label.slice(0, 35)}…` : node.label;
  const text = label(short, token("--foreground"), node.type === "session" ? 5 : 3.8);
  text.position.y = -(radius + 4);
  group.add(text);
  return group;
}

export function dispose(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite)) return;
    const material = child.material as THREE.SpriteMaterial;
    if (material.map instanceof THREE.CanvasTexture) material.map.dispose();
    material.dispose();
  });
}
