/* Retro anime look for the 3D farm's characters: cel shading in three hard tones, an ink outline drawn as an
   inverted hull, and an anime face painted onto the farmer's head. Used when Settings → Character style is anime. */

import * as THREE from 'three';
import { lookToon, INK, light } from '../art/anime';
import type { Look } from '../first/data';

let gradient: THREE.DataTexture | null = null;
/** three hard light steps: shadow, mid, lit */
function toonGradient() {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

export const toonMat = (color: THREE.ColorRepresentation, map?: THREE.Texture) => new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...(map ? { map } : {}) });

const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/** Gives every mesh under `root` an ink outline: a slightly larger copy of it, drawn inside out in one flat colour.
   Each copy is scaled per axis so the line is about `t` thick whatever the part's size. Mark a mesh with
   userData.noOutline to skip it (the face decal, small eyes). */
export function addOutlines(root: THREE.Object3D, t = 0.022) {
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.noOutline && !m.userData.outline) meshes.push(m);
  });
  const size = new THREE.Vector3();
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    m.geometry.boundingBox!.getSize(size);
    const o = new THREE.Mesh(m.geometry, outlineMat);
    o.userData.outline = true;
    o.castShadow = false;
    o.receiveShadow = false;
    o.raycast = () => undefined;
    const axis = (len: number, s: number) => 1 + (2 * t) / Math.max(0.02, len * Math.abs(s));
    o.scale.set(axis(size.x, m.scale.x), axis(size.y, m.scale.y), axis(size.z, m.scale.z));
    m.add(o);
  }
}

/** The farmer's face, painted on a canvas: tall eyes with two highlights, brows, a small smile and hatched blush. */
function faceTexture(look: Look) {
  const t = lookToon(look);
  const W = 256;
  const H = 160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const iris = t.iris ?? '#5a3220';
  for (const side of [-1, 1]) {
    const cx = W / 2 + side * 40;
    const cy = 74;
    // white of the eye
    g.fillStyle = '#fffaf2';
    g.beginPath();
    g.ellipse(cx, cy, 20, 26, 0, 0, Math.PI * 2);
    g.fill();
    // iris, its lighter lower half, pupil
    g.fillStyle = iris;
    g.beginPath();
    g.ellipse(cx + side * 2, cy + 4, 15, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = light(iris, 0.45);
    g.beginPath();
    g.ellipse(cx + side * 2, cy + 13, 11, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(cx + side * 2, cy + 2, 7, 10, 0, 0, Math.PI * 2);
    g.fill();
    // two highlights, both from the top left
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(cx - 5, cy - 6, 6, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(cx + 7, cy + 13, 3, 0, Math.PI * 2);
    g.fill();
    // heavy upper lid with a flick, thin lower lash
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(cx - side * 24, cy + 2);
    g.quadraticCurveTo(cx, cy - 36, cx + side * 22, cy - 10);
    g.stroke();
    if (t.lashes) {
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(cx + side * 20, cy - 12);
      g.lineTo(cx + side * 30, cy - 20);
      g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - side * 14, cy + 25);
    g.quadraticCurveTo(cx, cy + 32, cx + side * 14, cy + 24);
    g.stroke();
    // brow
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx - side * 20, cy - 36);
    g.quadraticCurveTo(cx, cy - 46, cx + side * 20, cy - 38);
    g.stroke();
    // blush hatching
    g.strokeStyle = 'rgba(224,96,94,0.85)';
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = cx + side * 4 - 12 + i * 9;
      g.beginPath();
      g.moveTo(x, cy + 44);
      g.lineTo(x + 5, cy + 36);
      g.stroke();
    }
  }
  // mouth
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(W / 2 - 14, 132);
  g.quadraticCurveTo(W / 2, 142, W / 2 + 14, 132);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A thin shell over the front of a head of radius `r`, carrying the face. */
export function makeFace(look: Look, r: number) {
  const geo = new THREE.SphereGeometry(r * 1.015, 24, 16, Math.PI / 2 - 1.0, 2.0, 0.95, 1.3);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: faceTexture(look), transparent: true, depthWrite: false }));
  m.userData.noOutline = true;
  m.renderOrder = 2;
  return m;
}
