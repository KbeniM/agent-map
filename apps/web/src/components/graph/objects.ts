import type { MapLink, MapNode } from "@agent-map/shared/layout";
import { Bot } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { isMonoLogo, providerSvg, toolIcon } from "@/lib/icons";
import { sessionColour, token } from "./colour";
import { pulse, release } from "./motion";

export const RADIUS = { session: 9, agent: 6, tool: 3 };

const sphere = new THREE.SphereGeometry(1, 32, 24);
const textures = new Map<string, THREE.Texture>();

function svgTexture(key: string, svg: string) {
  const cached = textures.get(key);
  if (cached) return cached;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // why: a failed glyph leaves the sphere and label, and the next node retries the load
  const texture = new THREE.TextureLoader().load(url, undefined, undefined, () => textures.delete(key));
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

const lucide = (icon: typeof Bot) =>
  renderToStaticMarkup(createElement(icon, { size: 128, color: "white", strokeWidth: 1.75 }));

function haloTexture() {
  const cached = textures.get("halo");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context?.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient?.addColorStop(0, "rgba(255,255,255,1)");
  gradient?.addColorStop(0.45, "rgba(255,255,255,0.35)");
  gradient?.addColorStop(1, "rgba(255,255,255,0)");
  if (context && gradient) {
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  textures.set("halo", texture);
  return texture;
}

function sprite(map: THREE.Texture, colour: string, size: number, dark: boolean, glow = false) {
  const material = new THREE.SpriteMaterial({
    map,
    color: colour,
    transparent: true,
    depthWrite: false,
    blending: glow && dark ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const object = new THREE.Sprite(material);
  object.scale.setScalar(size);
  // why: glyphs sit inside a translucent sphere and must draw after it to stay visible
  object.renderOrder = 1;
  return object;
}

function textSprite(text: string, colour: string, height: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Object3D();
  const font = "500 44px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + 24;
  canvas.height = 64;
  context.font = font;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  // why: a halo in the background colour keeps labels readable where they cross links, like map labels
  context.strokeStyle = token("--graph-background");
  context.lineWidth = 10;
  context.strokeText(text, 12, 32);
  context.fillStyle = colour;
  context.fillText(text, 12, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const object = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  object.scale.set((height * canvas.width) / canvas.height, height, 1);
  object.renderOrder = 2;
  return object;
}

function ball(radius: number, colour: string, opacity: number) {
  const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(sphere, material);
  mesh.scale.setScalar(radius);
  return mesh;
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const objectKey = (node: MapNode, selected: boolean, theme: string) =>
  `${node.type}|${node.label}|${node.live}|${node.ok}|${node.provider}|${selected}|${theme}`;

function toolObject(node: MapNode, selected: boolean, dark: boolean) {
  const group = new THREE.Group();
  const colour = node.live
    ? token("--graph-particle")
    : node.ok === false
      ? token("--graph-tool-error")
      : token("--graph-tool");
  const radius = RADIUS.tool * (selected ? 1.4 : 1);
  group.add(ball(radius, colour, node.live ? 0.35 : 0.2));
  const svg = lucide(toolIcon(node.label));
  group.add(sprite(svgTexture(svg, svg), colour, radius * 1.1, dark));
  if (node.live) {
    const halo = sprite(haloTexture(), colour, radius * 4, dark, true);
    group.add(halo);
    pulse(halo);
  }
  return group;
}

export function nodeObject(node: MapNode, selected: boolean, dark: boolean) {
  if (node.type === "tool") return toolObject(node, selected, dark);
  const group = new THREE.Group();
  const radius = RADIUS[node.type];
  const colour = sessionColour(node.sessionId, token("--graph-sphere-lightness"));
  group.add(ball(radius, colour, selected ? 0.5 : node.live ? 0.32 : 0.18));
  const provider = node.provider ?? "unknown";
  const logo = providerSvg(provider, "white");
  const tint = isMonoLogo(provider) ? token("--graph-label") : "white";
  const glyph = logo
    ? sprite(svgTexture(`provider:${provider}`, logo), tint, radius * 1.15, dark)
    : sprite(svgTexture("agent", lucide(Bot)), colour, radius * 1.15, dark);
  group.add(glyph);
  if (node.live) {
    const halo = sprite(haloTexture(), colour, radius * 3.2, dark, true);
    group.add(halo);
    pulse(halo);
  }
  const text = textSprite(shorten(node.label, 36), token("--graph-label"), node.type === "session" ? 5 : 3.8);
  text.position.y = -(radius + 4);
  group.add(text);
  return group;
}

export function linkObject(link: MapLink, visible: boolean) {
  if (!visible || !link.label) return new THREE.Object3D();
  const colour = link.type === "spawn" ? token("--graph-message") : token("--graph-label-muted");
  return textSprite(shorten(link.label, link.type === "spawn" ? 48 : 40), colour, link.type === "spawn" ? 3 : 2.4);
}

export function dispose(object: THREE.Object3D) {
  release(object);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite)) return;
    const material = child.material as THREE.SpriteMaterial;
    if (material.map instanceof THREE.CanvasTexture && material.map !== textures.get("halo")) material.map.dispose();
    material.dispose();
  });
}
