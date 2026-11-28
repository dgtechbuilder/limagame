/* The shop floor in 3D: the market stall's shop or the restaurant, seen from behind the counter. The farmer stands
   at the counter (and, in the restaurant, walks between the kitchen's stations); customers built like the farmer,
   each with something of their own (glasses, a backpack, headphones, a beanie…), walk in at the door, queue, order,
   sit and eat, and walk out with their bags or a takeaway box. The game (model.ts) says where everyone should be;
   the scene walks them there. Built from three.js primitives, as the farm is (world/models.ts). */

import * as THREE from 'three';
import type { Look } from '../first/data';
import type { ProduceId } from '../produce/model';
import { C, G, at, crate, jar, makeFarmer, merge, place, sack, setCharacterStyle, vcMaterial, type Farmer, type Part } from '../world/models';
import type { Extra, ShopKind, StationId } from './model';

export const SHOP_W = 874;
export const SHOP_H = 402;

/** The colour of each food, heaped in a crate, a bag or a pot. */
export const FOOD_COLOR: Record<ProduceId, string> = {
  maize: '#f2c230',
  drybeans: '#8a3b2a',
  sukuma: '#2f7d1f',
  spinach: '#3f8f2a',
  tomatoes: '#e0362b',
  capsicum: '#3aa856',
  cucumber: '#5c9e3a',
  strawberries: '#e0364a',
  chillies: '#c4161c',
  sauce: '#b8281f',
  jam: '#a3183a',
  chillisauce: '#d1401a',
  pickles: '#8aa83a',
  flour: '#f6efe0',
};

/* ---------------- where things are ---------------- */

/** The door, in the back wall on the left. */
const DOOR = { x: -4.4, z: -9.6 };
const OUTSIDE = { x: -4.4, z: -11.6 };
type Spot = { x: number; z: number };

/** Where everything stands in the room: the stall's counter is near the farmer, with the shelves behind; the
    restaurant's counter (the pass) is further back, so the kitchen's stations fit in a row behind the farmer. */
interface Layout {
  /** the counter across the room */
  counterZ: number;
  /** the queue, from the counter back toward the door */
  queue: Spot[];
  /** where a restaurant customer collects their food */
  pickup: Spot;
  /** the tables, and their seats (each with the way it faces) */
  tables: Spot[];
  seats: (Spot & { face: number })[];
  /** the kitchen's stations, behind the farmer */
  stations: Record<StationId, Spot>;
  /** where the farmer stands to serve */
  spot: Spot;
  /** the farmer at the counter faces the customer at the front of the queue, and they face the farmer */
  faceCustomer: number;
  faceFarmer: number;
}

function layoutOf(kind: ShopKind): Layout {
  const dz = kind === 'market' ? 0 : -1;
  const queue = [
    { x: -0.5, z: -2.15 },
    { x: -0.8, z: -3.25 },
    { x: -1.4, z: -4.3 },
    { x: -2.2, z: -5.3 },
    { x: -3.0, z: -6.3 },
    { x: -3.8, z: -7.4 },
  ].map((q, i) => ({ x: q.x, z: Math.max(-8.4, q.z + dz * (1 - i * 0.15)) }));
  const spot = kind === 'market' ? { x: 1.1, z: -0.3 } : { x: 0.9, z: -1.45 };
  // the restaurant has three tables (six seats: SHOP.seats); the stall's room keeps two
  const tables = kind === 'market' ? [
    { x: 3.4, z: -5.4 },
    { x: 3.4, z: -7.8 },
  ] : [
    { x: 3.4, z: -5.4 },
    { x: 3.4, z: -7.8 },
    { x: 0.2, z: -6.6 },
  ];
  return {
    counterZ: kind === 'market' ? -1.2 : -2.2,
    queue,
    pickup: { x: 1.0, z: queue[0].z },
    tables,
    seats: tables.flatMap(t => [
      { x: t.x - 0.85, z: t.z, face: Math.PI / 2 },
      { x: t.x + 0.85, z: t.z, face: -Math.PI / 2 },
    ]),
    stations: { pot: { x: -2.5, z: -0.15 }, pan: { x: -1.25, z: -0.15 }, board: { x: 0, z: -0.15 }, blender: { x: 1.2, z: -0.15 }, oven: { x: 2.45, z: -0.15 } },
    spot,
    faceCustomer: Math.atan2(queue[0].x - spot.x, queue[0].z - spot.z),
    faceFarmer: Math.atan2(spot.x - queue[0].x, spot.z - queue[0].z),
  };
}
/** The stall's shelves behind the farmer: where each food is kept. */
const SHELF_Z = 0.95;

export interface PatronView {
  id: number;
  look: Look;
  extra: Extra;
  kid: boolean;
  phase: 'enter' | 'queue' | 'order' | 'wait' | 'pickup' | 'eat' | 'leave' | 'gone';
  slot: number;
  seat: number | null;
  mood: 'happy' | 'ok' | 'upset' | null;
  carry: 'bag' | 'bags' | 'box' | 'plate' | null;
}

export interface StationView {
  state: 'empty' | 'working' | 'done' | 'over' | 'burnt';
  food: string | null;
}

export interface SceneView {
  patrons: PatronView[];
  /** where the farmer should be: the counter, a station, or the shelf with a food */
  farmer: { at: 'counter' | StationId | ProduceId; busy: boolean };
  stations: Record<StationId, StationView>;
  /** the stall's bags on the counter: how full each is, and the colours in them */
  bags: { kg: number; colors: string[] }[];
  /** a dish on the pass, waiting to be served */
  pass: ('plate' | 'box')[];
  /** the store, for the shelves */
  store: Partial<Record<ProduceId, number>>;
}

export interface Anchors {
  patrons: Record<number, { x: number; y: number }>;
  stations: Record<StationId, { x: number; y: number }>;
  bags: { x: number; y: number }[];
  farmer: { x: number; y: number };
}

interface Walker {
  f: Farmer;
  pos: THREE.Vector2;
  heading: number;
  walking: number;
  phase: PatronView['phase'];
  since: number;
  carry: Record<'bag' | 'bags' | 'box' | 'plate', THREE.Object3D>;
}

