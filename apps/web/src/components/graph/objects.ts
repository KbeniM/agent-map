import type { IconSvgElement } from "@hugeicons/react";
import type { MapLink, MapNode } from "@rancher/shared/layout";
import * as THREE from "three";
import { AGENT_ICON, iconMarkup, isMonoLogo, providerSvg, toolIcon } from "@/lib/icons";
import type { Link, Node } from "./camera";
import { colourToken, token } from "./colour";
import { demandFrames } from "./demand";
import { pulse, release } from "./motion";
import {
  type CurveLike,
  endTrimDistance,
  type LinkColours,
  nodeRadius,
  RADIUS,
  trimCurveRange,
  trimStraightSpan,
  type Vec3,
} from "./projection";

export { RADIUS };

const noDispose = () => {};
const noRaycast = () => {};

const sphere = new THREE.SphereGeometry(1, 24, 18);
// why: three-forcegraph disposes child geometries on single-node removal, which would evict the shared sphere
sphere.dispose = noDispose;

const textures = new Map<string, THREE.Texture>();
const glyphs = new Map<IconSvgElement, string>();
const ballMaterials = new Map<string, THREE.MeshPhongMaterial>();
const glyphMaterials = new Map<string, THREE.SpriteMaterial>();
const linkMaterials = new Map<string, THREE.MeshLambertMaterial>();
const arrowMaterials = new Map<string, THREE.MeshLambertMaterial>();

function svgTexture(key: string, svg: string) {
  const cached = textures.get(key);
  if (cached) return cached;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  // why: a failed glyph leaves the sphere and label, and the next node retries the load
  const texture = new THREE.TextureLoader().load(url, undefined, undefined, () => textures.delete(key));
  texture.colorSpace = THREE.SRGBColorSpace;
  // why: shared across nodes, so three-forcegraph's single-node removal must not delete the WebGL texture
  texture.dispose = noDispose;
  textures.set(key, texture);
  return texture;
}

function glyph(icon: IconSvgElement) {
  let svg = glyphs.get(icon);
  if (!svg) {
    svg = iconMarkup(icon, 128, 1.75);
    glyphs.set(icon, svg);
  }
  return svg;
}

