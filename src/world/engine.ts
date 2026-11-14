/* The farm world: a walkable 3D farm in three.js. The farmer walks (tap, drag or keys). Clearing and planting are
   done a plot at a time with a button (World.tsx); walking over a farm's plots does its other jobs with the right tool
   or load. The React side (World.tsx) owns the game state;
   this engine draws it and reports what the farmer did. */

import * as THREE from 'three';
import { RIDE_SPEED, TRACTOR_EDGE, type ImplId } from '../tractor/data';
import { JOB_INFO, TOOL_JOB, TRACTOR_PLOT, toolName, type PlotJob, type TractorId } from '../plots/data';
import { CHECK_DAYS, CROP_WORDS, checkKey, cropOf, farmName, harvestFarm, hazardFor, plotGrowth, type Trial, type TrialHazard } from '../trials/model';
import {
  FULL,
  PLOTS,
  PLOT_D,
  PLOT_W,
  TILE,
  TILES,
  WORK_REACH,
  fieldDay,
  isDone,
  machinePrep,
  needOf,
  setupLeft,
  someTiles,
  signOf,
  tileCenter,
  treatLeft,
  careLeft,
  fixLeft,
  plotAt,
  rowMask,
  rowOf,
  BUTTON_JOBS,
  followUpLeft,
  type Carry,
  type Field,
  type Place,
} from './field';
import {
  C,
  G,
  at,
  badgeTexture,
  board,
  bush,
  fence,
  flowers,
  grassClump,
  hailTile,
  house,
  maizeTile,
  kaleTile,
  makeArrow,
  makeBird,
  makeChicken,
  makeFarmer,
  setCharacterStyle,
  type FarmerLook,
  makePickup,
  makeQuadruped,
  makeTractor,
  merge,
  pestTile,
  place,
  pond,
  puddleTile,
  rock,
  roundRect,
  shed,
  signTexture,
  stall,
  tree,
  trough,
  vcMaterial,
  weedTile,
  wildTile,
  zoneTexture,
  type Farmer,
  type Part,
} from './models';

export { WORK_REACH };
/** On the tractor the swath is TRACTOR_EDGE times as wide, so one pass down a farm works all four columns. */
export const TRACTOR_REACH = WORK_REACH * TRACTOR_EDGE;

/** What each graphics level draws: the largest pixel ratio, the shadow map's size (0 = no shadows), soft shadow edges. */
const QUALITY = [
  { ratio: 2, shadow: 2048, soft: true },
  { ratio: 1.5, shadow: 1024, soft: false },
  { ratio: 1, shadow: 0, soft: false },
] as const;
/** A still farm on a phone is drawn about 30 times a second. */
const IDLE_FRAME_MS = 31;

/** A phone or a small, low-memory device: it gets the lighter picture on Auto graphics. */
function phoneLike() {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return window.matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600 || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  } catch {
    return false;
  }
}
/** Where the tractor waits, and a spot beside it to walk to (clear of the Hire spot, which opens the hire screen). */
const TRACTOR_HOME = { x: -17.4, z: 6.4 };
export const TRACTOR_BOARD = { x: -17.4, z: 8.6 };

export const STAGE_W = 874;
export const STAGE_H = 402;

export const PLACES: Record<Place, { x: number; z: number; r: number }> = {
  mission: { x: 4.4, z: -11.2, r: 1.2 },
  'shed-seeds': { x: -14.2, z: -1.9, r: 0.85 },
  'shed-fertilizer': { x: -14.2, z: 0, r: 0.85 },
  'shed-sprayer': { x: -14.2, z: 1.9, r: 0.85 },
  pond: { x: 13.6, z: 0, r: 1.1 },
  hire: { x: -14.6, z: 6.4, r: 1.2 },
  market: { x: 0, z: 12.9, r: 1.3 },
  house: { x: 0, z: -15.2, r: 1.2 },
};

const PICKUP_OF: Partial<Record<Place, Exclude<Carry, null>>> = { 'shed-seeds': 'seeds', 'shed-fertilizer': 'fertilizer', 'shed-sprayer': 'sprayer', pond: 'water' };

export interface WorldOptions {
  /** draw the farmer and the animals in the retro anime style */
  anime: boolean;
  graphics: 'auto' | 'high' | 'low';
}

export interface ViewState {
  trial: Trial | null;
  field: Field;
  today: number;
  look: FarmerLook;
  /** where the task card points, for the green arrow */
  arrowAt: { x: number; z: number } | null;
  /** the farm the task card is about: hints about other farms stay quiet while the farmer passes through */
  focus: number | null;
  paused: boolean;
}

export interface WorldEvents {
  /** `tractor`: the tiles were done from the tractor seat */
  mark: (farm: number, job: string, bits: number, tractor?: boolean, rig?: { tractor: TractorId; tool: ImplId; job: PlotJob }) => void;
  carry: (item: Carry) => void;
  place: (p: Place) => void;
  /** the farmer is at a farm's sign (or left it: -1) */
  sign: (farm: number) => void;
  hint: (text: string) => void;
  arrived?: () => void;
}

export type Fx = 'dig' | 'clear' | 'mulch' | 'seed' | 'fert' | 'water' | 'spray' | 'weed' | 'drain' | 'harvest';

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const BOUNDS: Rect = { x0: -21.6, x1: 21.6, z0: -20.4, z1: 16.8 };