const tmp = new THREE.Vector3();

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(title: string, sub: string, color: string) {
  return canvasTexture(512, 160, g => {
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(6, 6, 500, 148, 28);
    g.fill();
    g.strokeStyle = '#fff6dc';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#fff6dc';
    g.textAlign = 'center';
    g.font = '900 64px system-ui, sans-serif';
    g.fillText(title, 256, 86);
    g.font = '700 30px system-ui, sans-serif';
    g.fillText(sub, 256, 132);
  });
}

function floorTexture(a: string, b: string) {
  const t = canvasTexture(256, 256, g => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? a : b;
        g.fillRect(i * 64, j * 64, 64, 64);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

function puff() {
  return canvasTexture(64, 64, g => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,0.95)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });
}

export class ShopScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, SHOP_W / SHOP_H, 0.1, 80);
  private raf = 0;
  private last = 0;
  private clock = 0;
  private farmer: Farmer;
  private L: Layout;
  private farmerPos: THREE.Vector2;
  private farmerHeading: number;
  private farmerWalk = 0;
  private walkers = new Map<number, Walker>();
  private view: SceneView | null = null;
  private stationParts: Record<StationId, { food: THREE.Mesh; glow?: THREE.Mesh; knife?: THREE.Object3D; jar?: THREE.Object3D; window?: THREE.MeshLambertMaterial }> = {} as never;
  private bagMeshes: { bag: THREE.Group; fill: THREE.Mesh[] }[] = [];
  private passItems: THREE.Object3D[] = [];
  private shelf: { id: ProduceId; heap: THREE.Mesh; base: THREE.Vector3 }[] = [];
  private puffs: { s: THREE.Sprite; at: StationId; t: number; life: number }[] = [];
  private puffTex = puff();
  private anchorsNow: Anchors = { patrons: {}, stations: {} as Anchors['stations'], bags: [], farmer: { x: 0, y: 0 } };
  /** a slower or faster clock for the walks (tests) */
  speed = 1;
  /** Settings → Reduce motion: no jumping for joy, less steam */
  private calm: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    private kind: ShopKind,
    look: Look,
    opts: { anime: boolean; low: boolean; reduceMotion: boolean },
  ) {
    setCharacterStyle(opts.anime);
    this.calm = opts.reduceMotion;
    this.L = layoutOf(kind);
    this.farmerPos = new THREE.Vector2(this.L.spot.x, this.L.spot.z);
    this.farmerHeading = this.L.faceCustomer;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.low });
    this.renderer.setPixelRatio(Math.min(opts.low ? 1 : 2, window.devicePixelRatio || 1));
    this.renderer.setSize(SHOP_W, SHOP_H, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !opts.low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(kind === 'market' ? '#f3d9a4' : '#f0c9a0');
    this.camera.position.set(0.2, 5.4, 4.6);
    this.camera.lookAt(0, 0.5, -3.4);

    const hemi = new THREE.HemisphereLight('#ffffff', '#c9a47a', 1.7);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff3dc', 1.9);
    sun.position.set(4, 10, 6);
    sun.target.position.set(0, 0, -3);
    sun.castShadow = !opts.low;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun, sun.target);

    this.buildRoom();
    if (kind === 'market') this.buildStall();
    else this.buildKitchen();

    this.farmer = makeFarmer(look);
    this.farmer.root.position.set(this.L.spot.x, 0, this.L.spot.z);
    // an apron over the farmer's clothes: they are at work
    const apron = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: kind === 'market' ? '#2f9a4a' : '#ffffff' }));
    apron.applyMatrix4(at(0, 0.86, 0.17, { sx: 0.42, sy: 0.5, sz: 0.06 }));
    this.farmer.body.add(apron);
    this.scene.add(this.farmer.root);

    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016);
      this.last = t;
      if (document.hidden) return;
      this.clock += dt;
      this.step(dt * this.speed);
      this.renderer.render(this.scene, this.camera);
      this.measure();
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    const shared = new Set<THREE.BufferGeometry>(Object.values(G));
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Sprite).isSprite) return;
      if (m.geometry && !shared.has(m.geometry)) m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        (mat as THREE.MeshBasicMaterial | undefined)?.map?.dispose();
        mat?.dispose();
      }
    });
    this.puffTex.dispose();
    this.renderer.dispose();
  }

  setView(v: SceneView) {
    this.view = v;
  }

  anchors(): Anchors {
    return this.anchorsNow;
  }

  /* ---------------- building ---------------- */

  private addStatic(parts: Part[], shadow = true) {
    const m = new THREE.Mesh(merge(parts), vcMaterial());
    m.receiveShadow = true;
    m.castShadow = shadow;
    this.scene.add(m);
    return m;
  }

  private buildRoom() {
    const market = this.kind === 'market';
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: floorTexture(market ? '#e8c48e' : '#d9d2c4', market ? '#d9ad6e' : '#b9b0a0') }));
    floor.position.set(0, 0, -3);
    floor.receiveShadow = true;
    this.scene.add(floor);
    const wall = market ? '#f6e6c6' : '#fbe3c4';
    const trim = market ? '#2f9a4a' : '#d9573c';
    const parts: Part[] = [
      // the back wall, with the door's opening on the left
      { geo: G.box, color: wall, m: at(1.6, 2, -10, { sx: 10.8, sy: 4, sz: 0.3 }) },
      { geo: G.box, color: wall, m: at(-6.3, 2, -10, { sx: 1.4, sy: 4, sz: 0.3 }) },
      { geo: G.box, color: wall, m: at(-4.4, 3.4, -10, { sx: 2.4, sy: 1.2, sz: 0.3 }) },
      // the door's frame
      { geo: G.box, color: C.woodDark, m: at(-5.5, 1.4, -9.84, { sx: 0.14, sy: 2.8, sz: 0.1 }) },
      { geo: G.box, color: C.woodDark, m: at(-3.3, 1.4, -9.84, { sx: 0.14, sy: 2.8, sz: 0.1 }) },
      { geo: G.box, color: C.woodDark, m: at(-4.4, 2.82, -9.84, { sx: 2.34, sy: 0.14, sz: 0.1 }) },
      // a doormat
      { geo: G.box, color: trim, m: at(-4.4, 0.01, -9.1, { sx: 1.8, sy: 0.02, sz: 0.9 }) },
      // the side walls
      { geo: G.box, color: wall, m: at(-7.2, 2, -3.5, { sx: 0.3, sy: 4, sz: 13 }) },
      { geo: G.box, color: wall, m: at(7.2, 2, -3.5, { sx: 0.3, sy: 4, sz: 13 }) },
      // a painted band along the walls
      { geo: G.box, color: trim, m: at(1.6, 0.4, -9.82, { sx: 10.8, sy: 0.8, sz: 0.06 }) },
      { geo: G.box, color: trim, m: at(-7.03, 0.4, -3.5, { sx: 0.06, sy: 0.8, sz: 13 }) },
      { geo: G.box, color: trim, m: at(7.03, 0.4, -3.5, { sx: 0.06, sy: 0.8, sz: 13 }) },
      // windows, and the sky through them
      { geo: G.box, color: C.woodDark, m: at(1.2, 2.3, -9.84, { sx: 2.2, sy: 1.5, sz: 0.08 }) },
      { geo: G.box, color: '#9fdcfb', m: at(1.2, 2.3, -9.8, { sx: 1.95, sy: 1.25, sz: 0.06 }) },
      { geo: G.box, color: C.woodDark, m: at(1.2, 2.3, -9.76, { sx: 0.08, sy: 1.25, sz: 0.04 }) },
      { geo: G.box, color: C.woodDark, m: at(5, 2.3, -9.84, { sx: 2.2, sy: 1.5, sz: 0.08 }) },
      { geo: G.box, color: '#9fdcfb', m: at(5, 2.3, -9.8, { sx: 1.95, sy: 1.25, sz: 0.06 }) },
      { geo: G.box, color: C.woodDark, m: at(5, 2.3, -9.76, { sx: 0.08, sy: 1.25, sz: 0.04 }) },
      // outside the door: the farm's grass and the lane
      { geo: G.box, color: C.grass, m: at(-4.4, -0.01, -12, { sx: 4, sy: 0.02, sz: 4 }) },
      { geo: G.box, color: C.path, m: at(-4.4, 0, -11.2, { sx: 1.4, sy: 0.02, sz: 2.4 }) },
    ];
    // plants in pots by the door
    for (const x of [-6.4, -2.6]) {
      parts.push({ geo: G.cyl, color: '#c0603a', m: at(x, 0.25, -9.4, { sx: 0.5, sy: 0.5, sz: 0.5 }) });
      parts.push({ geo: G.ico1, color: C.leaf, m: at(x, 0.8, -9.4, { sx: 0.8, sy: 0.9, sz: 0.8 }) });
    }
    this.addStatic(parts);
    // the shop's name over the door
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshBasicMaterial({ map: market ? signTexture('SOKO', 'TemoLima market', '#2f9a4a') : signTexture('MGAHAWA', 'TemoLima kitchen', '#d9573c'), transparent: true }));
    sign.position.set(-1.9, 3.35, -9.82);
    this.scene.add(sign);
  }

  /** The counter that runs across the shop, between the farmer and the customers. */
  private counter(top: string, front: string): Part[] {
    const z = this.L.counterZ;
    const out: Part[] = [
      { geo: G.box, color: front, m: at(0, 0.48, z, { sx: 6.2, sy: 0.96, sz: 0.8 }) },
      { geo: G.box, color: top, m: at(0, 1.0, z, { sx: 6.4, sy: 0.08, sz: 0.95 }) },
    ];
    for (let i = 0; i < 6; i++) out.push({ geo: G.box, color: i % 2 ? '#ffffff' : this.kind === 'market' ? '#e84a3a' : '#2f9a4a', m: at(-2.6 + i * 1.04, 0.62, z - 0.42, { sx: 1.04, sy: 0.24, sz: 0.02 }) });
    return out;
  }

  private buildStall() {
    const parts: Part[] = [...this.counter(C.woodPlank, '#a8703a')];
    // a weighing scale on the counter
    parts.push({ geo: G.box, color: '#d9d9d9', m: at(-2.2, 1.12, -1.2, { sx: 0.6, sy: 0.16, sz: 0.5 }) });
    parts.push({ geo: G.cyl, color: '#c4302b', m: at(-2.2, 1.38, -1.3, { sx: 0.4, sy: 0.4, sz: 0.06, rx: Math.PI / 2 }) });
    parts.push({ geo: G.cyl, color: '#ffffff', m: at(-2.2, 1.38, -1.34, { sx: 0.32, sy: 0.32, sz: 0.02, rx: Math.PI / 2 }) });
    parts.push({ geo: G.cyl6, color: '#9aa3a8', m: at(-2.2, 1.6, -1.2, { sx: 0.5, sy: 0.04, sz: 0.5 }) });
    // display crates on the front of the counter, for the customers to see
    const show: ProduceId[] = ['tomatoes', 'sukuma', 'maize', 'capsicum', 'drybeans', 'cucumber', 'strawberries'];
    show.forEach((id, i) => parts.push(...place(crate(FOOD_COLOR[id]), at(-2.85 + i * 0.95, 0.12, -2.0, { s: 1.6 }))));
    // sacks of grain and beans on the floor
    parts.push(...place(sack('#d8bd8a'), at(-5.6, 0, 1.0, { s: 1.6 })), ...place(sack('#d8bd8a'), at(-5.0, 0, 1.4, { s: 1.5 })), ...place(sack('#c9a05a'), at(5.4, 0, 1.2, { s: 1.6 })));
    // the shelves behind the farmer
    parts.push({ geo: G.box, color: C.woodDark, m: at(0, 0.45, SHELF_Z, { sx: 8.6, sy: 0.9, sz: 0.7 }) });
    parts.push({ geo: G.box, color: C.woodPlank, m: at(0, 0.92, SHELF_Z, { sx: 8.8, sy: 0.06, sz: 0.8 }) });
    this.addStatic(parts);
    // a crate on the shelf for every food: the heap in it shows what the store holds
    const ids = Object.keys(FOOD_COLOR) as ProduceId[];
    ids.forEach((id, i) => {
      const x = -4 + i * (8 / (ids.length - 1));
      const made = ['sauce', 'jam', 'chillisauce', 'pickles'].includes(id);
      if (made) this.addStatic(place([...jar(FOOD_COLOR[id], id === 'chillisauce' || id === 'sauce'), ...place(jar(FOOD_COLOR[id]), at(0.12, 0, 0.1))], at(x, 0.95, SHELF_Z, { s: 1.8 })));
      else this.addStatic(place(crate('#000000').slice(0, 2), at(x, 0.95, SHELF_Z, { s: 1.6 })));
      const heap = new THREE.Mesh(G.sphere, new THREE.MeshLambertMaterial({ color: FOOD_COLOR[id] }));
      const base = new THREE.Vector3(x, made ? 1.2 : 1.2, SHELF_Z);
      heap.position.copy(base);
      heap.scale.set(0.48, 0.16, 0.36);
      heap.visible = !made;
      this.scene.add(heap);
      this.shelf.push({ id, heap, base });
    });
    // the bags on the counter
    for (let i = 0; i < 2; i++) {
      const bag = new THREE.Group();
      const paper = new THREE.MeshLambertMaterial({ color: i ? '#cfa36a' : '#e2bb83' });
      const b = new THREE.Mesh(G.box, paper);
      b.applyMatrix4(at(0, 0.3, 0, { sx: 0.5, sy: 0.6, sz: 0.34 }));
      b.castShadow = true;
      bag.add(b);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 4, 10, Math.PI), paper);
      handle.position.set(0, 0.6, 0);
      bag.add(handle);
      const fill: THREE.Mesh[] = [];
      for (let k = 0; k < 3; k++) {
        const f = new THREE.Mesh(G.sphere, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
        f.position.set(-0.12 + k * 0.12, 0.6, (k % 2) * 0.06 - 0.03);
        f.scale.set(0.2, 0.2, 0.2);
        f.visible = false;
        bag.add(f);
        fill.push(f);
      }
      bag.position.set(2.2 + i * 0.75, 1.04, -1.15);
      this.scene.add(bag);
      this.bagMeshes.push({ bag, fill });
    }
  }

  private buildKitchen() {
    const parts: Part[] = [...this.counter('#e9e3d6', '#8b5a2b')];
    // a stack of plates and takeaway boxes at the end of the pass
    const cz = this.L.counterZ;
    for (let i = 0; i < 5; i++) parts.push({ geo: G.cyl, color: '#ffffff', m: at(-2.6, 1.07 + i * 0.04, cz, { sx: 0.42, sy: 0.03, sz: 0.42 }) });
    for (let i = 0; i < 3; i++) parts.push({ geo: G.box, color: '#f4f1e8', m: at(2.65, 1.1 + i * 0.13, cz, { sx: 0.4, sy: 0.12, sz: 0.3 }) });
    // the menu board on the back wall
    parts.push({ geo: G.box, color: '#2b3a2f', m: at(3.4, 2.2, -9.8, { sx: 0.1, sy: 0.1, sz: 0.1 }) });
    // the kitchen's worktop, behind the farmer
    const wz = this.L.stations.board.z;
    parts.push({ geo: G.box, color: '#8b5a2b', m: at(0, 0.44, wz, { sx: 6.6, sy: 0.88, sz: 0.8 }) });
    parts.push({ geo: G.box, color: '#d9d2c4', m: at(0, 0.9, wz, { sx: 6.8, sy: 0.06, sz: 0.9 }) });
    // the tables and stools for customers
    for (const t of this.L.tables) {
      parts.push({ geo: G.cyl, color: C.woodPlank, m: at(t.x, 0.78, t.z, { sx: 1.3, sy: 0.08, sz: 1.3 }) });
      parts.push({ geo: G.cyl6, color: C.woodDark, m: at(t.x, 0.38, t.z, { sx: 0.16, sy: 0.76, sz: 0.16 }) });
      parts.push({ geo: G.cyl, color: '#e84a3a', m: at(t.x, 0.83, t.z, { sx: 0.9, sy: 0.01, sz: 0.9 }) });
      for (const dx of [-0.85, 0.85]) {
        parts.push({ geo: G.cyl, color: '#2f9a4a', m: at(t.x + dx, 0.48, t.z, { sx: 0.5, sy: 0.08, sz: 0.5 }) });
        parts.push({ geo: G.cyl6, color: C.woodDark, m: at(t.x + dx, 0.24, t.z, { sx: 0.1, sy: 0.48, sz: 0.1 }) });
      }
    }
    // pots hanging on the wall, and a sack of maize flour by the jiko
    parts.push(...place(sack('#f6efe0'), at(-5.0, 0, 1.4, { s: 1.6 })), ...place(sack('#d8bd8a'), at(5.0, 0, 1.4, { s: 1.6 })));
    this.addStatic(parts);
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ map: signTexture('MENU', 'ugali · githeri · stew', '#2b3a2f') }));
    menu.position.set(4.4, 3.4, -9.82);
    this.scene.add(menu);

    const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c });
    const top = 0.93;
    const food = (x: number, y: number, z: number, s: number) => {
      const f = new THREE.Mesh(G.sphere, mat('#ffffff'));
      f.position.set(x, y, z);
      f.scale.set(s, s * 0.45, s);
      f.visible = false;
      this.scene.add(f);
      return f;
    };
    const add = (parts: Part[], x: number, z: number) => {
      const m = this.addStatic(place(parts, at(x, top, z)));
      return m;
    };
    // the jiko: a charcoal stove with a sufuria (pot) on it
    {
      const { x, z } = this.L.stations.pot;
      add(
        [
          { geo: G.cyl, color: '#3a3a3a', m: at(0, 0.18, 0, { sx: 0.7, sy: 0.36, sz: 0.7 }) },
          { geo: G.cyl, color: '#5a5f66', m: at(0, 0.38, 0, { sx: 0.8, sy: 0.05, sz: 0.8 }) },
          { geo: G.cyl, color: '#c9d1d6', m: at(0, 0.62, 0, { sx: 0.7, sy: 0.44, sz: 0.7 }) },
          { geo: G.box, color: '#9aa3a8', m: at(0.44, 0.74, 0, { sx: 0.2, sy: 0.05, sz: 0.06 }) },
          { geo: G.box, color: '#9aa3a8', m: at(-0.44, 0.74, 0, { sx: 0.2, sy: 0.05, sz: 0.06 }) },
        ],
        x,
        z,
      );
      const glow = new THREE.Mesh(G.cyl, new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0 }));
      glow.applyMatrix4(at(x, top + 0.2, z + 0.36, { sx: 0.36, sy: 0.16, sz: 0.02 }));
      this.scene.add(glow);
      this.stationParts.pot = { food: food(x, top + 0.84, z, 0.56), glow };
    }
    // the stove with a frying pan
    {
      const { x, z } = this.L.stations.pan;
      add(
        [
          { geo: G.box, color: '#e9e3d6', m: at(0, 0.06, 0, { sx: 1.0, sy: 0.12, sz: 0.66 }) },
          { geo: G.cyl, color: '#2a2a2a', m: at(0, 0.14, 0, { sx: 0.5, sy: 0.04, sz: 0.5 }) },
          { geo: G.cyl, color: '#3a3a3a', m: at(0, 0.22, 0, { sx: 0.64, sy: 0.08, sz: 0.64 }) },
          { geo: G.box, color: '#3a3a3a', m: at(0.5, 0.24, 0, { sx: 0.5, sy: 0.05, sz: 0.08 }) },
          { geo: G.cyl6, color: '#c4302b', m: at(-0.38, 0.12, 0.3, { sx: 0.08, sy: 0.06, sz: 0.08, rx: Math.PI / 2 }) },
        ],
        x,
        z,
      );
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), new THREE.MeshBasicMaterial({ color: '#3fa0ff', transparent: true, opacity: 0 }));
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, top + 0.15, z);
      this.scene.add(glow);
      this.stationParts.pan = { food: food(x, top + 0.29, z, 0.48), glow };
    }
    // the chopping board and knife
    {
      const { x, z } = this.L.stations.board;
      add([{ geo: G.box, color: '#e8c99a', m: at(0, 0.03, 0, { sx: 0.9, sy: 0.06, sz: 0.55 }) }], x, z);
      const knife = new THREE.Group();
      const blade = new THREE.Mesh(G.box, mat('#d9dfe3'));
      blade.applyMatrix4(at(0.12, 0, 0, { sx: 0.34, sy: 0.02, sz: 0.08 }));
      const grip = new THREE.Mesh(G.box, mat('#3a2418'));
      grip.applyMatrix4(at(-0.12, 0, 0, { sx: 0.16, sy: 0.04, sz: 0.06 }));
      knife.add(blade, grip);
      knife.position.set(x + 0.3, top + 0.12, z + 0.15);
      this.scene.add(knife);
      this.stationParts.board = { food: food(x - 0.1, top + 0.08, z, 0.42), knife };
    }
    // the blender
    {
      const { x, z } = this.L.stations.blender;
      add(
        [
          { geo: G.box, color: '#e84a3a', m: at(0, 0.12, 0, { sx: 0.4, sy: 0.24, sz: 0.4 }) },
          { geo: G.box, color: '#ffffff', m: at(0, 0.2, 0.205, { sx: 0.14, sy: 0.06, sz: 0.01 }) },
        ],
        x,
        z,
      );
      const jarG = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.5, 12), new THREE.MeshLambertMaterial({ color: '#dff3ff', transparent: true, opacity: 0.55 }));
      glass.position.y = 0.25;
      const lid = new THREE.Mesh(G.cyl, mat('#3a3a3a'));
      lid.applyMatrix4(at(0, 0.52, 0, { sx: 0.36, sy: 0.05, sz: 0.36 }));
      jarG.add(glass, lid);
      jarG.position.set(x, top + 0.24, z);
      this.scene.add(jarG);
      const f = food(x, top + 0.4, z, 0.26);
      f.scale.set(0.28, 0.3, 0.28);
      this.stationParts.blender = { food: f, jar: jarG };
    }
    // the oven: a box with a glass door that glows when it bakes
    {
      const { x, z } = this.L.stations.oven;
      const win = new THREE.MeshLambertMaterial({ color: '#3a3a3a', emissive: '#000000' });
      add(
        [
          { geo: G.box, color: '#e9e3d6', m: at(0, 0.36, 0, { sx: 1.1, sy: 0.72, sz: 0.7 }) },
          { geo: G.box, color: '#c9d1d6', m: at(0, 0.62, -0.36, { sx: 1.0, sy: 0.08, sz: 0.04 }) },
          { geo: G.box, color: '#5a5f66', m: at(0, 0.64, -0.38, { sx: 0.7, sy: 0.03, sz: 0.03 }) },
          { geo: G.cyl, color: '#3a3a3a', m: at(-0.35, 0.82, 0, { sx: 0.12, sy: 0.04, sz: 0.12 }) },
          { geo: G.cyl, color: '#3a3a3a', m: at(0.35, 0.82, 0, { sx: 0.12, sy: 0.04, sz: 0.12 }) },
        ],
        x,
        z,
      );
      // its door faces the farmer, toward the customers (-z): a window in it
      const w = new THREE.Mesh(G.box, win);
      w.applyMatrix4(at(x, top + 0.34, z - 0.36, { sx: 0.76, sy: 0.4, sz: 0.02 }));
      this.scene.add(w);
      this.stationParts.oven = { food: food(x, top + 0.3, z, 0.4), window: win };
      this.stationParts.oven.food.visible = false;
    }
  }

  /* ---------------- people ---------------- */

  private dress(f: Farmer, extra: Extra, look: Look) {
    const m = (c: string) => new THREE.MeshLambertMaterial({ color: c });
    const Y = 1.46;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, mx: THREE.Matrix4) => {
      const o = new THREE.Mesh(geo, mat);
      o.applyMatrix4(mx);
      o.castShadow = true;
      f.body.add(o);
    };
    const dark = m('#1d1d1d');
    if (extra === 'glasses' || extra === 'shades') {
      const lens = extra === 'shades' ? dark : new THREE.MeshLambertMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.5 });
      for (const x of [-0.1, 0.1]) add(G.box, lens, at(x, Y + 0.02, 0.255, { sx: 0.14, sy: 0.09, sz: 0.02 }));
      add(G.box, dark, at(0, Y + 0.05, 0.262, { sx: 0.36, sy: 0.02, sz: 0.02 }));
    } else if (extra === 'backpack') {
      add(G.box, m(look.trim === '#f4f1e8' ? '#e84a3a' : look.trim), at(0, 1.0, -0.3, { sx: 0.42, sy: 0.5, sz: 0.2 }));
      add(G.box, m('#2c2c2c'), at(0, 0.88, -0.41, { sx: 0.3, sy: 0.16, sz: 0.04 }));
    } else if (extra === 'headphones') {
      add(new THREE.TorusGeometry(0.29, 0.03, 6, 16, Math.PI), m('#2c2c2c'), at(0, Y + 0.02, 0, {}));
      for (const x of [-0.28, 0.28]) add(G.cyl, m('#e84a3a'), at(x, Y, 0, { sx: 0.14, sy: 0.08, sz: 0.14, rz: Math.PI / 2 }));
    } else if (extra === 'beanie') {
      add(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(look.outfit), at(0, Y + 0.08, 0, { s: 0.56 }));
      add(G.cyl, m(look.trim), at(0, Y + 0.1, 0, { sx: 0.57, sy: 0.07, sz: 0.57 }));
      add(G.sphere, m(look.trim), at(0, Y + 0.38, 0, { s: 0.12 }));
    } else if (extra === 'bucket') {
      add(G.cyl, m('#f2c14e'), at(0, Y + 0.16, 0, { sx: 0.8, sy: 0.03, sz: 0.8 }));
      add(new THREE.CylinderGeometry(0.22, 0.27, 0.2, 14), m('#f2c14e'), at(0, Y + 0.27, 0));
    } else if (extra === 'bow') {
      add(G.cone6, m('#e85d9a'), at(-0.08, Y + 0.3, 0, { sx: 0.14, sy: 0.16, sz: 0.08, rz: -Math.PI / 2 }));
      add(G.cone6, m('#e85d9a'), at(0.08, Y + 0.3, 0, { sx: 0.14, sy: 0.16, sz: 0.08, rz: Math.PI / 2 }));
      add(G.sphere, m('#c2185b'), at(0, Y + 0.3, 0, { s: 0.07 }));
    } else if (extra === 'scarf') {
      add(new THREE.TorusGeometry(0.17, 0.06, 6, 14), m(look.trim === '#2c2c2c' ? '#e0a21b' : look.trim), at(0, 1.24, 0, { rx: Math.PI / 2 }));
      add(G.box, m(look.trim === '#2c2c2c' ? '#e0a21b' : look.trim), at(0.1, 1.08, 0.18, { sx: 0.09, sy: 0.28, sz: 0.04 }));
    }
  }

  private carryItems(f: Farmer) {
    const m = (c: string) => new THREE.MeshLambertMaterial({ color: c });
    const g = (build: (o: THREE.Group) => void) => {
      const o = new THREE.Group();
      build(o);
      o.visible = false;
      f.hand.add(o);
      return o;
    };
    const paperBag = (o: THREE.Group, x: number, c: string) => {
      const b = new THREE.Mesh(G.box, m(c));
      b.applyMatrix4(at(x, -0.2, 0.05, { sx: 0.28, sy: 0.34, sz: 0.2 }));
      o.add(b);
      const top = new THREE.Mesh(G.sphere, m('#3aa856'));
      top.applyMatrix4(at(x, -0.03, 0.05, { sx: 0.2, sy: 0.1, sz: 0.14 }));
      o.add(top);
    };
    return {
      bag: g(o => paperBag(o, 0, '#e2bb83')),
      bags: g(o => {
        paperBag(o, -0.08, '#e2bb83');
        paperBag(o, 0.2, '#cfa36a');
      }),
      box: g(o => {
        const b = new THREE.Mesh(G.box, m('#f4f1e8'));
        b.applyMatrix4(at(0, -0.06, 0.12, { sx: 0.34, sy: 0.14, sz: 0.26 }));
        const band = new THREE.Mesh(G.box, m('#2f9a4a'));
        band.applyMatrix4(at(0, -0.06, 0.12, { sx: 0.35, sy: 0.04, sz: 0.27 }));
        o.add(b, band);
      }),
      plate: g(o => {
        const p = new THREE.Mesh(G.cyl, m('#ffffff'));
        p.applyMatrix4(at(0, 0, 0.16, { sx: 0.36, sy: 0.03, sz: 0.36 }));
        const f = new THREE.Mesh(G.sphere, m('#f3ead2'));
        f.applyMatrix4(at(-0.05, 0.04, 0.16, { sx: 0.16, sy: 0.08, sz: 0.16 }));
        const g2 = new THREE.Mesh(G.sphere, m('#3f8a2a'));
        g2.applyMatrix4(at(0.07, 0.03, 0.2, { sx: 0.14, sy: 0.06, sz: 0.12 }));
        o.add(p, f, g2);
      }),
    };
  }

  private walker(p: PatronView): Walker {
    const f = makeFarmer(p.look);
    this.dress(f, p.extra, p.look);
    if (p.kid) f.root.scale.setScalar(0.76);
    f.root.position.set(OUTSIDE.x, 0, OUTSIDE.z);
    this.scene.add(f.root);
    return { f, pos: new THREE.Vector2(OUTSIDE.x, OUTSIDE.z), heading: 0, walking: 0, phase: p.phase, since: 0, carry: this.carryItems(f) };
  }

  /** Where a customer should be now, and which way they face when they get there. */
  private targetOf(p: PatronView, w: Walker): { x: number; z: number; face: number; via?: { x: number; z: number } } {
    // at the restaurant a customer walks in through the door to their table, and sits there to order
    if (p.seat !== null && (p.phase === 'enter' || p.phase === 'order') && this.L.seats[p.seat]) {
      const s = this.L.seats[p.seat];
      return { x: s.x, z: s.z, face: s.face, via: w.pos.y < DOOR.z - 0.05 ? DOOR : undefined };
    }
    switch (p.phase) {
      case 'enter':
      case 'queue':
      case 'order': {
        const q = this.L.queue[Math.min(Math.max(0, p.slot), this.L.queue.length - 1)];
        // through the door first
        return { ...q, face: p.slot === 0 ? this.L.faceFarmer : 0, via: w.pos.y < DOOR.z - 0.05 ? DOOR : undefined };
      }
      case 'wait':
      case 'eat': {
        const s = p.seat !== null ? this.L.seats[p.seat] : { x: 1.6, z: this.L.counterZ - 2.4 + (p.id % 3) * -0.9, face: 0 };
        return { x: s.x, z: s.z, face: s.face };
      }
      case 'pickup':
        return { ...this.L.pickup, face: Math.PI * 0.15 };
      default:
        return { x: OUTSIDE.x, z: OUTSIDE.z, face: Math.PI, via: w.pos.y > DOOR.z + 0.4 ? DOOR : undefined };
    }
  }

  /* ---------------- each frame ---------------- */

  private step(dt: number) {
    const v = this.view;
    if (!v) return;
    const t = this.clock;
    // customers: new ones at the door, the rest walked toward where the game wants them
    const seen = new Set<number>();
    for (const p of v.patrons) {
      if (p.phase === 'gone') continue;
      seen.add(p.id);
      let w = this.walkers.get(p.id);
      if (!w) {
        w = this.walker(p);
        this.walkers.set(p.id, w);
      }
      if (w.phase !== p.phase) {
        w.phase = p.phase;
        w.since = 0;
      }
      w.since += dt;
      const tg = this.targetOf(p, w);
      const aim = tg.via ?? tg;
      const dx = aim.x - w.pos.x;
      const dz = aim.z - w.pos.y;
      const d = Math.hypot(dx, dz);
      const speed = 2.6;
      if (d > 0.05) {
        const s = Math.min(d, speed * dt);
        w.pos.x += (dx / d) * s;
        w.pos.y += (dz / d) * s;
        w.heading = Math.atan2(dx, dz);
        w.walking = Math.min(1, w.walking + dt * 6);
      } else {
        w.walking = Math.max(0, w.walking - dt * 6);
        if (!tg.via) w.heading = tg.face;
      }
      this.pose(w, p, dt, t);
    }
    for (const [id, w] of this.walkers) {
      if (seen.has(id)) continue;
      this.scene.remove(w.f.root);
      this.walkers.delete(id);
    }
    this.moveFarmer(v, dt, t);
    if (this.kind === 'market') this.drawStall(v);
    else this.drawKitchen(v, dt, t);
  }

  private pose(w: Walker, p: PatronView, dt: number, t: number) {
    const F = w.f;
    F.root.position.set(w.pos.x, 0, w.pos.y);
    let d = w.heading - F.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    F.root.rotation.y += d * Math.min(1, dt * 10);
    const sitting = (p.phase === 'wait' || p.phase === 'eat' || p.phase === 'order') && p.seat !== null && w.walking < 0.1;
    const sw = Math.sin(t * 10 + p.id) * 0.7 * w.walking;
    F.legL.rotation.x = sitting ? -1.45 : sw;
    F.legR.rotation.x = sitting ? -1.45 : -sw;
    F.armL.rotation.x = -sw * 0.8;
    F.armR.rotation.x = sw * 0.8;
    F.body.position.y = sitting ? -0.24 : Math.abs(Math.sin(t * 10 + p.id)) * 0.06 * w.walking;
    F.body.rotation.z = 0;
    // a happy customer jumps for joy on the way out; an upset one shakes their head and stomps
    if (p.phase === 'leave' && w.since < 1.2 && !this.calm) {
      if (p.mood === 'happy') {
        F.body.position.y = Math.abs(Math.sin(w.since * 9)) * 0.35;
        F.armL.rotation.x = F.armR.rotation.x = -2.6;
      } else if (p.mood === 'upset') F.body.rotation.z = Math.sin(w.since * 22) * 0.12;
    }
    // waiting at the counter, they shift from foot to foot; eating, they lift a hand to the mouth
    if (p.phase === 'order' && w.walking < 0.1) F.body.rotation.z = Math.sin(t * 2 + p.id) * 0.04;
    if (p.phase === 'eat' && w.walking < 0.1) F.armR.rotation.x = -1.6 + Math.sin(t * 6) * 0.4;
    // impatient: arms crossed, tapping
    if ((p.phase === 'order' || p.phase === 'wait') && w.walking < 0.1 && w.since > 20) F.armL.rotation.x = -0.6 + Math.sin(t * 8) * 0.1;
    for (const [k, o] of Object.entries(w.carry)) o.visible = p.carry === k && (p.phase === 'leave' || p.phase === 'eat' || (p.phase === 'pickup' && w.since > 0.6));
    if (p.carry === 'plate' && p.phase === 'eat') F.armR.rotation.x = -1.2;
  }

  private farmerTarget(v: SceneView): { x: number; z: number; face: number } {
    const a = v.farmer.at;
    if (a === 'counter') return { ...this.L.spot, face: this.L.faceCustomer };
    if (a in this.L.stations) {
      const s = this.L.stations[a as StationId];
      return { x: s.x, z: s.z - 0.75, face: 0 };
    }
    const sh = this.shelf.find(x => x.id === a);
    if (sh) return { x: Math.max(-1.6, Math.min(3.0, sh.base.x)), z: SHELF_Z - 0.75, face: 0 };
    return { ...this.L.spot, face: this.L.faceCustomer };
  }

  private moveFarmer(v: SceneView, dt: number, t: number) {
    const tg = this.farmerTarget(v);
    const dx = tg.x - this.farmerPos.x;
    const dz = tg.z - this.farmerPos.y;
    const d = Math.hypot(dx, dz);
    if (d > 0.04) {
      const s = Math.min(d, 4.2 * dt);
      this.farmerPos.x += (dx / d) * s;
      this.farmerPos.y += (dz / d) * s;
      this.farmerHeading = Math.atan2(dx, dz);
      this.farmerWalk = Math.min(1, this.farmerWalk + dt * 8);
    } else {
      this.farmerWalk = Math.max(0, this.farmerWalk - dt * 8);
      this.farmerHeading = tg.face;
    }
    const F = this.farmer;
    F.root.position.set(this.farmerPos.x, 0, this.farmerPos.y);
    let r = this.farmerHeading - F.root.rotation.y;
    while (r > Math.PI) r -= Math.PI * 2;
    while (r < -Math.PI) r += Math.PI * 2;
    F.root.rotation.y += r * Math.min(1, dt * 12);
    const sw = Math.sin(t * 12) * 0.7 * this.farmerWalk;
    F.legL.rotation.x = sw;
    F.legR.rotation.x = -sw;
    F.body.position.y = Math.abs(Math.sin(t * 12)) * 0.06 * this.farmerWalk;
    const busy = v.farmer.busy && this.farmerWalk < 0.2;
    F.armL.rotation.x = busy ? -1.1 + Math.sin(t * 14) * 0.25 : -sw * 0.8;
    F.armR.rotation.x = busy ? -1.2 + Math.sin(t * 16 + 1) * 0.45 : sw * 0.8;
  }

  private drawStall(v: SceneView) {
    v.bags.forEach((b, i) => {
      const m = this.bagMeshes[i];
      if (!m) return;
      m.bag.visible = i === 0 || v.bags.length > 1;
      m.fill.forEach((f, k) => {
        f.visible = b.kg > 0 && k < Math.min(3, Math.ceil(b.kg / 1.5));
        if (b.colors.length) (f.material as THREE.MeshLambertMaterial).color.set(b.colors[k % b.colors.length]);
      });
    });
    if (v.bags.length < 2) this.bagMeshes[1].bag.visible = false;
    for (const s of this.shelf) {
      const kg = v.store[s.id] ?? 0;
      s.heap.visible = kg > 0.05 && !['sauce', 'jam', 'chillisauce', 'pickles'].includes(s.id);
      const k = Math.min(1, kg / 30);
      s.heap.scale.set(0.48, 0.08 + 0.2 * k, 0.36);
      s.heap.position.y = s.base.y - 0.02 + 0.06 * k;
    }
  }

  private drawKitchen(v: SceneView, dt: number, t: number) {
    for (const id of Object.keys(this.L.stations) as StationId[]) {
      const sv = v.stations[id];
      const parts = this.stationParts[id];
      if (!parts) continue;
      const on = sv.state !== 'empty';
      parts.food.visible = on && id !== 'oven';
      if (on && sv.food) (parts.food.material as THREE.MeshLambertMaterial).color.set(sv.state === 'burnt' ? '#2a1d14' : sv.state === 'over' ? '#6e4a2a' : sv.food);
      if (parts.glow) (parts.glow.material as THREE.MeshBasicMaterial).opacity = on && sv.state !== 'done' ? 0.6 + Math.sin(t * 9) * 0.25 : on ? 0.3 : 0;
      if (parts.window) parts.window.emissive.set(on ? (sv.state === 'burnt' ? '#3a1408' : '#ff7a1a') : '#000000');
      if (parts.window) parts.window.emissiveIntensity = on ? 0.7 + Math.sin(t * 5) * 0.2 : 0;
      if (parts.knife) parts.knife.rotation.z = on && v.farmer.at === 'board' && v.farmer.busy ? Math.abs(Math.sin(t * 16)) * 0.6 : 0;
      if (parts.jar) parts.food.rotation.y += on && sv.state === 'working' ? dt * 20 : 0;
      // steam over what cooks, smoke over what burns
      if (on && id !== 'board' && (sv.state === 'working' || sv.state === 'burnt' || sv.state === 'over') && Math.random() < dt * (sv.state === 'burnt' ? 14 : 7) * (this.calm ? 0.35 : 1)) this.puffAt(id, sv.state === 'burnt' ? '#3a3a3a' : sv.state === 'over' ? '#9a8a7a' : '#ffffff');
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      const k = p.t / p.life;
      p.s.position.y += dt * 0.9;
      p.s.position.x += Math.sin(p.t * 3 + i) * dt * 0.2;
      p.s.scale.setScalar(0.25 + k * 0.6);
      (p.s.material as THREE.SpriteMaterial).opacity = 0.8 * (1 - k);
      if (k >= 1) {
        this.scene.remove(p.s);
        (p.s.material as THREE.SpriteMaterial).dispose();
        this.puffs.splice(i, 1);
      }
    }
    // the dishes waiting on the pass
    while (this.passItems.length < v.pass.length) {
      const g = new THREE.Group();
      const plate = new THREE.Mesh(G.cyl, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
      plate.applyMatrix4(at(0, 0, 0, { sx: 0.42, sy: 0.03, sz: 0.42 }));
      const heap = new THREE.Mesh(G.sphere, new THREE.MeshLambertMaterial({ color: '#f3ead2' }));
      heap.applyMatrix4(at(0, 0.06, 0, { sx: 0.26, sy: 0.12, sz: 0.26 }));
      const box = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: '#f4f1e8' }));
      box.applyMatrix4(at(0, 0.08, 0, { sx: 0.4, sy: 0.16, sz: 0.3 }));
      box.name = 'box';
      g.add(plate, heap, box);
      this.scene.add(g);
      this.passItems.push(g);
    }
    this.passItems.forEach((g, i) => {
      g.visible = i < v.pass.length;
      if (!g.visible) return;
      g.position.set(-1.9 + i * 0.6, 1.07, this.L.counterZ + 0.05);
      const boxed = v.pass[i] === 'box';
      g.children.forEach(c => (c.visible = c.name === 'box' ? boxed : !boxed));
    });
  }

  private puffAt(id: StationId, color: string) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color, transparent: true, depthWrite: false }));
    const a = this.L.stations[id];
    s.position.set(a.x + (Math.random() - 0.5) * 0.3, 0.93 + (id === 'oven' ? 0.9 : 0.9), a.z + (Math.random() - 0.5) * 0.2);
    s.scale.setScalar(0.25);
    this.scene.add(s);
    this.puffs.push({ s, at: id, t: 0, life: 1.2 + Math.random() * 0.6 });
  }

  /** Screen positions (stage pixels) of the heads, the stations and the bags, for the labels on top. */
  private measure() {
    const toScreen = (x: number, y: number, z: number) => {
      tmp.set(x, y, z).project(this.camera);
      return { x: Math.round(((tmp.x + 1) / 2) * SHOP_W), y: Math.round(((1 - tmp.y) / 2) * SHOP_H) };
    };
    const patrons: Anchors['patrons'] = {};
    for (const [id, w] of this.walkers) patrons[id] = toScreen(w.pos.x, 2.15 * w.f.root.scale.y - (w.f.body.position.y < -0.1 ? 0.24 : 0), w.pos.y);
    const stations = {} as Anchors['stations'];
    for (const id of Object.keys(this.L.stations) as StationId[]) stations[id] = toScreen(this.L.stations[id].x, 1.35, this.L.stations[id].z);
    const bags = this.bagMeshes.map(b => toScreen(b.bag.position.x, 1.9, b.bag.position.z));
    this.anchorsNow = { patrons, stations, bags, farmer: toScreen(this.farmerPos.x, 2.1, this.farmerPos.y) };
  }
}