function haloTexture() {
  const cached = textures.get("halo");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context?.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient?.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient?.addColorStop(0.28, "rgba(255,255,255,0.4)");
  gradient?.addColorStop(0.6, "rgba(255,255,255,0.1)");
  gradient?.addColorStop(0.85, "rgba(255,255,255,0.02)");
  gradient?.addColorStop(1, "rgba(255,255,255,0)");
  if (context && gradient) {
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.dispose = noDispose;
  textures.set("halo", texture);
  return texture;
}

function ringTexture() {
  const cached = textures.get("ring");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(64, 64, 58, 0, Math.PI * 2);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.dispose = noDispose;
  textures.set("ring", texture);
  return texture;
}

function sprite(map: THREE.Texture, colour: string, size: number, dark: boolean, glow = false, opacity = 1) {
  let material: THREE.SpriteMaterial | undefined;
  if (glow) {
    material = new THREE.SpriteMaterial({
      map,
      color: colour,
      transparent: true,
      depthWrite: false,
      blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  } else {
    const key = `${map.id}|${colour}|${opacity}`;
    material = glyphMaterials.get(key);
    if (!material) {
      material = new THREE.SpriteMaterial({
        map,
        color: colour,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      material.dispose = noDispose;
      glyphMaterials.set(key, material);
    }
  }
  const object = new THREE.Sprite(material);
  object.scale.setScalar(size);
  // why: glyphs sit inside a translucent sphere and must draw after it to stay visible
  object.renderOrder = 1;
  // why: halos and rings extend past the node sphere and would hijack pointer raycasts
  object.raycast = noRaycast;
  return object;
}

function textSprite(text: string, colour: string, height: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Object3D();
  const dpr = 2;
  const font = "500 44px -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  context.font = font;
  const logicalWidth = Math.ceil(context.measureText(text).width) + 24;
  const logicalHeight = 64;
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  context.scale(dpr, dpr);
  context.font = font;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  // why: a halo in the background colour keeps labels readable where they cross links, like map labels
  context.strokeStyle = token("--graph-background");
  context.lineWidth = 5;
  context.strokeText(text, 12, 32);
  context.fillStyle = colour;
  context.fillText(text, 12, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const object = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  object.scale.set((height * logicalWidth) / logicalHeight, height, 1);
  object.renderOrder = 2;
  object.raycast = noRaycast;
  return object;
}

function ball(radius: number, colour: string, opacity: number) {
  const key = `${colour}|${opacity}`;
  let material = ballMaterials.get(key);
  if (!material) {
    material = new THREE.MeshPhongMaterial({
      color: colour,
      emissive: colour,
      emissiveIntensity: 0.22,
      specular: "#ffffff",
      shininess: 42,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    material.dispose = noDispose;
    ballMaterials.set(key, material);
  }
  const mesh = new THREE.Mesh(sphere, material);
  mesh.scale.setScalar(radius);
  return mesh;
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export type Look = {
  selected: boolean;
  dark: boolean;
  theme: string;
  hue: string;
  halos: boolean;
  showLabel: boolean;
};

const objectKey = (node: MapNode, look: Look) =>
  `${node.type}|${node.label}|${node.live}|${node.ok}|${node.provider}|${look.selected}|${look.theme}|${look.hue}|${look.halos}|${look.showLabel}`;

function populateTool(group: THREE.Group, node: MapNode, look: Look) {
  const { selected, dark, halos } = look;
  const colour = node.live
    ? token("--graph-particle")
    : node.ok === false
      ? token("--graph-tool-error")
      : token("--graph-tool");
  const radius = RADIUS.tool * (selected ? 1.4 : 1);
  group.add(ball(radius, colour, node.live ? 0.36 : 0.22));
  const svg = glyph(toolIcon(node.label));
  group.add(sprite(svgTexture(svg, svg), colour, radius * 1.1, dark));
  if (selected || (halos && node.live)) {
    const ringColour = selected ? token("--graph-label") : colour;
    group.add(sprite(ringTexture(), ringColour, radius * 2.4, dark, false, selected ? 0.85 : 0.55));
  }
  if (halos && node.live) {
    const halo = sprite(haloTexture(), colour, radius * 2.1, dark, true);
    group.add(halo);
    pulse(halo);
  }
}

function populateNode(group: THREE.Group, node: MapNode, look: Look) {
  group.userData.key = objectKey(node, look);
  if (node.type === "tool") return populateTool(group, node, look);
  const { selected, dark, hue, halos, showLabel } = look;
  const radius = RADIUS[node.type];
  const colour = token(colourToken(hue));
  group.add(ball(radius, colour, selected ? 0.48 : node.live ? 0.34 : 0.2));
  const provider = node.provider ?? "unknown";
  const logo = providerSvg(provider, "white");
  const tint = isMonoLogo(provider) ? token("--graph-label") : "white";
  const mark = logo
    ? sprite(svgTexture(`provider:${provider}`, logo), tint, radius * 1.15, dark)
    : sprite(svgTexture("agent", glyph(AGENT_ICON)), colour, radius * 1.15, dark);
  group.add(mark);
  if (selected || (halos && node.live)) {
    const ringColour = selected ? token("--graph-label") : colour;
    group.add(sprite(ringTexture(), ringColour, radius * 2.35, dark, false, selected ? 0.85 : 0.55));
  }
  if (halos && node.live) {
    const halo = sprite(haloTexture(), colour, radius * 1.9, dark, true);
    group.add(halo);
    pulse(halo);
  }
  if (showLabel) {
    const text = textSprite(shorten(node.label, 36), token("--graph-label"), node.type === "session" ? 3.2 : 2.4);
    text.position.y = -(radius * 1.3 + 2.8);
    group.add(text);
  }
}

export function nodeObject(node: MapNode, look: Look) {
  const group = new THREE.Group();
  populateNode(group, node, look);
  return group;
}

export function syncNodeObject(group: THREE.Object3D, node: MapNode, look: Look) {
  if (!(group instanceof THREE.Group)) return;
  if (group.userData.key === objectKey(node, look)) return;
  dispose(group);
  group.clear();
  populateNode(group, node, look);
}

function linkLabelSprite(link: MapLink) {
  const colour = link.type === "spawn" ? token("--graph-message") : token("--graph-label-muted");
  return textSprite(
    shorten(link.label ?? "", link.type === "spawn" ? 48 : 40),
    colour,
    link.type === "spawn" ? 2.4 : 2,
  );
}

const labelKey = (link: MapLink, theme: string) => `${link.type}|${link.label ?? ""}|${theme}`;

const connectorCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, false);
connectorCylinder.translate(0, 0.5, 0);
connectorCylinder.rotateX(Math.PI / 2);
// why: three-forcegraph disposes child geometries on single-link removal, which would evict the shared cylinder
connectorCylinder.dispose = noDispose;

const worldTarget = new THREE.Vector3();
const quantize = (value: number) => Math.round(value * 20);
const linkWidthFor = (link: MapLink, touched: boolean) => (touched ? 0.6 : link.type === "spawn" ? 0.5 : 0.25);
const linkColorFor = (link: MapLink, touched: boolean, colours: LinkColours) =>
  touched ? colours.focus : link.type === "spawn" ? colours.message : colours.link;

function cachedLambert(cache: Map<string, THREE.MeshLambertMaterial>, color: string, opacity: number) {
  const key = `${color}|${opacity}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    material.dispose = noDispose;
    cache.set(key, material);
  }
  return material;
}

export function linkObject(
  link: MapLink,
  labelVisible: boolean,
  colours: LinkColours & { theme: string },
  touched = false,
) {
  const group = new THREE.Group();
  const color = linkColorFor(link, touched, colours);
  const line = new THREE.Mesh(connectorCylinder, cachedLambert(linkMaterials, color, touched ? 0.92 : 0.55));
  // why: draw connector lines behind node spheres and provider icons so overlapping paths stay clean
  line.renderOrder = -1;
  line.visible = false;
  group.add(line);

  const labelGroup = new THREE.Group();
  const show = labelVisible && Boolean(link.label);
  labelGroup.visible = show;
  if (show && link.label) {
    labelGroup.add(linkLabelSprite(link));
    labelGroup.userData.labelKey = labelKey(link, colours.theme);
  }
  group.add(labelGroup);
  return group;
}

type CurvedLink = Link & { __curve?: CurveLike & { getPoint: (t: number) => Vec3 } };

export function linkMidpoint(
  link: Link,
  start: { x?: number; y?: number; z?: number },
  end: { x?: number; y?: number; z?: number },
) {
  const curve = (link as CurvedLink).__curve;
  if (curve) return curve.getPoint(0.5);
  return {
    x: ((start.x ?? 0) + (end.x ?? 0)) / 2,
    y: ((start.y ?? 0) + (end.y ?? 0)) / 2,
    z: ((start.z ?? 0) + (end.z ?? 0)) / 2,
  };
}

export type PlaceLinkOptions = { selectedId?: string; halos?: boolean; arrows: boolean; touched: boolean };

function resolveEndRadii(link: Link, selectedId: string | undefined, halos: boolean, arrows: boolean, curved: boolean) {
  const src = typeof link.source === "object" && link.source ? (link.source as Node) : undefined;
  const tgt = typeof link.target === "object" && link.target ? (link.target as Node) : undefined;
  const startR = src ? nodeRadius(src, selectedId, halos) : RADIUS.agent;
  const targetR = tgt ? nodeRadius(tgt, selectedId, halos) : RADIUS.agent;
  const endR = endTrimDistance(link, targetR, arrows, curved);
  return { startR, endR };
}

export function placeLinkObject(
  group: THREE.Object3D,
  link: Link,
  start: { x?: number; y?: number; z?: number },
  end: { x?: number; y?: number; z?: number },
  options: PlaceLinkOptions,
) {
  if (!(group instanceof THREE.Group) || group.children.length < 2) return;
  const line = group.children[0];
  const labelGroup = group.children[1];
  const s: Vec3 = { x: start.x ?? 0, y: start.y ?? 0, z: start.z ?? 0 };
  const e: Vec3 = { x: end.x ?? 0, y: end.y ?? 0, z: end.z ?? 0 };
  const curve = (link as CurvedLink).__curve;
  const { startR, endR } = resolveEndRadii(
    link,
    options.selectedId,
    options.halos ?? true,
    options.arrows,
    Boolean(curve),
  );
  const width = linkWidthFor(link, options.touched);

  if (line instanceof THREE.Mesh) {
    if (curve) {
      const range = trimCurveRange(curve, s, e, startR, endR);
      if (!range) {
        line.visible = false;
      } else {
        const [uStart, uEnd] = range;
        const tubeKey = `${quantize(s.x)},${quantize(s.y)},${quantize(s.z)}|${quantize(e.x)},${quantize(e.y)},${quantize(e.z)}|${startR.toFixed(2)}|${endR.toFixed(2)}|${width}`;
        if (line.userData.tubeKey !== tubeKey) {
          const steps = 20;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= steps; i++) {
            const p = curve.getPointAt(uStart + ((uEnd - uStart) * i) / steps);
            pts.push(new THREE.Vector3(p.x, p.y, p.z));
          }
          const nextGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, width / 2, 8, false);
          if (line.geometry !== connectorCylinder) line.geometry.dispose();
          line.geometry = nextGeo;
          line.userData.tubeKey = tubeKey;
        }
        line.position.set(0, 0, 0);
        line.rotation.set(0, 0, 0);
        line.scale.set(1, 1, 1);
        line.visible = true;
      }
    } else {
      if (line.geometry !== connectorCylinder) {
        line.geometry.dispose();
        line.geometry = connectorCylinder;
        line.userData.tubeKey = undefined;
      }
      const span = trimStraightSpan(s, e, startR, endR);
      if (!span) {
        line.visible = false;
      } else {
        line.position.set(span.from.x, span.from.y, span.from.z);
        line.scale.set(width, width, span.span);
        worldTarget.set(span.to.x, span.to.y, span.to.z);
        line.parent?.localToWorld(worldTarget);
        line.lookAt(worldTarget);
        line.visible = true;
      }
    }
  }

  if (labelGroup.visible) {
    const mid = linkMidpoint(link, s, e);
    labelGroup.position.set(mid.x, mid.y, mid.z);
  }
}

type ForceLinkObjects = Link & {
  __lineObj?: THREE.Object3D;
  __arrowObj?: THREE.Object3D;
  __photonsObj?: THREE.Object3D;
};

export function clipLinkParticles(links: Link[], selectedId: string | undefined, halos: boolean, arrows: boolean) {
  for (const link of links as ForceLinkObjects[]) {
    const photons = link.__photonsObj;
    if (!photons?.visible || photons.children.length === 0) continue;
    const src = link.source as Node;
    const tgt = link.target as Node;
    if (typeof src !== "object" || typeof tgt !== "object" || src.x === undefined || tgt.x === undefined) continue;
    const { startR, endR } = resolveEndRadii(link, selectedId, halos, arrows, Boolean((link as CurvedLink).__curve));
    const sx = src.x;
    const sy = src.y ?? 0;
    const sz = src.z ?? 0;
    const ex = tgt.x;
    const ey = tgt.y ?? 0;
    const ez = tgt.z ?? 0;
    const startLimit = (startR + 1.1) ** 2;
    const endLimit = (endR + 1.1) ** 2;
    for (const child of photons.children) {
      const px = child.position.x - sx;
      const py = child.position.y - sy;
      const pz = child.position.z - sz;
      const qx = child.position.x - ex;
      const qy = child.position.y - ey;
      const qz = child.position.z - ez;
      child.visible = px * px + py * py + pz * pz > startLimit && qx * qx + qy * qy + qz * qz > endLimit;
    }
  }
}

export function syncLinkObject(
  link: Link,
  touched: boolean,
  visible: boolean,
  colours: LinkColours & { theme: string },
  flowing: boolean,
  selectedId?: string,
  arrows = true,
  halos = true,
) {
  demandFrames();
  const raw = link as ForceLinkObjects;
  const lineObj = raw.__lineObj;
  if (lineObj instanceof THREE.Group && lineObj.children.length >= 2) {
    const line = lineObj.children[0];
    if (line instanceof THREE.Mesh) {
      line.renderOrder = -1;
      const color = linkColorFor(link, touched, colours);
      line.material = cachedLambert(linkMaterials, color, touched ? 0.92 : 0.55);
    }
    const labelGroup = lineObj.children[1];
    const show = visible && Boolean(link.label);
    labelGroup.visible = show;
    if (show && link.label) {
      const nextKey = labelKey(link, colours.theme);
      if (labelGroup.userData.labelKey !== nextKey) {
        dispose(labelGroup);
        labelGroup.clear();
        labelGroup.add(linkLabelSprite(link));
        labelGroup.userData.labelKey = nextKey;
      }
    }
    const start = link.source as Node;
    const end = link.target as Node;
    if (typeof start === "object" && typeof end === "object" && start.x !== undefined && end.x !== undefined) {
      placeLinkObject(lineObj, link, start, end, { selectedId, halos, arrows, touched });
    }
  }
  if (raw.__arrowObj instanceof THREE.Mesh) {
    raw.__arrowObj.renderOrder = 1;
    const arrowColor = linkColorFor(link, touched, colours);
    raw.__arrowObj.material = cachedLambert(arrowMaterials, arrowColor, touched ? 1 : Math.min(1, 0.55 * 3));
  }
  if (raw.__photonsObj) {
    raw.__photonsObj.visible = flowing && Boolean(link.live);
    return false;
  }
  return flowing && Boolean(link.live);
}

function dispose(object: THREE.Object3D) {
  release(object);
  const halo = textures.get("halo");
  const ring = textures.get("ring");
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite)) return;
    const material = child.material as THREE.SpriteMaterial;
    if (material.map instanceof THREE.CanvasTexture && material.map !== halo && material.map !== ring) {
      material.map.dispose();
    }
    material.dispose();
  });
}