export class FarmWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, STAGE_W / STAGE_H, 0.5, 120);
  private sun: THREE.DirectionalLight;
  private clock = new THREE.Clock();
  private raf = 0;
  private ev: WorldEvents;
  private view: ViewState | null = null;
  private dirty = true;

  // the farmer
  private farmer: Farmer;
  private pos = new THREE.Vector2(0, -12.6);
  private heading = 0;
  private target: THREE.Vector2 | null = null;
  private joy = new THREE.Vector2();
  private keys = new Set<string>();
  private walking = 0;
  /** play-tests shorten the plot timer (1 = the real 3 seconds) */
  workScale = 1;
  private work = 0;
  private workFx: Fx | null = null;
  private lastHint = 0;
  private inPlace: Place | null = null;
  private atSign = -1;
  private pending = new Map<string, number>();
  /** walking speed multiplier (automated play-tests run faster) */
  speedScale = 1;
  /** the farmer is on the tractor: a wider swath on the big jobs, a little faster, and bonus points */
  private riding = false;
  /** the tractor type and tool chosen at the tractor (plots/data.ts): the tool decides the job */
  private rig: { tractor: TractorId; tool: ImplId } | null = null;
  /** plots the tractor has claimed here before the state caught up, as `${cycle}:${farm}:${tractor or job:tool}` → plot */

  // the field, drawn as instances: 6 farms × 20 tiles
  private base!: THREE.InstancedMesh;
  private mound!: THREE.InstancedMesh;
  private wild!: THREE.InstancedMesh;
  private plants: Record<'sprout' | 'young' | 'tall' | 'ripe' | 'stubble', THREE.InstancedMesh> = {} as never;
  /** sukuma wiki, by the same stages (the first cycle's Farm 2) */
  private kale: Record<'sprout' | 'young' | 'tall' | 'ripe' | 'stubble', THREE.InstancedMesh> = {} as never;
  private weeds!: THREE.InstancedMesh;
  private puddles!: THREE.InstancedMesh;
  private hail!: THREE.InstancedMesh;
  private pests!: THREE.InstancedMesh;
  private signs: { badge: THREE.Sprite; board: THREE.Group }[] = [];
  private badgeTex: Record<string, THREE.Texture> = {};

  // animals and helpers
  private cows: { m: ReturnType<typeof makeQuadruped>; at: THREE.Vector2; to: THREE.Vector2; wait: number }[] = [];
  private hens: { m: ReturnType<typeof makeChicken>; at: THREE.Vector2; to: THREE.Vector2; wait: number }[] = [];
  private goat = makeQuadruped('goat');
  private goatState = { farm: -1, at: new THREE.Vector2(), to: new THREE.Vector2(), leaving: 0 };
  private birds: ReturnType<typeof makeBird>[] = [];
  private birdState = { farm: -1, leaving: 0 };
  private tractor = makeTractor();
  private oxen = new THREE.Group();
  private hire: { farms: number[]; path: THREE.Vector2[]; i: number; farmOf: number[]; home: THREE.Vector2 } | null = null;
  private pickups: Partial<Record<Place, THREE.Group>> = {};
  private arrow = makeArrow();
  /** a ring where a tap sends the farmer */
  private ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
  private ringLife = 0;

  // particles
  private parts!: THREE.InstancedMesh;
  private pData: { p: THREE.Vector3; v: THREE.Vector3; life: number; s: number }[] = [];
  private pNext = 0;

  private obstacles: { x: number; z: number; r: number }[] = [];
  private rects: Rect[] = [];


  constructor(canvas: HTMLCanvasElement, events: WorldEvents, opts: WorldOptions = { anime: true, graphics: 'auto' }) {
    this.ev = events;
    // the characters are built in the chosen style (the app builds a new farm when it changes)
    setCharacterStyle(opts.anime);
    // how much to draw: the sharpest on a computer, a lighter picture on a phone, the least on Low (see QUALITY)
    this.level = opts.graphics === 'low' ? 2 : opts.graphics === 'high' || !phoneLike() ? 0 : 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.level < 2, powerPreference: this.level === 0 ? 'high-performance' : 'default' });
    this.renderer.setSize(STAGE_W, STAGE_H, false);
    this.renderer.shadowMap.enabled = QUALITY[this.level].shadow > 0;
    this.renderer.shadowMap.type = QUALITY[this.level].soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // on a phone the shadows are redrawn every other frame (nothing on the farm moves fast enough to show it)
    this.renderer.shadowMap.autoUpdate = this.level === 0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(C.grass);
    this.scene.fog = new THREE.Fog(C.grass, 30, 60);

    const hemi = new THREE.HemisphereLight('#ffffff', '#8fb83a', 1.55);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff6e0', 2.2);
    this.sun.castShadow = QUALITY[this.level].shadow > 0;
    if (opts.graphics !== 'auto') this.lowFx = true;
    const size = QUALITY[this.level].shadow || 512;
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 14;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.buildStatic();
    this.buildField();
    this.farmer = makeFarmer({ skin: '#8a5634', outfit: '#d9433a' });
    this.scene.add(this.farmer.root);
    this.buildAnimals();
    this.buildParticles();
    this.scene.add(this.arrow);
    this.arrow.visible = false;
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);

    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    // build every shader now, while the farm opens, not in the middle of the first walk (a stall on a phone)
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {
      /* compiled on first use instead */
    }
    this.loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    // free the GPU memory too: the farm is rebuilt when the art style or graphics change
    const mats = new Set<THREE.Material>();
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Sprite).isSprite) {
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x && mats.add(x));
      }
    });
    mats.forEach(x => {
      const map = (x as THREE.MeshBasicMaterial).map;
      map?.dispose();
      x.dispose();
    });
    this.sun.shadow.map?.dispose();
    this.renderer.dispose();
  }

  /** The canvas's drawing size, for a sharp picture at the stage's scale. */
  resize(scale: number) {
    this.stageScale = scale;
    this.renderer.setPixelRatio(Math.min(QUALITY[this.level].ratio, (window.devicePixelRatio || 1) * Math.max(0.5, scale)));
    this.renderer.setSize(STAGE_W, STAGE_H, false);
  }
  private stageScale = 1;

  private lookKey = '';
  setView(v: ViewState) {
    const lk = [v.look.skin, v.look.outfit, v.look.head, v.look.headColor, v.look.trim].join();
    if (lk !== this.lookKey) {
      this.lookKey = lk;
      const old = this.farmer;
      const keep = { x: old.root.position.x, z: old.root.position.z, r: old.root.rotation.y };
      this.scene.remove(old.root);
      this.farmer = makeFarmer(v.look);
      this.farmer.root.position.set(keep.x, 0, keep.z);
      this.farmer.root.rotation.y = keep.r;
      this.scene.add(this.farmer.root);
    }
    // the state has caught up with the work done: forget what it now holds
    for (const [k, bits] of this.pending) {
      const have = v.field.marks[k] ?? 0;
      if ((have & bits) === bits) this.pending.delete(k);
    }
    if (v.trial?.cycle !== this.view?.trial?.cycle) this.pending.clear();
    this.view = v;
    this.dirty = true;
  }

  /** Places the farmer (for the start of a visit). */
  spawn(x: number, z: number) {
    this.pos.set(x, z);
    this.target = null;
    this.farmer.root.position.set(x, 0, z);
    this.snapCamera();
  }

  walkTo(x: number, z: number) {
    this.target = new THREE.Vector2(x, z);
  }

  setJoystick(dx: number, dy: number) {
    this.joy.set(dx, dy);
    if (dx || dy) this.target = null;
  }

  /** A tap on the stage (in stage pixels): walk to the ground point under it. */
  tap(sx: number, sy: number) {
    const ndc = new THREE.Vector2((sx / STAGE_W) * 2 - 1, -(sy / STAGE_H) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      this.walkTo(hit.x, hit.z);
      this.ring.position.set(hit.x, 0.05, hit.z);
      this.ringLife = 0.6;
    }
  }

  /** Where a world point shows on the stage, in stage pixels. */
  project(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * STAGE_W, y: ((1 - v.y) / 2) * STAGE_H, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }

  /** Where to walk for a farm's next job: its first tile still to do (or the middle of the farm). */
  nextTile(farm: number) {
    const p = PLOTS[farm];
    if (!this.view) return { x: p.x, z: p.z };
    const j = this.jobAt(farm);
    if (j && !('hint' in j)) {
      const done = this.marks(farm, j.job);
      for (let i = 0; i < TILES; i++) if (j.need & (1 << i) && !(done & (1 << i))) return tileCenter(farm, i);
    }
    if (this.goatState.farm === farm) return { x: this.goatState.at.x, z: this.goatState.at.y };
    return { x: p.x, z: p.z };
  }

  farmerScreen() {
    return this.project(this.pos.x, 2.1, this.pos.y);
  }

  farmerAt() {
    return { x: this.pos.x, z: this.pos.y };
  }

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
    this.target = null;
  };

  /* ---------------- building the farm ---------------- */

  private buildStatic() {
    const smooth: Part[] = [];
    const flat: Part[] = [];
    // ground and paths
    smooth.push({ geo: G.plane, color: C.grass, m: at(0, 0, -2, { sx: 120, sz: 110 }) });
    const pathRects: [number, number, number, number][] = [
      [-12.8, -10.0, 12.8, 10.0],
      [-1.5, -16.6, 1.5, -9.5],
      [-17.0, -2.9, -12.3, 2.9],
      [12.3, -1.5, 14.8, 1.5],
      [-1.5, 9.5, 1.5, 14.2],
      [-16.0, 4.8, -12.3, 7.8],
    ];
    for (const [x0, z0, x1, z1] of pathRects) {
      smooth.push({ geo: roundRect(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, 1.2), color: C.pathEdge, m: at(0, 0.008, 0) });
    }
    for (const [x0, z0, x1, z1] of pathRects) {
      smooth.push({ geo: roundRect(x0, z0, x1, z1, 1.0), color: C.path, m: at(0, 0.014, 0) });
    }
    // buildings
    smooth.push(...place(house(), at(0, 0, -18.6)));
    smooth.push(...place(shed(), at(-18.6, 0, 0, { ry: Math.PI / 2 })));
    smooth.push(...place(stall(), at(0, 0, 15.6, { ry: Math.PI })));
    smooth.push(...place(board(), at(4.4, 0, -12.4)));
    smooth.push(...place(pond(), at(18.4, 0, 0)));
    smooth.push(...place(trough(), at(-15, 0, -13.6)));
    // a little coop
    smooth.push({ geo: G.box, color: C.woodPlank, m: at(8.2, 0.7, -18.4, { sx: 2.2, sy: 1.4, sz: 1.6 }) });
    smooth.push({ geo: G.box, color: C.roof, m: at(8.2, 1.55, -18.4, { sx: 2.6, sy: 0.25, sz: 2.0, rx: 0.15 }) });
    smooth.push({ geo: G.box, color: '#5c3a20', m: at(8.2, 0.45, -17.58, { sx: 0.6, sy: 0.7, sz: 0.05 }) });
    // fences: the yard, and the cow pen
    smooth.push(...fence(-22.4, -21.2, 22.4, -21.2));
    smooth.push(...fence(-22.4, 17.6, -2.4, 17.6));
    smooth.push(...fence(2.4, 17.6, 22.4, 17.6));
    smooth.push(...fence(-22.4, -21.2, -22.4, 17.6));
    smooth.push(...fence(22.4, -21.2, 22.4, 17.6));
    smooth.push(...fence(-21.4, -11.6, -12.0, -11.6));
    smooth.push(...fence(-12.0, -11.6, -12.0, -20.4));
    smooth.push(...fence(-12.0, -20.4, -21.4, -20.4));
    smooth.push(...fence(-21.4, -20.4, -21.4, -11.6));
    // trees, bushes, grass, rocks, flowers on the grass around
    const trees: [number, number, number][] = [
      [-20, 12, 1],
      [-17.5, 14.8, 0.8],
      [19.5, 12.5, 1.1],
      [16.4, 15.0, 0.8],
      [19.8, -9.5, 1],
      [17.4, -17.8, 1.1],
      [-6.8, -19.4, 0.9],
      [13.2, -19.6, 0.9],
      [-9.5, 15.6, 0.85],
      [9.8, 15.4, 0.9],
      [20.0, -15.0, 0.8],
      [-20.0, 9.0, 0.7],
    ];
    for (const [x, z, s] of trees) {
      flat.push(...place(tree(s, (x * 7 + z) % 2 ? 1 : 0), at(x, 0, z)));
      this.obstacles.push({ x, z, r: 0.7 * s });
    }
    const bushes: [number, number, number][] = [
      [-14.2, 10.6, 1],
      [14.6, 10.2, 0.8],
      [15.2, -6.4, 0.9],
      [-3.6, -14.0, 0.7],
      [6.4, 12.2, 0.8],
      [-6.2, 12.4, 0.7],
      [-19.6, 2.8, 0.8],
    ];
    for (const [x, z, s] of bushes) flat.push(...place(bush(s), at(x, 0, z)));
    const clumps: [number, number, number][] = [
      [-13.8, -6.6, 1],
      [14.2, -3.4, 1.1],
      [-4.2, 11.6, 0.9],
      [4.0, 12.0, 1],
      [-11.0, 11.4, 1.1],
      [11.4, 11.0, 0.9],
      [13.8, 6.2, 1],
      [-3.4, -11.6, 0.9],
      [-8.4, -12.2, 1],
      [9.6, -12.0, 1.1],
      [-18.2, 8.6, 0.9],
      [18.6, 6.4, 1],
      [19.6, -3.4, 0.9],
      [-20.4, -4.4, 1],
    ];
    for (const [x, z, s] of clumps) smooth.push(...place(grassClump(s * 1.6), at(x, 0, z)));
    for (const [x, z] of [
      [-13.4, -8.4],
      [13.6, 8.4],
      [-2.8, 13.4],
      [6.2, -14.4],
    ])
      smooth.push(...place(flowers(), at(x, 0, z)));
    for (const [x, z, s] of [
      [-15.6, 9.4, 1.2],
      [16.8, -7.2, 1],
      [-6.0, -14.8, 0.9],
    ] as const)
      flat.push(...place(rock(s), at(x, 0, z)));

    const ms = new THREE.Mesh(merge(smooth), vcMaterial(false));
    ms.receiveShadow = true;
    ms.castShadow = true;
    const mf = new THREE.Mesh(merge(flat), vcMaterial(true));
    mf.receiveShadow = true;
    mf.castShadow = true;
    this.scene.add(ms, mf);

    // what the farmer can't walk through
    this.rects.push(
      { x0: -3.5, x1: 3.5, z0: -21.0, z1: -16.2 },
      { x0: -20.6, x1: -16.9, z0: -2.8, z1: 2.8 },
      { x0: -2.3, x1: 2.3, z0: 14.7, z1: 16.6 },
      { x0: -21.6, x1: -11.7, z0: -20.6, z1: -11.3 },
      { x0: 6.9, x1: 9.5, z0: -19.4, z1: -17.4 },
    );
    this.obstacles.push({ x: 18.4, z: 0, r: 3.2 }, { x: 4.4, z: -12.4, r: 0.6 });

    // interaction spots
    const glyphs: Record<string, (g: CanvasRenderingContext2D) => void> = {
      tractor: g => {
        g.fillStyle = '#fff';
        g.fillRect(-46, -20, 62, 30);
        g.fillRect(-8, -48, 34, 34);
        g.beginPath();
        g.arc(-28, 18, 22, 0, Math.PI * 2);
        g.arc(30, 22, 15, 0, Math.PI * 2);
        g.fill();
      },
      sell: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(0, -6, 18, 40, -0.3, 0, Math.PI * 2);
        g.fill();
      },
      sleep: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(0, -4, 36, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.arc(16, -16, 32, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      },
      plan: g => {
        g.fillStyle = '#fff';
        g.fillRect(-30, -44, 60, 76);
        g.fillStyle = 'rgba(0,0,0,0.0)';
      },
      water: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.moveTo(0, -46);
        g.quadraticCurveTo(34, 0, 0, 30);
        g.quadraticCurveTo(-34, 0, 0, -46);
        g.fill();
      },
      bag: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2);
        g.fill();
      },
    };
    const zones: [Place, string, string, number][] = [
      ['hire', 'Hire', 'tractor', 2.2],
      ['market', 'Sell', 'sell', 2.4],
      ['house', 'Sleep', 'sleep', 2.2],
      ['mission', 'Plan', 'plan', 2.0],
      ['pond', 'Water', 'water', 1.9],
      ['shed-seeds', 'Seeds', 'bag', 1.6],
      ['shed-fertilizer', 'Fertilizer', 'bag', 1.6],
      ['shed-sprayer', 'Sprayer', 'bag', 1.6],
    ];
    for (const [p, label, glyph, size] of zones) {
      const mat = new THREE.MeshBasicMaterial({ map: zoneTexture(label, glyphs[glyph]), transparent: true, depthWrite: false });
      const zm = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat);
      zm.position.set(PLACES[p].x, 0.03, PLACES[p].z);
      zm.renderOrder = 2;
      this.scene.add(zm);
    }
    // pickups beside their spots
    const pk: [Place, 'seeds' | 'fertilizer' | 'sprayer' | 'water', number, number][] = [
      ['shed-seeds', 'seeds', -15.6, -1.9],
      ['shed-fertilizer', 'fertilizer', -15.6, 0],
      ['shed-sprayer', 'sprayer', -15.6, 1.9],
      ['pond', 'water', 14.6, 1.0],
    ];
    for (const [p, kind, x, z] of pk) {
      const g = makePickup(kind);
      g.position.set(x, 0, z);
      g.rotation.y = 0.4;
      this.scene.add(g);
      this.pickups[p] = g;
    }
    // the tractor waits beside the hire spot
    this.tractor.position.set(TRACTOR_HOME.x, 0, TRACTOR_HOME.z);
    this.tractor.rotation.y = Math.PI / 2;
    this.scene.add(this.tractor);
    this.obstacles.push({ x: -17.4, z: 6.4, r: 1.3 });
    const ox1 = makeQuadruped('ox');
    const ox2 = makeQuadruped('ox');
    ox1.root.position.set(-0.55, 0, 0.6);
    ox2.root.position.set(0.55, 0, 0.6);
    this.oxen.add(ox1.root, ox2.root);
    const yoke = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: '#8b5a2b' }));
    yoke.scale.set(1.8, 0.12, 0.12);
    yoke.position.set(0, 1.2, 1.0);
    const plough = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: '#7d8489' }));
    plough.scale.set(0.5, 0.4, 0.9);
    plough.position.set(0, 0.25, -0.8);
    this.oxen.add(yoke, plough);
    this.oxen.visible = false;
    this.scene.add(this.oxen);
  }

  private buildField() {
    const n = PLOTS.length * TILES;
    const lam = (color: string) => new THREE.MeshLambertMaterial({ color });
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number, shadow = true) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      // the count changes as tiles show and hide, so a bounding sphere computed once would go stale: the field is
      // always in view anyway
      m.frustumCulled = false;
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < count; i++) m.setColorAt(i, new THREE.Color('#ffffff'));
      this.scene.add(m);
      return m;
    };
    this.base = inst(G.box, lam('#ffffff'), PLOTS.length, false);
    PLOTS.forEach((p, i) => {
      this.base.setMatrixAt(i, at(p.x, 0.02, p.z, { sx: PLOT_W + 0.5, sy: 0.04, sz: PLOT_D + 0.5 }));
    });
    this.mound = inst(G.box, lam('#ffffff'), n, false);
    this.wild = inst(wildTile(), vcMaterial(), n);
    for (const st of ['sprout', 'young', 'tall', 'ripe', 'stubble'] as const) this.plants[st] = inst(maizeTile(st), vcMaterial(true), n);
    for (const st of ['sprout', 'young', 'tall', 'ripe', 'stubble'] as const) this.kale[st] = inst(kaleTile(st), vcMaterial(true), n);
    this.weeds = inst(weedTile(), vcMaterial(true), n);
    this.puddles = inst(puddleTile(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }), n, false);
    this.hail = inst(hailTile(), vcMaterial(), n, false);
    this.pests = inst(pestTile(), vcMaterial(), n, false);
    // a sign at each farm
    for (let f = 0; f < PLOTS.length; f++) {
      const s = signOf(f);
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      const post = new THREE.Mesh(G.cyl6, new THREE.MeshLambertMaterial({ color: '#8b5a2b' }));
      post.scale.set(0.12, 1.0, 0.12);
      post.position.y = 0.5;
      post.castShadow = true;
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.08), [
        new THREE.MeshLambertMaterial({ color: '#2fb3cf' }),
        new THREE.MeshLambertMaterial({ color: '#2fb3cf' }),
        new THREE.MeshLambertMaterial({ color: '#2fb3cf' }),
        new THREE.MeshLambertMaterial({ color: '#2fb3cf' }),
        new THREE.MeshLambertMaterial({ map: signTexture(f + 1) }),
        new THREE.MeshLambertMaterial({ color: '#2fb3cf' }),
      ]);
      face.position.y = 1.15;
      face.castShadow = true;
      const disc = new THREE.Mesh(G.disc, new THREE.MeshLambertMaterial({ color: '#f0f39a' }));
      disc.scale.setScalar(0.7);
      disc.position.y = 0.02;
      g.add(post, face, disc);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
      badge.scale.set(0.8, 0.8, 1);
      badge.position.set(0, 2.05, 0);
      badge.renderOrder = 5;
      g.add(badge);
      this.scene.add(g);
      this.signs.push({ badge, board: g });
    }
    this.badgeTex = {
      check: badgeTexture('!', '#f39c12'),
      treat: badgeTexture('+', '#2f9b14'),
      done: badgeTexture('✓', '#2f9b14'),
      harvest: badgeTexture('↑', '#e2a816'),
    };
  }

  private buildAnimals() {
    for (const [x, z] of [
      [-17, -15],
      [-14.4, -17.6],
    ]) {
      const m = makeQuadruped('cow');
      m.root.position.set(x, 0, z);
      this.scene.add(m.root);
      this.cows.push({ m, at: new THREE.Vector2(x, z), to: new THREE.Vector2(x, z), wait: Math.random() * 3 });
    }
    for (let i = 0; i < 4; i++) {
      const m = makeChicken();
      const x = 5.5 + i * 1.2;
      const z = -16 + (i % 2) * 1.1;
      m.root.position.set(x, 0, z);
      this.scene.add(m.root);
      this.hens.push({ m, at: new THREE.Vector2(x, z), to: new THREE.Vector2(x, z), wait: Math.random() * 2 });
    }
    this.goat.root.visible = false;
    this.scene.add(this.goat.root);
    for (let i = 0; i < 4; i++) {
      const b = makeBird();
      b.root.visible = false;
      this.scene.add(b.root);
      this.birds.push(b);
    }
  }

  private buildParticles() {
    const count = 180;
    this.parts = new THREE.InstancedMesh(G.box, new THREE.MeshLambertMaterial({ color: '#ffffff' }), count);
    this.parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) {
      this.parts.setMatrixAt(i, at(0, -10, 0, { s: 0 }));
      this.parts.setColorAt(i, new THREE.Color('#ffffff'));
      this.pData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, s: 0.1 });
    }
    this.scene.add(this.parts);
  }

  private burst(fx: Fx, x: number, z: number, n = 5) {
    const col: Record<Fx, string[]> = {
      dig: ['#8a4a26', '#a86338'],
      clear: ['#6fbf2e', '#a8d84a'],
      mulch: ['#e8c867', '#d4a94a'],
      seed: ['#f2c230', '#f7dd7a'],
      fert: ['#ffffff', '#dfe8f0'],
      water: ['#56b9f0', '#a8defa'],
      spray: ['#eaffea', '#c8f0d8'],
      weed: ['#3a8a24', '#7cc23a'],
      drain: ['#7e4425', '#56b9e8'],
      harvest: ['#f2c230', '#e9d27a'],
    };
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const i = this.pNext++ % this.pData.length;
      const d = this.pData[i];
      const throwFx = fx === 'seed' || fx === 'fert';
      const fwd = new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading));
      d.p.set(throwFx ? this.pos.x + fwd.x * 0.3 : x, throwFx ? 1.0 : fx === 'water' || fx === 'spray' ? 0.8 : 0.25, throwFx ? this.pos.y + fwd.y * 0.3 : z);
      d.v.set((Math.random() - 0.5) * 1.6 + (throwFx ? fwd.x * 2.2 : 0), throwFx ? 1.6 + Math.random() : fx === 'water' ? -0.5 : 1.8 + Math.random() * 1.5, (Math.random() - 0.5) * 1.6 + (throwFx ? fwd.y * 2.2 : 0));
      d.life = fx === 'spray' ? 0.7 : 0.9;
      d.s = fx === 'spray' ? 0.16 : fx === 'harvest' ? 0.14 : 0.09;
      c.set(col[fx][k % col[fx].length]);
      this.parts.setColorAt(i, c);
    }
    if (this.parts.instanceColor) this.parts.instanceColor.needsUpdate = true;
  }

  /* ---------------- the field, from the game state ---------------- */

  private marks(farm: number, job: string) {
    const v = this.view!;
    const t = v.trial;
    const base = t && v.field.cycle === t.cycle ? v.field.marks[`${farm}:${job}`] ?? 0 : 0;
    return base | (this.pending.get(`${farm}:${job}`) ?? 0);
  }

  /** The field with the work done here that the state hasn't caught up with yet. */
  private liveField(): Field {
    const v = this.view!;
    if (!this.pending.size) return v.field;
    const marks = { ...(v.trial && v.field.cycle === v.trial.cycle ? v.field.marks : {}) };
    for (const [k, b] of this.pending) marks[k] = (marks[k] ?? 0) | b;
    return { ...v.field, cycle: v.trial?.cycle ?? v.field.cycle, marks };
  }

  private drawField() {
    const v = this.view;
    if (!v) return;
    const t = v.trial;
    const f = this.liveField();
    const day = fieldDay(t, v.today);
    const growing = t?.phase === 'growing';
    const done = t?.phase === 'done';
    const col = new THREE.Color();
    const meshes = [this.mound, this.wild, ...Object.values(this.plants), ...Object.values(this.kale), this.weeds, this.puddles, this.hail, this.pests];
    // only what shows is drawn: each instanced mesh is packed from the start and its count set to what it holds (a
    // hidden instance would still cost its triangles, in the picture and again in the shadows)
    const used = new Map<THREE.InstancedMesh, number>(meshes.map(m => [m, 0]));
    const put = (m: THREE.InstancedMesh, matrix: THREE.Matrix4, color?: THREE.Color) => {
      const k = used.get(m)!;
      m.setMatrixAt(k, matrix);
      if (color) m.setColorAt(k, color);
      used.set(m, k + 1);
    };
    for (let farm = 0; farm < PLOTS.length; farm++) {
      const active = !!t && farm < t.plans.length && t.phase !== 'plan';
      const plan = t?.plans[farm];
      // a farm that started the cycle cleared (the first cycle's sukuma wiki) shows cleared soil from the start
      const prep = active ? (t?.cleared?.includes(farm) ? FULL : this.marks(farm, 'prep')) : 0;
      const sown = active ? this.marks(farm, 'sow') : 0;
      const fed = active ? this.marks(farm, 'setupFeed') : 0;
      const cut = active ? this.marks(farm, 'harvest') : 0;
      const setupDone = active && growing && !setupLeft(f, t!, farm);
      const h: TrialHazard | null = setupDone && day >= 1 && day <= CHECK_DAYS ? hazardFor(t!, farm, day) : null;
      const rec = h && t ? t.checks[checkKey(farm, day)] : undefined;
      const pend = h && t ? careLeft(f, t, farm, day) ?? (fixLeft(t, farm, day) ? true : null) : null;
      // follow-up care due today: the weeds or the dry soil show again until it is done
      const fu = h && t ? followUpLeft(f, t, farm, day) : null;
      const fuBits = fu ? this.marks(farm, fu.key) : 0;
      const fuWeeds = fu?.job === 'weed' ? fu.need & ~fuBits : 0;
      const fuDry = fu?.job === 'water' ? fu.need & ~fuBits : 0;
      const fixed = !!rec?.treated;
      const showProblem = !!h && h !== 'healthy' && !fixed;
      const treatBits = h ? this.marks(farm, `t${day}`) : 0;
      // how the farm has fared so far: problems missed earlier make it yellower and shorter
      const lost = !t || farm >= t.plans.length ? 0 : growing && day > 1 ? this.grown(t, farm, day).lost : done ? t.results?.[farm]?.lost ?? 0 : 0;
      const weedMask = h === 'weeds' ? needOf('weed', t!, farm, day) : 0;
      const puddleMask = h === 'flood' ? needOf('drain', t!, farm, day) : 0;
      const gaps = plan?.date === 'early' ? someTiles(`gap:${t?.cycle}:${farm}`, 5) : 0;
      // the farm grows with its seed, fertilizer and machines: taller or shorter, greener or paler
      const growth = active && t ? this.grown(t, farm, day).plots : [1];

      col.set(active && prep ? '#7a4224' : '#93cf33');
      this.base.setColorAt(farm, col);

      for (let i = 0; i < TILES; i++) {
        const c = tileCenter(farm, i);
        const bit = 1 << i;
        const isPrep = !!(prep & bit);
        // the soil
        const moundAt = at(c.x, 0.06, c.z, { sx: TILE * 0.82, sy: 0.16, sz: TILE * 0.94 });
        let soil = C.grassDark;
        if (isPrep) soil = plan?.land === 'mulch' ? C.mulch : plan?.land === 'slash' ? '#8f6a3c' : C.soilTilled;
        if (isPrep && sown & bit) soil = plan?.land === 'mulch' ? C.mulch : C.soil;
        if (isPrep && fed & bit && day <= 1) soil = '#8a5838';
        if (showProblem && h === 'drought' && !(treatBits & bit)) soil = C.soilDry;
        if (fuDry & bit) soil = C.soilDry;
        if (h === 'drought' && treatBits & bit) soil = C.soilWet;
        if (h === 'flood') soil = C.soilDark;
        col.set(soil);
        put(this.mound, moundAt, col);
        if (!isPrep) put(this.wild, at(c.x, 0.12, c.z, { ry: i * 1.3 }));
        // the crop
        if (!active || !(sown & bit) || gaps & bit) continue;
        let stage: keyof FarmWorld['plants'] = day <= 2 ? 'sprout' : day <= 4 ? 'young' : day <= CHECK_DAYS ? 'tall' : 'ripe';
        if (done || cut & bit) stage = 'stubble';
        if (!growing && !done) continue;
        let tint = '#ffffff';
        let sy = 1;
        if (showProblem && stage !== 'stubble') {
          const healed = !!(treatBits & bit);
          if (!healed) {
            if (h === 'nitrogen') tint = '#e8e070';
            if (h === 'disease') tint = '#e4a35c';
            if (h === 'armyworm' || h === 'aphids') tint = '#d6e09a';
            if (h === 'drought') {
              tint = '#c8c48a';
              sy = 0.85;
            }
            if (h === 'hail') sy = 0.75;
            if (h === 'harvestEarly') tint = '#b8f07a';
          }
        }
        if (h === 'plantLate') sy *= 0.8;
        const g = growth[0] ?? 1;
        if (stage !== 'sprout' && stage !== 'stubble') {
          sy *= 0.7 + 0.3 * Math.min(1, g);
          if (g < 0.62 && tint === '#ffffff') tint = '#e6eb9a';
        }
        if (lost > 0.08 && tint === '#ffffff' && stage !== 'stubble') tint = lost > 0.25 ? '#dcd27a' : '#eef0a8';
        col.set(tint);
        put((t && cropOf(t, farm) === 'kale' ? this.kale : this.plants)[stage], at(c.x, 0.06, c.z, { sy, ry: (i % 2) * 0.4 }), col);
        const weedy = (showProblem && !(treatBits & bit) && weedMask & bit) || fuWeeds & bit;
        if (weedy) put(this.weeds, at(c.x, 0.08, c.z, { ry: i }));
        if (showProblem && !(treatBits & bit)) {
          if (puddleMask & bit) put(this.puddles, at(c.x, 0, c.z));
          if (h === 'hail' && i % 2 === 0) put(this.hail, at(c.x, 0, c.z));
          if ((h === 'armyworm' || h === 'aphids') && i % 3 === 0) put(this.pests, at(c.x, 0.1, c.z));
        }
      }
      // the sign's badge: check due, work to do, harvest
      const s = this.signs[farm];
      s.board.visible = !!t && farm < t.plans.length;
      let badge: string | null = null;
      if (growing && t && farm < t.plans.length) {
        if (day > CHECK_DAYS) badge = cut === FULL ? null : 'harvest';
        else if (setupDone && !t.checks[checkKey(farm, day)]) badge = 'check';
        else if (pend) badge = 'treat';
        else if (setupDone) badge = 'done';
      }
      s.badge.visible = !!badge;
      if (badge) s.badge.material.map = this.badgeTex[badge];
      s.badge.material.needsUpdate = true;
    }
    for (const m of meshes) {
      m.count = used.get(m)!;
      m.visible = m.count > 0;
    }
    for (const m of [this.base, ...meshes]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // the goat or the birds, when that is today's problem
    this.updateVisitors(f);
    // the harvest on the farmer's back
    const cobs = growing && day > CHECK_DAYS && t ? t.plans.reduce((n, _, i) => n + this.popMarks(i, 'harvest'), 0) : 0;
    const show = Math.min(12, Math.ceil(cobs / 3));
    this.farmer.cobs.children.forEach((c, i) => (c.visible = i < show));
  }

  /** How a farm has fared so far and how its plots grow: worked out once per trial and day (the field is redrawn
      many times a second while the farmer works, and these do not change with the work). */
  private grownCache: { t: Trial | null; day: number; farms: Map<number, { lost: number; plots: number[] }> } = { t: null, day: -1, farms: new Map() };
  private grown(t: Trial, farm: number, day: number) {
    const c = this.grownCache;
    if (c.t !== t || c.day !== day) this.grownCache = { t, day, farms: new Map() };
    let r = this.grownCache.farms.get(farm);
    if (!r) {
      r = { lost: day > 1 ? harvestFarm(t, farm, Math.min(day - 1, CHECK_DAYS)).lost : 0, plots: plotGrowth(t, farm) };
      this.grownCache.farms.set(farm, r);
    }
    return r;
  }

  private popMarks(farm: number, job: string) {
    let m = this.marks(farm, job);
    let n = 0;
    while (m) {
      m &= m - 1;
      n++;
    }
    return n;
  }

  private updateVisitors(f: Field) {
    const v = this.view!;
    const t = v.trial;
    const day = fieldDay(t, v.today);
    const find = (hz: TrialHazard) => {
      if (!t || day < 1 || day > CHECK_DAYS) return -1;
      return t.plans.findIndex((_, i) => !setupLeft(f, t, i) && hazardFor(t, i, day) === hz && !t.checks[checkKey(i, day)]?.treated && !isDone(f, t, i, `t${day}`, 1));
    };
    const g = find('livestock');
    if (g !== this.goatState.farm && this.goatState.leaving <= 0) {
      this.goatState.farm = g;
      if (g >= 0) {
        const p = PLOTS[g];
        this.goatState.at.set(p.x, p.z);
        this.goatState.to.set(p.x + 1, p.z);
      }
    }
    this.goat.root.visible = this.goatState.farm >= 0 || this.goatState.leaving > 0;
    const b = find('wildlife');
    if (b !== this.birdState.farm && this.birdState.leaving <= 0) this.birdState.farm = b;
    this.birds.forEach(bird => (bird.root.visible = this.birdState.farm >= 0 || this.birdState.leaving > 0));
  }

  /* ---------------- the farmer's work ---------------- */

  /** The job the farmer would do on this farm right now, with what they carry. */
  private jobAt(farm: number): { job: string; need: number; fx: Fx } | { hint: string } | null {
    const v = this.view!;
    const t = v.trial;
    if (!t || t.phase !== 'growing' || farm >= t.plans.length) return null;
    const f = this.liveField();
    const plan = t.plans[farm];
    const day = fieldDay(t, v.today);
    const carry = v.field.carry;
    const setup = setupLeft(f, t, farm);
    if (setup === 'prep') {
      if (machinePrep(plan)) return { hint: `${plan.land === 'tractor' ? 'Hire the tractor' : 'Hire the oxen'} at the Hire spot to plough Farm ${farm + 1}` };
      return { job: 'prep', need: FULL, fx: plan.land === 'slash' ? 'clear' : plan.land === 'mulch' ? 'mulch' : 'dig' };
    }
    if (setup === 'sow') return { job: 'sow', need: FULL, fx: 'seed' };
    if (setup === 'setupFeed') return carry === 'fertilizer' ? { job: 'setupFeed', need: needOf('setupFeed', t, farm), fx: 'fert' } : { hint: 'Get fertilizer from the shed: this farm gets it at planting' };
    if (day > CHECK_DAYS) return { job: 'harvest', need: FULL, fx: 'harvest' };
    const tr = careLeft(f, t, farm, day);
    if (!tr) return null;
    if (tr.job === 'weed') return { job: tr.key, need: tr.need, fx: 'weed' };
    if (tr.job === 'drain') return { job: tr.key, need: tr.need, fx: 'drain' };
    if (tr.job === 'water') return carry === 'water' ? { job: tr.key, need: tr.need, fx: 'water' } : { hint: 'Fill the watering can at the pond' };
    if (tr.job === 'feed') return carry === 'fertilizer' ? { job: tr.key, need: tr.need, fx: 'fert' } : { hint: 'Get fertilizer from the shed to top-dress' };
    if (tr.job === 'spray') return carry === 'sprayer' ? { job: tr.key, need: tr.need, fx: 'spray' } : { hint: 'Get the sprayer from the shed' };
    return null;
  }

  private doWork(dt: number) {
    const v = this.view;
    if (!v?.trial) return;
    const x = this.pos.x;
    const z = this.pos.y;
    const farm = PLOTS.findIndex(p => Math.abs(x - p.x) <= PLOT_W / 2 + 0.3 && Math.abs(z - p.z) <= PLOT_D / 2 + 0.3);
    if (farm < 0) return;
    // on the tractor, the tool decides the job, and only the plot under the tractor is worked
    if (this.riding) return this.rideWork(farm);
    const j = this.jobAt(farm);
    if (!j) return;
    // clearing and planting are done a plot at a time with a button (World.tsx), not by walking over the plots
    if (!('hint' in j) && (BUTTON_JOBS as readonly string[]).includes(j.job)) return;
    if ('hint' in j) {
      if (v.focus !== farm) return;
      const now = performance.now();
      if (now - this.lastHint > 5000) {
        this.lastHint = now;
        this.ev.hint(j.hint);
      }
      return;
    }
    const reach = WORK_REACH;
    let bits = 0;
    const done = this.marks(farm, j.job);
    for (let i = 0; i < TILES; i++) {
      const bit = 1 << i;
      if (!(j.need & bit) || done & bit) continue;
      const c = tileCenter(farm, i);
      if (Math.hypot(c.x - x, c.z - z) < reach) {
        bits |= bit;
        this.burst(j.fx, c.x, c.z, j.fx === 'harvest' ? 3 : 6);
      }
    }
    if (!bits) return;
    const key = `${farm}:${j.job}`;
    this.pending.set(key, (this.pending.get(key) ?? 0) | bits);
    this.work = 0.45;
    this.workFx = j.fx;
    this.dirty = true;
    this.ev.mark(farm, j.job, bits, false);
    void dt;
  }

  private rideHint(text: string) {
    const now = performance.now();
    if (now - this.lastHint < 4000) return;
    this.lastHint = now;
    this.ev.hint(text);
  }

  /** The tractor at work: the tool decides the job; it works the plots under it as it drives. */
  private rideWork(farm: number) {
    const v = this.view!;
    const t = v.trial;
    const rig = this.rig;
    if (!t || t.phase !== 'growing' || !rig || farm >= t.plans.length) return;
    const f = this.liveField();
    const day = fieldDay(t, v.today);
    const job = TOOL_JOB[rig.tool];
    const tool = toolName(rig.tool).toLowerCase();
    const setup = setupLeft(f, t, farm);
    let key: string | null = null;
    let need = 0;
    if (job === 'prep' || job === 'sow' || job === 'setupFeed') {
      if (setup === job) {
        key = job;
        need = needOf(job, t, farm);
      } else if (setup) return this.rideHint(`${farmName(farm)} needs to ${JOB_INFO[setup as PlotJob].name.toLowerCase()} first: the ${tool} is for later`);
      else return this.rideHint(`${farmName(farm)} is planted: nothing for the ${tool} here now`);
    } else if (job === 'harvest') {
      if (setup || day <= CHECK_DAYS) return this.rideHint(`The ${CROP_WORDS[cropOf(t, farm)].name} on ${farmName(farm)} is not ready to harvest yet`);
      key = 'harvest';
      need = FULL;
    } else {
      const c = day >= 1 && day <= CHECK_DAYS ? careLeft(f, t, farm, day) : null;
      if (c?.job !== 'spray') return this.rideHint(`Nothing to spray on ${farmName(farm)} today`);
      key = c.key;
      need = c.need;
    }
    if (!need) return this.rideHint(job === 'setupFeed' ? `${farmName(farm)} gets no fertilizer` : `${farmName(farm)} needs no ${tool} work`);
    const done = this.marks(farm, key);
    let bits = 0;
    for (let i = 0; i < TILES; i++) {
      const bit = 1 << i;
      if (!(need & bit) || done & bit) continue;
      const c = tileCenter(farm, i);
      if (Math.abs(c.x - this.pos.x) < TILE * 0.75 && Math.abs(c.z - this.pos.y) < TILE * 1.6) {
        bits |= bit;
        this.burst(this.fxOf(job), c.x, c.z, job === 'harvest' ? 3 : 6);
      }
    }
    if (!bits) return;
    const k = `${farm}:${key}`;
    this.pending.set(k, (this.pending.get(k) ?? 0) | bits);
    this.work = 0.45;
    this.workFx = this.fxOf(job);
    this.dirty = true;
    this.ev.mark(farm, key, bits, true, { tractor: rig.tractor, tool: rig.tool, job });
  }

  /* ---------------- clearing and planting, a row at a time (the button and timer are World.tsx's) ---------------- */

  /** The row of plots the farmer stands in and the button job it is waiting for (clear or plant), or null. bits: the
      row's plots still to do. */
  plotJobHere(): { farm: number; plot: number; row: number; bits: number; job: 'prep' | 'sow'; fx: Fx } | null {
    if (!this.view || this.riding) return null;
    const at = plotAt(this.pos.x, this.pos.y);
    if (!at) return null;
    const j = this.jobAt(at.farm);
    if (!j || 'hint' in j || !(BUTTON_JOBS as readonly string[]).includes(j.job)) return null;
    const row = rowOf(at.plot);
    const bits = rowMask(row) & j.need & ~this.marks(at.farm, j.job);
    if (!bits) return null;
    return { farm: at.farm, plot: at.plot, row, bits, job: j.job as 'prep' | 'sow', fx: j.fx };
  }

  /** Stop walking where the farmer stands (they start work on the plot under them). */
  stopWalking() {
    this.target = null;
  }

  /** The farmer is at work on a plot: keep the work animation going and throw a little soil or seed. */
  plotWorking(fx: Fx) {
    this.work = 0.45;
    this.workFx = fx;
    this.burst(fx, this.pos.x, this.pos.y, 2);
  }

  /** A row's clearing or planting is done: every plot of it is drawn at once (the state catches up) and reported. */
  plotFinished(farm: number, bits: number, job: 'prep' | 'sow', fx: Fx) {
    const k = `${farm}:${job}`;
    this.pending.set(k, (this.pending.get(k) ?? 0) | bits);
    for (let i = 0; i < TILES; i++) {
      if (!(bits & (1 << i))) continue;
      const c = tileCenter(farm, i);
      this.burst(fx, c.x, c.z, 4);
    }
    this.dirty = true;
    this.ev.mark(farm, job, bits, false);
  }

  private fxOf(job: PlotJob): Fx {
    const plan = this.view?.trial?.plans[0];
    void plan;
    return ({ prep: 'dig', sow: 'seed', setupFeed: 'fert', spray: 'spray', harvest: 'harvest' } as const)[job];
  }

  /* ---------------- the frame ---------------- */

  /** For the performance test: what the last frame drew and what a frame costs on the main thread. */
  private cpu = { ms: 0, frames: 0, drawn: 0 };
  perf() {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
      shadows: this.renderer.shadowMap.enabled,
      shadowSize: this.sun.shadow.mapSize.x,
      lowFx: this.lowFx,
      level: this.level,
      cpuMs: this.cpu.frames ? this.cpu.ms / this.cpu.frames : 0,
      frames: this.cpu.frames,
      drawn: this.cpu.drawn,
    };
  }
  resetPerf() {
    this.cpu = { ms: 0, frames: 0, drawn: 0 };
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.view?.paused) return;
    const t0 = performance.now();
    // on a phone, a still farm is drawn 30 times a second instead of 60 (cooler phone, longer battery)
    if (this.level > 0 && !this.busy && t0 - this.lastDraw < IDLE_FRAME_MS) return;
    this.adapt(t0);
    this.lastDraw = t0;
    this.frame();
    this.cpu.ms += performance.now() - t0;
    this.cpu.frames++;
  };
  private lastDraw = 0;
  /** something moves this frame (the farmer, the tractor, dust, a tap ring): draw every frame */
  private busy = true;
  private shadowTick = 0;

  private frame() {
    const dt = Math.min(0.1, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.move(dt);
    this.rideTractor(dt);
    this.doWork(dt);
    this.places();
    this.animateFarmer(dt, time);
    this.animateAnimals(dt, time);
    this.animateHire(dt);
    this.animateParticles(dt);
    if (this.dirty) {
      this.dirty = false;
      this.drawField();
    }
    // the green arrow over where the task card points
    const a = this.view?.arrowAt;
    this.arrow.visible = !!a;
    if (a) this.arrow.position.set(a.x, 2.0 + Math.sin(time * 4) * 0.18, a.z);
    this.arrow.rotation.y = time * 1.5;
    this.ringLife = Math.max(0, this.ringLife - dt);
    this.ring.visible = this.ringLife > 0;
    if (this.ring.visible) {
      this.ring.scale.setScalar(1.6 - this.ringLife);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = this.ringLife * 1.5;
    }
    this.followCamera(dt);
    if (!this.renderer.shadowMap.autoUpdate) this.renderer.shadowMap.needsUpdate = this.shadowTick++ % 2 === 0;
    this.renderer.render(this.scene, this.camera);
    this.cpu.drawn++;
    this.busy = this.walking > 0.01 || this.work > 0 || !!this.hire || this.ringLife > 0 || this.pData.some(d => d.life > 0);
  }

  /** Auto graphics: while things move, if frames come slowly for a few seconds, draw less: first a computer's
      setting drops to a phone's, then the shadows go and the picture is drawn at 1×. Checked in the first minute. */
  private level = 0;
  private lowFx = false;
  private gaps: number[] = [];
  private checkedFor = 0;
  private adapt(now: number) {
    if (this.lowFx || this.level >= 2) return;
    const gap = now - this.lastDraw;
    if (!this.busy || this.lastDraw === 0 || gap > 500) return;
    this.checkedFor += gap;
    if (this.checkedFor > 60_000) {
      this.lowFx = true;
      return;
    }
    this.gaps.push(gap);
    if (this.gaps.length < 90) return;
    const avg = this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length;
    this.gaps = [];
    // under about 25 frames a second
    if (avg > 40) this.setLevel(this.level + 1);
  }

  private setLevel(level: number) {
    this.level = Math.min(2, level);
    const q = QUALITY[this.level];
    const sh = this.renderer.shadowMap;
    sh.enabled = q.shadow > 0;
    sh.type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    sh.autoUpdate = this.level === 0;
    this.sun.castShadow = q.shadow > 0;
    if (q.shadow) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize(this.stageScale);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => (x.needsUpdate = true));
    });
  }

  private move(dt: number) {
    const dir = new THREE.Vector2();
    if (this.keys.has('w') || this.keys.has('arrowup')) dir.y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dir.y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dir.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dir.x += 1;
    if (this.joy.lengthSq() > 0.01) dir.copy(this.joy);
    // how far the spot being walked to is: a step never goes past it (a long frame on a slow phone, or a fast
    // farmer, used to overshoot and swing back and forth across it)
    let reach = Infinity;
    if (!dir.lengthSq() && this.target) {
      dir.subVectors(this.target, this.pos);
      reach = dir.length();
      if (reach < 0.15) {
        this.target = null;
        dir.set(0, 0);
        this.ev.arrived?.();
      }
    }
    const speed = 4.6 * this.speedScale * (this.riding ? RIDE_SPEED * (this.rig ? TRACTOR_PLOT[this.rig.tractor].speed : 1) : 1);
    if (dir.lengthSq() > 0) {
      const len = Math.min(1, dir.length());
      dir.normalize();
      this.heading = Math.atan2(dir.x, dir.y);
      const step = speed * len * dt;
      const lands = reach <= step;
      const next = this.pos.clone().addScaledVector(dir, Math.min(reach, step));
      this.collide(next);
      const blocked = !lands && !!this.target && next.distanceTo(this.pos) < speed * dt * 0.1;
      this.pos.copy(next);
      if (lands && this.target) {
        // this step ends on the spot (unless something solid stands there)
        const there = next.distanceTo(this.target) < 0.15;
        this.target = null;
        if (there) this.ev.arrived?.();
      } else if (blocked) this.target = null;
      this.walking = Math.min(1, this.walking + dt * 8);
    } else this.walking = Math.max(0, this.walking - dt * 8);
  }

  private collide(p: THREE.Vector2) {
    p.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, p.x));
    p.y = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, p.y));
    for (const o of this.obstacles) {
      const dx = p.x - o.x;
      const dz = p.y - o.z;
      const d = Math.hypot(dx, dz);
      const r = o.r + 0.35;
      if (d < r && d > 0.0001) {
        p.x = o.x + (dx / d) * r;
        p.y = o.z + (dz / d) * r;
      }
    }
    for (const r of this.rects) {
      const x0 = r.x0 - 0.3;
      const x1 = r.x1 + 0.3;
      const z0 = r.z0 - 0.3;
      const z1 = r.z1 + 0.3;
      if (p.x > x0 && p.x < x1 && p.y > z0 && p.y < z1) {
        const out = [p.x - x0, x1 - p.x, p.y - z0, z1 - p.y];
        const m = Math.min(...out);
        if (m === out[0]) p.x = x0;
        else if (m === out[1]) p.x = x1;
        else if (m === out[2]) p.y = z0;
        else p.y = z1;
      }
    }
  }

  /** The farmer already stands at a place and asks for it again (a tap on the task card that points there): the
      place answers as if they had just walked in. */
  revisit(place: Place) {
    if (this.inPlace === place) this.inPlace = null;
  }

  private places() {
    let now: Place | null = null;
    for (const [k, p] of Object.entries(PLACES) as [Place, (typeof PLACES)[Place]][]) {
      if (Math.hypot(this.pos.x - p.x, this.pos.y - p.z) >= p.r) continue;
      // A place answers when the farmer walks to it, or stops in it: not when a walk to somewhere else only passes
      // through. (The sheds stand in a row: the way from the sprayer shed to a farm crosses the fertilizer shed's
      // spot, which used to swap the sprayer for a fertilizer bag.)
      if (this.target && Math.hypot(this.target.x - p.x, this.target.y - p.z) >= p.r) continue;
      now = k;
    }
    if (now !== this.inPlace) {
      this.inPlace = now;
      if (now) {
        const item = PICKUP_OF[now];
        if (item) {
          if (this.view?.field.carry !== item) this.ev.carry(item);
        } else if (now === 'hire') {
          if (!this.riding) this.startHire();
        }
        else this.ev.place(now);
      }
    }
    // a farm's sign
    let sign = -1;
    const t = this.view?.trial;
    if (t && t.phase === 'growing')
      for (let f = 0; f < t.plans.length; f++) {
        const s = signOf(f);
        if (Math.hypot(this.pos.x - s.x, this.pos.y - s.z) < 1.3) sign = f;
      }
    if (sign !== this.atSign) {
      this.atSign = sign;
      this.ev.sign(sign);
    }
  }

  /* ---------------- the tractor seat ---------------- */

  isRiding() {
    return this.riding;
  }

  /** The parked tractor is close enough to hop on (and is not busy ploughing). */
  nearTractor() {
    return !this.hire && !this.riding && Math.hypot(this.pos.x - this.tractor.position.x, this.pos.y - this.tractor.position.z) < 3.4;
  }

  /** The tractor type and tool on the tractor now (null on foot). */
  getRig() {
    return this.riding ? this.rig : null;
  }

  /** The tractor is out on a hired job. */
  isBusy() {
    return !!this.hire;
  }

  mount(rig?: { tractor: TractorId; tool: ImplId }): 'ok' | 'busy' | 'far' {
    if (rig) this.rig = rig;
    if (this.riding) return 'ok';
    if (this.hire) return 'busy';
    if (!this.nearTractor()) return 'far';
    this.riding = true;
    this.target = null;
    this.pos.set(this.tractor.position.x, this.tractor.position.z);
    this.heading = this.tractor.rotation.y;
    return 'ok';
  }

  /** Get off beside the tractor, which stays where it was left. */
  dismount() {
    if (!this.riding) return;
    this.riding = false;
    this.target = null;
    this.pos.x += Math.cos(this.heading) * 1.7;
    this.pos.y -= Math.sin(this.heading) * 1.7;
    this.collide(this.pos);
    this.farmer.root.visible = true;
  }

  private rideTractor(dt: number) {
    if (!this.riding) return;
    const T = this.tractor;
    T.visible = true;
    T.position.set(this.pos.x, 0, this.pos.y);
    let d = this.heading - T.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    T.rotation.y += d * Math.min(1, dt * 8);
    // the farmer sits inside the cab
    this.farmer.root.visible = false;
  }

  private animateFarmer(dt: number, time: number) {
    const F = this.farmer;
    F.root.position.set(this.pos.x, 0, this.pos.y);
    // turn smoothly toward the heading
    let d = this.heading - F.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    F.root.rotation.y += d * Math.min(1, dt * 14);
    const w = this.walking;
    const sw = Math.sin(time * 11) * 0.7 * w;
    F.legL.rotation.x = sw;
    F.legR.rotation.x = -sw;
    F.armL.rotation.x = -sw * 0.8;
    F.body.position.y = Math.abs(Math.sin(time * 11)) * 0.06 * w;
    this.work = Math.max(0, this.work - dt);
    const fx = this.work > 0 ? this.workFx : null;
    if (fx) F.armR.rotation.x = -1.0 + Math.sin(time * 18) * 0.7;
    else F.armR.rotation.x = sw * 0.8;
    // what is in the hand and on the back
    const carry = this.view?.field.carry ?? null;
    const tool = fx === 'dig' || fx === 'drain' || fx === 'mulch' ? 'hoe' : fx === 'clear' || fx === 'weed' ? 'sickle' : carry === 'water' ? 'can' : carry === 'sprayer' ? 'wand' : null;
    for (const [k, o] of Object.entries(F.tools)) o.visible = k === tool;
    F.loads.seeds.visible = carry === 'seeds';
    F.loads.fertilizer.visible = carry === 'fertilizer';
    F.loads.sprayer.visible = carry === 'sprayer';
  }

  private animateAnimals(dt: number, time: number) {
    const wander = (a: { m: { root: THREE.Object3D }; at: THREE.Vector2; to: THREE.Vector2; wait: number }, area: Rect, speed: number) => {
      if (a.wait > 0) {
        a.wait -= dt;
        return 0;
      }
      const d = new THREE.Vector2().subVectors(a.to, a.at);
      if (d.length() < 0.1) {
        a.to.set(area.x0 + Math.random() * (area.x1 - area.x0), area.z0 + Math.random() * (area.z1 - area.z0));
        a.wait = 1 + Math.random() * 4;
        return 0;
      }
      d.normalize();
      a.at.addScaledVector(d, speed * dt);
      a.m.root.position.set(a.at.x, 0, a.at.y);
      a.m.root.rotation.y = Math.atan2(d.x, d.y);
      return 1;
    };
    for (const c of this.cows) {
      const moving = wander(c, { x0: -20.4, x1: -13, z0: -19.4, z1: -12.6 }, 0.6);
      c.m.head.rotation.x = moving ? 0 : 0.3 + Math.sin(time * 1.5 + c.at.x) * 0.15;
      c.m.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(time * 6 + i * Math.PI) * 0.4 : 0));
    }
    for (const h of this.hens) {
      const moving = wander(h, { x0: 4.6, x1: 10.6, z0: -17.0, z1: -14.6 }, 0.9);
      h.m.head.rotation.x = moving ? 0 : Math.max(0, Math.sin(time * 6 + h.at.x * 3)) * 0.9;
    }
    // the goat: wanders on its farm until chased off
    const gs = this.goatState;
    const g = this.goat;
    if (gs.leaving > 0) {
      gs.leaving -= dt;
      const d = new THREE.Vector2(-16, -12).sub(gs.at).normalize();
      gs.at.addScaledVector(d, 6 * dt);
      g.root.position.set(gs.at.x, Math.abs(Math.sin(time * 14)) * 0.15, gs.at.y);
      g.root.rotation.y = Math.atan2(d.x, d.y);
      if (gs.leaving <= 0) {
        gs.leaving = 0;
        this.dirty = true;
      }
    } else if (gs.farm >= 0) {
      const p = PLOTS[gs.farm];
      const d = new THREE.Vector2().subVectors(gs.to, gs.at);
      if (d.length() < 0.1) gs.to.set(p.x + (Math.random() - 0.5) * (PLOT_W - 1), p.z + (Math.random() - 0.5) * (PLOT_D - 1));
      else {
        d.normalize();
        gs.at.addScaledVector(d, 0.8 * dt);
        g.root.rotation.y = Math.atan2(d.x, d.y);
      }
      g.root.position.set(gs.at.x, 0, gs.at.y);
      g.head.rotation.x = 0.4 + Math.sin(time * 3) * 0.2;
      if (Math.hypot(this.pos.x - gs.at.x, this.pos.y - gs.at.y) < 1.3) this.chase('goat', gs.farm);
    }
    // the birds: hop about the farm, fly off when chased
    const bs = this.birdState;
    if (bs.leaving > 0) {
      bs.leaving -= dt;
      this.birds.forEach((b, i) => {
        b.root.position.y += dt * 4;
        b.root.position.x += dt * (i - 1.5) * 2;
        b.wl.rotation.z = Math.sin(time * 30) * 0.8;
        b.wr.rotation.z = -Math.sin(time * 30) * 0.8;
      });
      if (bs.leaving <= 0) {
        bs.leaving = 0;
        this.dirty = true;
      }
    } else if (bs.farm >= 0) {
      const p = PLOTS[bs.farm];
      this.birds.forEach((b, i) => {
        const a = time * 0.4 + i * 1.7;
        b.root.position.set(p.x + Math.cos(a) * 1.3, 1.2 + Math.abs(Math.sin(time * 5 + i)) * 0.12, p.z + Math.sin(a * 1.3) * 2);
        b.root.rotation.y = a + Math.PI / 2;
        b.wl.rotation.z = 0;
        b.wr.rotation.z = 0;
      });
      if (Math.hypot(this.pos.x - p.x, this.pos.y - p.z) < 2.0) this.chase('birds', bs.farm);
    }
  }

  /** The farmer reached the goat or the birds: they leave only once the problem has been read right. */
  private chase(kind: 'goat' | 'birds', farm: number) {
    const v = this.view!;
    const t = v.trial!;
    const day = fieldDay(t, v.today);
    const tr = treatLeft(this.liveField(), t, farm, day);
    if (tr && tr.job === kind) {
      this.pending.set(`${farm}:${tr.key}`, 1);
      this.ev.mark(farm, tr.key, 1);
      if (kind === 'goat') {
        this.goatState.leaving = 2.2;
        this.goatState.farm = -1;
      } else {
        this.birdState.leaving = 1.6;
        this.birdState.farm = -1;
      }
      this.work = 0.6;
      this.workFx = 'weed';
    } else if (!t.checks[checkKey(farm, day)]) {
      const now = performance.now();
      if (now - this.lastHint > 5000) {
        this.lastHint = now;
        this.ev.hint(`Check Farm ${farm + 1} at its sign first: read what is wrong, then deal with it`);
      }
    }
  }

  /** Farms the oxen or tractor can plough now. A tractor-hire farm is driven by the player first (the tractor
      screen, from Wakala Agent); the 3D tractor then shows that work on the plot. Oxen plough by themselves. */
  private hireFarms(t: Trial, f: Field) {
    const waiting = t.plans.map((_, i) => i).filter(i => machinePrep(t.plans[i]) && setupLeft(f, t, i) === 'prep');
    const toDrive = waiting.filter(i => t.plans[i].land === 'tractor' && !t.tractor?.[i]);
    return { ready: waiting.filter(i => !toDrive.includes(i)), toDrive, any: waiting.length > 0 };
  }

  /** The tractor (or oxen) ploughs every farm whose plan hires it, row by row. */
  private startHire(atSpot = true) {
    const v = this.view;
    const t = v?.trial;
    if (!t || t.phase !== 'growing') return atSpot ? this.ev.hint('Nothing to hire now: plan your farms first') : undefined;
    if (this.riding) return atSpot ? this.ev.hint('Get off the tractor first: the hire tractor is the one you are sitting on') : undefined;
    const f = this.liveField();
    const { ready, toDrive, any } = this.hireFarms(t, f);
    if (!any) return atSpot ? this.ev.hint('No farm needs ploughing now. Tractor or oxen hire is a land-prep choice in the plan') : undefined;
    // at the Hire spot, a tractor farm not yet driven opens the drive (World.tsx); the hire starts after it
    if (atSpot && toDrive.length) return this.ev.place('hire');
    const farms = ready;
    if (!farms.length) return;
    if (this.hire) return;
    if (atSpot) this.ev.place('hire');
    const path: THREE.Vector2[] = [];
    const farmOf: number[] = [];
    for (const farm of farms) {
      const p = PLOTS[farm];
      if (t.plans[farm].land === 'tractor') {
        // the tractor's swath is three times a farmer's: one pass down the middle works all four columns
        path.push(new THREE.Vector2(p.x, p.z - PLOT_D / 2 - 0.6), new THREE.Vector2(p.x, p.z + PLOT_D / 2 + 0.6));
        farmOf.push(farm, farm);
        continue;
      }
      for (let pass = 0; pass < 2; pass++) {
        const x = p.x + (pass ? 0.6 : -0.6) * TILE;
        const zs = pass ? [p.z + PLOT_D / 2 + 0.6, p.z - PLOT_D / 2 - 0.6] : [p.z - PLOT_D / 2 - 0.6, p.z + PLOT_D / 2 + 0.6];
        path.push(new THREE.Vector2(x, zs[0]), new THREE.Vector2(x, zs[1]));
        farmOf.push(farm, farm);
      }
    }
    const home = new THREE.Vector2(TRACTOR_HOME.x, TRACTOR_HOME.z);
    path.push(home);
    farmOf.push(-1);
    this.hire = { farms, path, i: 0, farmOf, home };
    const useOx = t.plans[farms[0]].land === 'ox';
    this.oxen.visible = useOx;
    this.tractor.visible = !useOx;
    (useOx ? this.oxen : this.tractor).position.set(home.x, 0, home.y);
  }

  private animateHire(dt: number) {
    const h = this.hire;
    // a hire that was paid for but not finished (the game was closed) carries on by itself
    if (!h) {
      const v = this.view;
      const t = v?.trial;
      if (t && t.phase === 'growing' && v.field.hired && v.field.cycle === t.cycle) {
        if (this.hireFarms(t, this.liveField()).ready.length) this.startHire(false);
      }
      return;
    }
    const t = this.view?.trial;
    const farm = h.farmOf[h.i];
    const veh = farm >= 0 && t?.plans[farm]?.land === 'ox' ? this.oxen : this.oxen.visible && farm < 0 ? this.oxen : this.tractor;
    this.oxen.visible = veh === this.oxen;
    this.tractor.visible = veh === this.tractor || !this.oxen.visible;
    const goal = h.path[h.i];
    const at2 = new THREE.Vector2(veh.position.x, veh.position.z);
    const d = new THREE.Vector2().subVectors(goal, at2);
    const step = (veh === this.oxen ? 2.6 : 4.6 * RIDE_SPEED) * dt;
    if (d.length() <= step) {
      veh.position.set(goal.x, 0, goal.y);
      h.i++;
      if (h.i >= h.path.length) {
        this.hire = null;
        this.oxen.visible = false;
        this.tractor.visible = true;
        this.tractor.position.set(TRACTOR_HOME.x, 0, TRACTOR_HOME.z);
        this.tractor.rotation.y = Math.PI / 2;
      }
      return;
    }
    d.normalize();
    veh.position.x += d.x * step;
    veh.position.z += d.y * step;
    veh.rotation.y = Math.atan2(d.x, d.y);
    if (farm >= 0) {
      let bits = 0;
      const done = this.marks(farm, 'prep');
      for (let i = 0; i < TILES; i++) {
        const c = tileCenter(farm, i);
        if (!(done & (1 << i)) && Math.hypot(c.x - veh.position.x, c.z - veh.position.z) < (veh === this.oxen ? 1.25 : TRACTOR_REACH)) bits |= 1 << i;
      }
      if (bits) {
        this.pending.set(`${farm}:prep`, (this.pending.get(`${farm}:prep`) ?? 0) | bits);
        this.ev.mark(farm, 'prep', bits);
        this.dirty = true;
        const c = tileCenter(farm, Math.log2(bits & -bits));
        this.burst('dig', c.x, c.z, 4);
      }
    }
  }

  private animateParticles(dt: number) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.pData.length; i++) {
      const d = this.pData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 7 * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.12) {
        d.p.y = 0.12;
        d.v.multiplyScalar(0.3);
      }
      const s = d.life > 0 ? d.s * Math.min(1, d.life * 3) : 0;
      m.compose(d.p, new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      this.parts.setMatrixAt(i, m);
    }
    this.parts.instanceMatrix.needsUpdate = true;
  }

  private camAt = new THREE.Vector3();
  private snapCamera() {
    this.camAt.set(this.pos.x, 0, this.pos.y);
    this.placeCamera();
  }

  private followCamera(dt: number) {
    const want = new THREE.Vector3(this.pos.x, 0, this.pos.y);
    this.camAt.lerp(want, Math.min(1, dt * 5));
    this.placeCamera();
  }

  private placeCamera() {
    const a = this.camAt;
    this.camera.position.set(a.x, 13.5, a.z + 9.6);
    this.camera.lookAt(a.x, 0.4, a.z + 0.6);
    this.sun.position.set(a.x - 9, 22, a.z + 9);
    this.sun.target.position.set(a.x, 0, a.z);
  }
}

