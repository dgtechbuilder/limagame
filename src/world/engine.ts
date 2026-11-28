/* The farm world: a walkable 3D farm in three.js. The farmer walks (tap, drag or keys). Clearing and planting are
   done a plot at a time with a button (World.tsx); walking over a farm's plots does its other jobs with the right tool
   or load. The React side (World.tsx) owns the game state;
   this engine draws it and reports what the farmer did. */

import * as THREE from 'three';
import { padStick } from '../input/gamepad';
import { RIDE_SPEED, TRACTOR_EDGE, type ImplId } from '../tractor/data';
import { slotBrand, type SlotId } from '../partners/data';
import { TIDY, type TidyItem } from '../tidy/model';
import { FEEDER } from '../onsite/spots';
import { JOB_INFO, ROUTINE, TRACTOR_PLOT, toolJobs, toolName, type PlotJob, type TractorId } from '../plots/data';
import { CHECK_DAYS, CROP_WORDS, checkKey, cropOf, farmName, harvestFarm, hazardFor, isResting, plotGrowth, restOf, type Trial, type TrialHazard } from '../trials/model';
import { REST } from '../soil/model';
import { footstep, type Ground } from '../audio/ambience';
import { built, farmNight, farmSounds, hearAt, powerOn, workDone, working, type HumSpot } from '../audio/farm';
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
  problemTiles,
  jobOf,
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
  GH_BED,
  GREENHOUSE_AT,
  STOREHOUSE_AT,
  STORAGE_AT,
  ghBedCenter,
  followUpLeft,
  routineLeft,
  type Carry,
  type Field,
  type Place,
} from './field';
import {
  C,
  G,
  at,
  badgeTexture,
  billboardTexture,
  type Billboard,
  liveryTexture,
  makeBillboard,
  whenBrandFontReady,
  board,
  bush,
  forest,
  forestSignTexture,
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
  strigaTile,
  moundTile,
  gullyTile,
  trenchTile,
  mulchTile,
  place,
  pond,
  waterTank,
  puddleTile,
  rock,
  rockPile,
  roundRect,
  shed,
  sharpText,
  signTexture,
  stall,
  restaurant,
  RESTAURANT_FRIDGE,
  tree,
  trough,
  vcMaterial,
  weedTile,
  wildBush,
  wildTile,
  zoneTexture,
  solarFrame,
  powerHut,
  inverterBox,
  batteryBank,
  generatorSet,
  fuelTank,
  lampPole,
  roofedShed,
  zeroGrazing,
  crate,
  glassHouse,
  glassMaterial,
  greenhousePlant,
  jar,
  nameBoardTexture,
  freezerAnnex,
  freezerDisplayTexture,
  FREEZER,
  raisedBed,
  sack,
  SHELF,
  shelfUnit,
  workTable,
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
/** The longest the first frame waits for the shaders to finish compiling (the loading screen stays under 2 seconds). */
const WARM_MAX_MS = 1500;

/** A phone or a small, low-memory device: it gets the lighter picture on Auto graphics. */
function phoneLike() {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return window.matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600 || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  } catch {
    return false;
  }
}
/** The dirt yard and the paths (x0, z0, x1, z1): drawn as packed soil, and walked on as soil. */
const PATHS: [number, number, number, number][] = [
  [-12.8, -10.0, 12.8, 10.0],
  [-1.5, -16.6, 1.5, -9.5],
  [-17.0, -2.9, -12.3, 2.9],
  [12.3, -1.5, 14.8, 1.5],
  [-1.5, 9.5, 1.5, 14.2],
  [-16.0, 4.8, -12.3, 7.8],
];

/** Where the tractor waits, and a spot beside it to walk to (clear of the Hire spot, which opens the hire screen). */
const TRACTOR_HOME = { x: -17.4, z: 6.4 };
/** The mini forest: 10 acres of idle land, bottom right of the farm, below the pond (the pond is at x 18.4, z 0). */
export const FOREST = { x0: 15.0, z0: 5.0, x1: 21.8, z1: 16.4, sign: { x: 13.8, z: 5.4 } };
/** The water tank on its stand beside the pond (between the pond and the mini forest). */
export const WATER_TANK = { x: 19.8, z: 3.9 };
/** The power yard (src/power), top right of the farm above the pond: solar panels, the power hut (inverter and
    batteries), the generator and the diesel tank. */
export const POWER_YARD = { x0: 14.8, z0: -18.4, x1: 21.8, z1: -5.0 };
/** Where the restaurant stands (turned to face the lane), and the machines that hum as the farmer walks up to them:
    the restaurant's fridge and the storage annex's freezer (src/audio/farm.ts). */
const RESTAURANT_AT = { x: 3.5, z: 15.75 };
export const HUM_SPOTS: HumSpot[] = [
  // the restaurant is turned half a turn, so its own x and z run the other way
  { kind: 'fridge', x: RESTAURANT_AT.x - RESTAURANT_FRIDGE.x, z: RESTAURANT_AT.z - RESTAURANT_FRIDGE.z },
  { kind: 'freezer', x: STORAGE_AT.x, z: STORAGE_AT.z },
];
/** The farm's light poles (src/power: day 4), along the paths and by the buildings; the first few carry a real light. */
export const LAMPS: { x: number; z: number }[] = [
  { x: -2.4, z: -12.2 },
  { x: 2.4, z: -9.0 },
  { x: -12.4, z: -4.0 },
  { x: 12.0, z: -4.4 },
  { x: -11.2, z: -11.0 },
  { x: 10.6, z: -16.6 },
  { x: -2.2, z: 10.8 },
  { x: 2.2, z: 13.6 },
  { x: -12.6, z: 9.0 },
  { x: 11.4, z: 2.4 },
];
export const TRACTOR_BOARD = { x: -17.4, z: 8.6 };

/** The partner billboards across the farm (src/partners/data.ts sets the brand on each): two in the yard either side of
    the farmhouse path, one by the seed shed and one on the bottom-right corner of the mini forest, against the fence, where
    it hides only the edge of the trees and none of the farm. Each stands on one steel pole
    and is turned a little (ry) toward the path the farmer walks. */
export const BILLBOARDS: { slot: SlotId; x: number; z: number; ry: number }[] = [
  { slot: 'world-billboard-west', x: -7.6, z: -14.9, ry: 0.14 },
  { slot: 'world-billboard-east', x: 12.6, z: -14.6, ry: -0.14 },
  { slot: 'world-billboard-shed', x: -19.0, z: -7.8, ry: 0.2 },
  { slot: 'world-billboard-forest', x: 20.6, z: 16.5, ry: -0.35 },
];
/** How often a sweep of light crosses a billboard (seconds), and how long it takes. */
const SWEEP = { every: 7, takes: 1.1 };

/** The tractor partner's name on the bonnet, if one has the slot. */
function tractorLivery() {
  const b = slotBrand('world-tractor');
  return b ? { side: liveryTexture(b.name, b.color, b.accent), top: liveryTexture(b.name, b.color, b.accent, 180) } : undefined;
}

export const STAGE_W = 874;
export const STAGE_H = 402;

export const PLACES: Record<Place, { x: number; z: number; r: number }> = {
  mission: { x: 4.4, z: -11.2, r: 1.2 },
  'shed-seeds': { x: -14.2, z: -1.9, r: 0.85 },
  'shed-fertilizer': { x: -14.2, z: 0, r: 0.85 },
  'shed-sprayer': { x: -14.2, z: 1.9, r: 0.85 },
  pond: { x: 13.6, z: 0, r: 1.1 },
  hire: { x: -14.6, z: 6.4, r: 1.2 },
  /** Each place's white square sits on open ground the camera can see: the camera looks down from the south (+z), so
      a roof or an awning hides the ground just north of it. The market's and the restaurant's squares stand out in
      front of their awnings, the storehouse's on the grass before its front wall, the house's below the porch step. */
  market: { x: 0, z: 11.6, r: 1.3 },
  /** the mini restaurant beside the stall: meals from the store (src/produce/restaurant.ts) */
  restaurant: { x: 3.4, z: 11.9, r: 0.95 },
  /** the greenhouse's door, facing the market path (src/greenhouse) */
  greenhouse: { x: GREENHOUSE_AT.x + GREENHOUSE_AT.w / 2 + 1.3, z: GREENHOUSE_AT.z - 0.3, r: 0.85 },
  /** the storehouse's square, in front of the building where the camera sees it (src/storehouse), towards its left
      end so a daily tidy-up bush (src/tidy) never grows on it. Its door stays in the back wall on the lane: opting in
      here walks the farmer round to it (STOREHOUSE_WALK), then the store opens. */
  storehouse: { x: STOREHOUSE_AT.x - STOREHOUSE_AT.w / 2 + 0.3, z: STOREHOUSE_AT.z + STOREHOUSE_AT.d / 2 + 0.9, r: 0.85 },
  /** the storage annex's freezer door, in its front wall (src/storehouse: the store and its cold room) */
  storage: { x: STORAGE_AT.x, z: STORAGE_AT.z + STORAGE_AT.d / 2 + 1.0, r: 0.85 },
  house: { x: 0, z: -14.1, r: 1.0 },
  /** the cow pen's gate and the chicken coop's door: the Animals page (src/livestock) */
  pen: { x: -10.7, z: -13.0, r: 1.0 },
  coop: { x: 8.2, z: -16.0, r: 1.0 },
  /** beside the power yard's fence, on the grass above the lane's corner: the Power page */
  power: { x: 13.5, z: -11.4, r: 1.1 },
  /** on the grass above the mini forest's sign, between the pond path and the forest (the camera looks from the south,
      so the billboard and the storage annex further down would hide a square on the ground): the Mini forest page (src/forest) */
  forest: { x: 14.5, z: 3.3, r: 1.0 },
};

/** The storehouse's door, in its back wall on the lane. */
export const STOREHOUSE_DOOR = { x: STOREHOUSE_AT.x + STOREHOUSE_AT.door, z: STOREHOUSE_AT.z - STOREHOUSE_AT.d / 2 - 1.95 };
/** From the storehouse's square to its door: round the storage annex's right-hand side (the restaurant closes the way
    round the left), between the annex and the mini forest, then across to the lane. The turns keep clear of the tree
    at the forest's corner and of the forest billboard's pole. */
export const STOREHOUSE_WALK = [
  { x: STORAGE_AT.x + STORAGE_AT.w / 2 + 0.65, z: STORAGE_AT.z + STORAGE_AT.d / 2 + 0.6 },
  { x: STORAGE_AT.x + STORAGE_AT.w / 2 + 0.7, z: STORAGE_AT.z - STORAGE_AT.d / 2 - 0.6 },
  STOREHOUSE_DOOR,
];

/** How many cows and hens there are, and the coop (src/livestock): the 3D farm shows them. */
export interface FarmLife {
  cows: number;
  hens: number;
  coop: 'basic' | 'secure' | null;
  shed?: 'roofed' | 'zero' | null;
}

/** What the farm's power system has built, and whether its lights are lit (src/power). */
export interface FarmPower {
  parts: string[];
  lit: boolean;
}

/** A greenhouse bed's crop and how far it has grown (src/greenhouse): stage -1 nothing planted; need: its badge. */
export interface FarmBed {
  crop: string | null;
  stage: number;
  need: 'plant' | 'water' | 'pick' | null;
}

/** What is on the storehouse's shelves (src/storehouse), in kg. */
export interface FarmStore {
  fresh: { color: string; kg: number }[];
  keeps: number;
  made: { color: string; kg: number }[];
}

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

export type Fx = 'dig' | 'clear' | 'mulch' | 'seed' | 'fert' | 'water' | 'spray' | 'weed' | 'drain' | 'harvest' | 'stone' | 'hay' | 'milk' | 'spark' | 'oil';

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
  /** a walk with turns (walkRoute): the spots still to walk to after the target, and what happens on the last one */
  private route: { stops: THREE.Vector2[]; then: () => void } | null = null;
  private joy = new THREE.Vector2();
  private keys = new Set<string>();
  private walking = 0;
  /** each farm's cleared or tilled plots (bare soil underfoot; the rest of a farm is grass) */
  private soilBits: number[] = PLOTS.map(() => 0);
  /** which half-stride the farmer is in: a footstep sounds as it changes */
  private stride = 0;
  /** play-tests shorten the plot timer (1 = the real 3 seconds) */
  workScale = 1;
  private work = 0;
  private workFx: Fx | null = null;
  /** the tool in hand for a job done by hand (src/onsite), while the work goes on */
  private jobTool: string | null = null;
  /** a part or a tool on the farmer's back, on the way to where it goes */
  private crateOn = false;
  /** the feed in the cow feeder: a heap that rises while it is poured and goes down as the cows eat */
  private feed = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: '#f2c81e' }));
  private feedLevel = 0.2;
  private pouring = 0;
  private lastHint = 0;
  private inPlace: Place | null = null;
  private atSign = -1;
  private pending = new Map<string, number>();
  /** walking speed multiplier (automated play-tests run faster) */
  speedScale = 1;
  /** the tractor's speed from the driver's level and its condition (src/tractor/hub.ts) */
  tractorSpeed = 1;
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
  // the newer problems on the tiles (trials/model.ts NEW_HAZARDS), and what the work by hand leaves
  private striga!: THREE.InstancedMesh;
  private mounds!: THREE.InstancedMesh;
  private gullies!: THREE.InstancedMesh;
  private trenches!: THREE.InstancedMesh;
  private mulch!: THREE.InstancedMesh;
  private hail!: THREE.InstancedMesh;
  private pests!: THREE.InstancedMesh;
  private signs: { badge: THREE.Sprite; board: THREE.Group }[] = [];
  private badgeTex: Record<string, THREE.Texture> = {};

  // animals and helpers
  private cows: { m: ReturnType<typeof makeQuadruped>; at: THREE.Vector2; to: THREE.Vector2; wait: number; hold?: number; look?: number }[] = [];
  private hens: { m: ReturnType<typeof makeChicken>; at: THREE.Vector2; to: THREE.Vector2; wait: number; hold?: number }[] = [];
  private goat = makeQuadruped('goat');
  private goatState = { farm: -1, at: new THREE.Vector2(), to: new THREE.Vector2(), leaving: 0 };
  private birds: ReturnType<typeof makeBird>[] = [];
  private birdState = { farm: -1, leaving: 0 };
  private tractor = makeTractor(tractorLivery());
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
  /** the partner billboards: their face, sweep of light and lamp lenses (lit at night) */
  private billboards: (Billboard & { tex: ReturnType<typeof billboardTexture> })[] = [];
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
    this.hemi = hemi;
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
    // the farm's air and the hums of the restaurant's fridge and the storage annex's freezer (src/audio/farm.ts)
    farmSounds(HUM_SPOTS);
    this.scene.add(this.arrow);
    this.arrow.visible = false;
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);

    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    // build every shader now, while the farm opens, not in the middle of the first walk (a stall on a phone). They
    // are compiled in parallel, off the main thread where the browser can (KHR_parallel_shader_compile): drawing a
    // frame before they are linked blocks the page for seconds on a phone, so the first frame waits for them (or
    // for WARM_MAX_MS, whichever is first) behind the loading screen (World.tsx).
    this.ready = this.warm();
  }

  /** Settles once the farm's first frame has been drawn: the loading screen comes off then. */
  readonly ready: Promise<void>;
  private disposed = false;
  private firstFrame: (() => void) | null = null;

  private async warm() {
    try {
      await Promise.race([this.renderer.compileAsync(this.scene, this.camera), new Promise(r => setTimeout(r, WARM_MAX_MS))]);
    } catch {
      /* compiled on first use instead */
    }
    if (this.disposed) return;
    await new Promise<void>(resolve => {
      this.firstFrame = resolve;
      this.loop();
    });
  }

  dispose() {
    this.disposed = true;
    farmSounds(null);
    this.firstFrame?.();
    this.firstFrame = null;
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
    this.route = null;
    this.target = new THREE.Vector2(x, z);
  }

  /** Walk spot by spot (round a building), then `then()` on the last one. Anything that stops the walk on the way (a
      tap, the joystick, the keys, a wall) drops the rest of it, and `then` never runs. */
  walkRoute(stops: { x: number; z: number }[], then: () => void) {
    const [first, ...rest] = stops.map(s => new THREE.Vector2(s.x, s.z));
    if (!first) return then();
    this.route = { stops: rest, then };
    this.target = first;
  }

  /** The farmer is on the spot walked to: on to the route's next spot, or the walk is over. */
  private reached() {
    const r = this.route;
    if (r) {
      const next = r.stops.shift();
      if (next) {
        this.target = next;
        return;
      }
      this.route = null;
      r.then();
    }
    this.ev.arrived?.();
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
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
    if (e.type === 'keydown') this.keys.add(k);
    else this.keys.delete(k);
    this.target = null;
    // the farm took the arrows (a controller's D-pad moves the focus on screens on top instead: input/gamepad.ts)
    if (!this.view?.paused && !document.querySelector('[aria-modal="true"]')) e.preventDefault();
  };

  /* ---------------- building the farm ---------------- */

  private buildStatic() {
    const smooth: Part[] = [];
    const flat: Part[] = [];
    // ground and paths
    smooth.push({ geo: G.plane, color: C.grass, m: at(0, 0, -2, { sx: 120, sz: 110 }) });
    const pathRects = PATHS;
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
    // the mini restaurant beside the stall, its counter facing the lane
    smooth.push(...place(restaurant(), at(RESTAURANT_AT.x, 0, RESTAURANT_AT.z, { ry: Math.PI })));
    this.obstacles.push({ x: 3.5, z: 15.9, r: 0.95 });
    smooth.push(...place(board(), at(4.4, 0, -12.4)));
    // partner billboards (a slot with no partner has no billboard): one pole each, the only thing that blocks
    for (const bb of BILLBOARDS) {
      const brand = slotBrand(bb.slot);
      if (!brand) continue;
      const tex = billboardTexture(brand);
      const b = makeBillboard(tex);
      b.group.position.set(bb.x, 0, bb.z);
      b.group.rotation.y = bb.ry;
      b.group.scale.setScalar(1.3);
      this.scene.add(b.group);
      this.billboards.push({ ...b, tex });
      this.obstacles.push({ x: bb.x, z: bb.z, r: 0.45 });
    }
    whenBrandFontReady(() => this.billboards.forEach(b => b.tex.redraw()));
    smooth.push(...place(pond(), at(18.4, 0, 0)));
    // the water tank on its stand at the pond's lower-right edge, above the mini forest, its pump pipe running down into the pond
    smooth.push(...place(waterTank(1.6), at(WATER_TANK.x, 0, WATER_TANK.z)));
    // the cow feeder sits on the pen's front fence, in the open bay (fence(..., 3)): poured from outside, eaten from inside
    smooth.push(...place(trough(), at(FEEDER.x, 0, FEEDER.z)));
    this.feed.position.set(FEEDER.x, 0.4, FEEDER.z);
    this.feed.castShadow = true;
    this.scene.add(this.feed);
    // the chicken coop is built by the player from day 2 (buildCoops: a pile of timber until then)
    // fences: the yard, and the cow pen
    smooth.push(...fence(-22.4, -21.2, 22.4, -21.2));
    smooth.push(...fence(-22.4, 17.6, -2.4, 17.6));
    smooth.push(...fence(2.4, 17.6, 22.4, 17.6));
    smooth.push(...fence(-22.4, -21.2, -22.4, 17.6));
    smooth.push(...fence(22.4, -21.2, 22.4, 17.6));
    smooth.push(...fence(-21.4, -11.6, -12.0, -11.6, 3));
    smooth.push(...fence(-12.0, -11.6, -12.0, -20.4));
    smooth.push(...fence(-12.0, -20.4, -21.4, -20.4));
    smooth.push(...fence(-21.4, -20.4, -21.4, -11.6));
    // trees, bushes, grass, rocks, flowers on the grass around
    const trees: [number, number, number][] = [
      [-20, 12, 1],
      [-17.5, 14.8, 0.8],
      [-6.8, -19.4, 0.9],
      [13.2, -19.6, 0.9],
      [-11.4, 16.0, 0.85],
      [14.2, 16.2, 0.9],
      [-20.0, 9.0, 0.7],
    ];
    for (const [x, z, s] of trees) {
      flat.push(...place(tree(s, (x * 7 + z) % 2 ? 1 : 0), at(x, 0, z)));
      this.obstacles.push({ x, z, r: 0.7 * s });
    }
    // the mini forest: 10 acres of idle land left to grow, bottom right of the farm below the pond (climate/land.ts)
    const fo = forest(FOREST.x0, FOREST.z0, FOREST.x1, FOREST.z1);
    smooth.push(...fo.floor);
    flat.push(...fo.parts);
    for (const t of fo.trunks) this.obstacles.push(t);
    {
      const post = new THREE.Mesh(G.cyl6, new THREE.MeshLambertMaterial({ color: '#8b5a2b' }));
      post.scale.set(0.14, 1.3, 0.14);
      post.position.set(FOREST.sign.x, 0.65, FOREST.sign.z);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), sharpText(new THREE.MeshLambertMaterial({ map: forestSignTexture() })));
      face.position.set(FOREST.sign.x, 1.55, FOREST.sign.z + 0.1);
      face.rotation.x = -0.55;
      post.castShadow = true;
      this.scene.add(post, face);
      this.obstacles.push({ x: FOREST.sign.x, z: FOREST.sign.z, r: 0.3 });
    }
    const bushes: [number, number, number][] = [
      [-14.2, 10.6, 1],
      [-3.6, -14.0, 0.7],
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
      { x0: -21.6, x1: -11.7, z0: -20.6, z1: -11.15 },
      { x0: 6.9, x1: 9.5, z0: -19.4, z1: -17.4 },
    );
    this.obstacles.push({ x: WATER_TANK.x, z: WATER_TANK.z, r: 1.1 });
    this.obstacles.push({ x: 18.4, z: 0, r: 3.2 }, { x: 4.4, z: -12.4, r: 0.6 });

    // interaction spots
    const glyphs: Record<string, (g: CanvasRenderingContext2D) => void> = {
      sprout: g => {
        g.fillStyle = '#fff';
        g.fillRect(-4, -6, 8, 46);
        g.beginPath();
        g.ellipse(-20, -14, 22, 11, -0.6, 0, Math.PI * 2);
        g.ellipse(20, -26, 22, 11, 0.6, 0, Math.PI * 2);
        g.fill();
      },
      snow: g => {
        g.strokeStyle = '#fff';
        g.lineWidth = 8;
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          g.save();
          g.rotate((i * Math.PI) / 3);
          g.beginPath();
          g.moveTo(0, -42);
          g.lineTo(0, 42);
          for (const e of [-1, 1]) {
            g.moveTo(0, e * 26);
            g.lineTo(-12, e * 38);
            g.moveTo(0, e * 26);
            g.lineTo(12, e * 38);
          }
          g.stroke();
          g.restore();
        }
      },
      crate: g => {
        g.fillStyle = '#fff';
        g.fillRect(-40, -20, 80, 54);
        g.fillRect(-46, -30, 92, 10);
        g.clearRect(-30, -8, 60, 6);
        g.clearRect(-30, 10, 60, 6);
      },
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
      cow: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(-6, 6, 34, 20, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(22, -24, 22, 26);
        g.fillRect(-34, 18, 8, 26);
        g.fillRect(14, 18, 8, 26);
      },
      hen: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(-4, 10, 30, 24, 0, 0, Math.PI * 2);
        g.arc(22, -18, 13, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(34, -20);
        g.lineTo(46, -14);
        g.lineTo(34, -12);
        g.fill();
      },
      bowl: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.moveTo(-42, -6);
        g.lineTo(42, -6);
        g.quadraticCurveTo(40, 36, 0, 36);
        g.quadraticCurveTo(-40, 36, -42, -6);
        g.fill();
        // steam
        g.strokeStyle = '#fff';
        g.lineWidth = 7;
        g.lineCap = 'round';
        for (const x of [-16, 0, 16]) {
          g.beginPath();
          g.moveTo(x, -16);
          g.quadraticCurveTo(x + 9, -28, x, -40);
          g.stroke();
        }
      },
      bag: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2);
        g.fill();
      },
      // the mini forest: three round storybook trees on a mound, the middle one taller (the HUD button's icon, forest/art.tsx)
      tree: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(0, 40, 46, 9, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(-4, -6, 8, 46);
        g.fillRect(-30, 8, 6, 32);
        g.fillRect(24, 8, 6, 32);
        g.beginPath();
        g.arc(-27, 2, 17, 0, Math.PI * 2);
        g.arc(27, 2, 17, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(0, -18, 25, 0, Math.PI * 2);
        g.fill();
      },
      bolt: g => {
        g.fillStyle = '#fff';
        g.beginPath();
        g.moveTo(8, -46);
        g.lineTo(-26, 4);
        g.lineTo(-2, 4);
        g.lineTo(-10, 44);
        g.lineTo(26, -8);
        g.lineTo(2, -8);
        g.closePath();
        g.fill();
      },
    };
    const zones: [Place, string, string, number][] = [
      ['hire', 'Train', 'tractor', 2.2],
      ['market', 'Sell', 'sell', 2.2],
      ['restaurant', 'Eat', 'bowl', 1.6],
      ['house', 'Sleep', 'sleep', 2.0],
      ['mission', 'Plan', 'plan', 2.0],
      ['pond', 'Water', 'water', 1.9],
      ['shed-seeds', 'Seeds', 'bag', 1.6],
      ['shed-fertilizer', 'Fertilizer', 'bag', 1.6],
      ['shed-sprayer', 'Sprayer', 'bag', 1.6],
      ['pen', 'Cows', 'cow', 1.8],
      ['coop', 'Hens', 'hen', 1.7],
      ['power', 'Power', 'bolt', 1.9],
      ['greenhouse', 'Grow', 'sprout', 1.5],
      ['storehouse', 'Store', 'crate', 1.5],
      ['storage', 'Storage', 'snow', 1.5],
      ['forest', 'Forest', 'tree', 1.7],
    ];
    for (const [p, label, glyph, size] of zones) {
      const mat = sharpText(new THREE.MeshBasicMaterial({ map: zoneTexture(label, glyphs[glyph]), transparent: true, depthWrite: false }));
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
    // the feed stores by the cow pen and the coop (src/onsite: the day's feeding starts here)
    for (const [x, z] of [[-8.4, -12.4], [4.4, -18.8]] as const) {
      const g = makePickup('seeds');
      g.position.set(x, 0, z);
      g.rotation.y = -0.3;
      this.scene.add(g);
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
    this.buildPower();
    this.buildGreenhouse();
    this.buildStorehouse();
    this.buildStorage();
  }

  /* ---------------- the power yard, the lights and the night (src/power) ---------------- */

  private powerParts: Record<string, THREE.Object3D> = {};
  private lampGroup = new THREE.Group();
  private bulbs: THREE.Mesh[] = [];
  private lampLights: THREE.PointLight[] = [];
  private lantern = new THREE.PointLight('#ffd9a0', 0, 7, 1.6);
  private windows: THREE.Mesh[] = [];
  private hemi!: THREE.HemisphereLight;
  private nightOn = false;
  private powerKey = '';

  private buildPower() {
    const Y = POWER_YARD;
    const mk = (parts: Part[], x: number, z: number, ry = 0) => {
      const m = new THREE.Mesh(merge(place(parts, at(x, 0, z, { ry }))), vcMaterial(true));
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    // the yard: gravel and a fence, always there (the parts appear as they are put in)
    const floor = new THREE.Mesh(roundRect(Y.x0, Y.z0, Y.x1, Y.z1, 0.6), new THREE.MeshLambertMaterial({ color: '#d8cfb8' }));
    floor.position.y = 0.012;
    floor.receiveShadow = true;
    this.scene.add(floor);
    mk([...fence(Y.x0, Y.z0, Y.x1, Y.z0), ...fence(Y.x0, Y.z0, Y.x0, Y.z1 - 2.6)], 0, 0);
    const frames: Part[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) frames.push(...place(solarFrame(), at(16.6 + c * 3.6, 0, -16.8 + r * 2.4)));
    this.powerParts.panels = mk(frames, 0, 0);
    this.powerParts.inverter = mk(inverterBox(), 16.2, -7.9);
    this.powerParts.inverter.position.y = 1.2;
    this.powerParts.hut = mk(powerHut(), 16.2, -6.9, Math.PI);
    this.powerParts.battery = mk(batteryBank(), 18.6, -6.7);
    this.powerParts.generator = mk(generatorSet(), 20.4, -9.0);
    this.powerParts.fuel = mk(fuelTank(), 20.4, -6.6);
    this.rects.push({ x0: 15.0, x1: 21.6, z0: -18.2, z1: -10.8 }, { x0: 15.0, x1: 17.4, z0: -7.9, z1: -5.9 }, { x0: 17.6, x1: 21.4, z0: -9.6, z1: -5.9 });
    // the light poles, and a light at the first few
    const poles: Part[] = [];
    const bulbGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#8a8a7a' });
    LAMPS.forEach((l, i) => {
      poles.push(...place(lampPole(), at(l.x, 0, l.z)));
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(l.x, 2.66, l.z + 0.52);
      this.lampGroup.add(b);
      this.bulbs.push(b);
      this.obstacles.push({ x: l.x, z: l.z, r: 0.18 });
      if (i < 4) {
        const pl = new THREE.PointLight('#ffe7a8', 0, 11, 1.4);
        pl.position.set(l.x, 2.5, l.z + 0.5);
        this.lampLights.push(pl);
        this.scene.add(pl);
      }
    });
    const pm = new THREE.Mesh(merge(poles), vcMaterial(true));
    pm.castShadow = true;
    this.lampGroup.add(pm);
    this.lampGroup.visible = false;
    this.scene.add(this.lampGroup);
    // the farmer's lantern at night, and the house windows
    this.scene.add(this.lantern);
    const win = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
    for (const x of [-2.0, 2.0]) {
      const w = new THREE.Mesh(G.box, win);
      w.scale.set(1.05, 0.85, 0.05);
      w.position.set(x, 1.7, -18.6 + 2.29);
      w.visible = false;
      this.windows.push(w);
      this.scene.add(w);
    }
    this.setPower({ parts: [], lit: false });
  }

  /** The power system as built: each part shows once put in; the lights glow at night once lit. */
  setPower(p: FarmPower) {
    const key = `${p.parts.join()}:${p.lit}`;
    if (key === this.powerKey) return;
    this.powerKey = key;
    // a part just put in sounds as built; the main switch thrown, as the power coming on (not the farm as it opens)
    const fresh = p.parts.filter(x => !this.powerHad.includes(x));
    this.powerHad = p.parts;
    if (this.settled()) {
      if (fresh.includes('switchOn')) powerOn();
      else if (fresh.length) built(`power:${fresh[0]}`);
    }
    for (const id of ['panels', 'battery', 'generator', 'fuel']) this.powerParts[id].visible = p.parts.includes(id);
    this.powerParts.inverter.visible = p.parts.includes('inverter');
    this.lampGroup.visible = p.parts.includes('lights');
    this.lit = p.lit;
    this.applyNight();
  }
  private lit = false;
  private powerHad: string[] = [];
  private readonly bornAt = performance.now();
  /** the farm has been open a moment: a change now is the player's doing, not the save being drawn */
  private settled() {
    return performance.now() - this.bornAt > 1500;
  }

  /** Night mode: a dark sky, a moon, the farmer's lantern; the house windows and (once lit) the farm's lights glow. */
  setNight(on: boolean) {
    if (on === this.nightOn) return;
    this.nightOn = on;
    farmNight(on);
    this.applyNight();
  }
  isNight() {
    return this.nightOn;
  }

  private applyNight() {
    const n = this.nightOn;
    const sky = new THREE.Color(n ? '#0f1c33' : C.grass);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color = sky;
    if (this.hemi) {
      this.hemi.intensity = n ? 0.5 : 1.55;
      this.hemi.color.set(n ? '#8ea2d8' : '#ffffff');
      this.hemi.groundColor.set(n ? '#1d2a1c' : '#8fb83a');
    }
    this.sun.intensity = n ? 0.45 : 2.2;
    this.sun.color.set(n ? '#a9bcff' : '#fff6e0');
    this.lantern.intensity = n ? 2.2 : 0;
    const glow = n && this.lit;
    this.lampLights.forEach(l => (l.intensity = glow ? 9 : 0));
    this.bulbs.forEach(b => ((b.material as THREE.MeshBasicMaterial).color.set(glow ? '#fff3b0' : '#8a8a7a')));
    // the billboards are lit all night by their own lamps; the face dims a touch so it reads as lit, not pasted on
    this.billboards.forEach(b => {
      b.lenses.color.set(n ? '#fff1b8' : '#9aa0a8');
      b.face.color.set(n ? '#f2ecdc' : '#ffffff');
    });
    this.windows.forEach(w => {
      w.visible = n;
      (w.material as THREE.MeshBasicMaterial).color.set(this.powerKey.includes('switchOn') ? '#fff0b8' : '#e8a24a');
    });
    this.dirty = true;
  }

  /* ---------------- the greenhouse and the storehouse (src/greenhouse, src/storehouse) ---------------- */

  private bedMeshes: (THREE.Mesh | null)[] = [null, null, null, null];
  private bedKeys = ['', '', '', ''];
  private bedBadges: THREE.Sprite[] = [];
  private storeMesh: THREE.Mesh | null = null;
  private storeKey = '';

  /** A glass building: its solid frame (casting shadows) and its see-through panes, at (x, z). */
  private addGlassHouse(x: number, z: number, parts: { frame: Part[]; glass: Part[] }, opacity: number) {
    const fm = new THREE.Mesh(merge(place(parts.frame, at(x, 0, z))), vcMaterial(true));
    fm.castShadow = true;
    fm.receiveShadow = true;
    const gm = new THREE.Mesh(merge(place(parts.glass, at(x, 0, z))), glassMaterial(opacity));
    gm.renderOrder = 3;
    this.scene.add(fm, gm);
  }

  /** A name board over a door, tilted to the camera. */
  private addBoard(x: number, y: number, z: number, title: string, sub: string, color: string, ry = 0) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.49), sharpText(new THREE.MeshLambertMaterial({ map: nameBoardTexture(title, sub, color) })));
    face.position.set(x, y, z);
    face.rotation.set(-0.5, ry, 0, 'YXZ');
    face.renderOrder = 4;
    this.scene.add(face);
  }

  private buildGreenhouse() {
    const g = GREENHOUSE_AT;
    // a gravel floor on a concrete footing
    const floor: Part[] = [
      { geo: G.box, color: '#c9c3b6', m: at(g.x, 0.03, g.z, { sx: g.w + 0.2, sy: 0.06, sz: g.d + 0.2 }) },
      { geo: G.box, color: '#e3dccb', m: at(g.x, 0.065, g.z, { sx: g.w - 0.1, sy: 0.02, sz: g.d - 0.1 }) },
    ];
    for (let i = 0; i < 4; i++) {
      const c = ghBedCenter(i);
      floor.push(...place(raisedBed(GH_BED.w, GH_BED.d), at(c.x, 0.06, c.z)));
    }
    const fm = new THREE.Mesh(merge(floor), vcMaterial(true));
    fm.receiveShadow = true;
    this.scene.add(fm);
    this.addGlassHouse(g.x, g.z, glassHouse({ w: g.w, d: g.d, h: 1.35, rise: 0.8, frame: '#f4f7f6', glass: '#bfe6f0', door: { side: 'x+', at: 0, width: 0.9 } }), 0.15);
    this.addBoard(g.x + 1.2, 1.6, g.z + g.d / 2 + 0.06, 'GREENHOUSE', '4 beds under glass', '#2f8a3a');
    // the farmer walks round it, in by its door (the button at the door opens it)
    this.rects.push({ x0: g.x - g.w / 2, x1: g.x + g.w / 2, z0: g.z - g.d / 2, z1: g.z + g.d / 2 });
    for (let i = 0; i < 4; i++) {
      const c = ghBedCenter(i);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
      badge.scale.set(0.7, 0.7, 1);
      badge.position.set(c.x, 2.6, c.z);
      badge.renderOrder = 5;
      badge.visible = false;
      this.scene.add(badge);
      this.bedBadges.push(badge);
    }
  }

  private buildStorehouse() {
    const h = STOREHOUSE_AT;
    const floor: Part[] = [
      { geo: G.box, color: '#b9b2a4', m: at(h.x, 0.04, h.z, { sx: h.w + 0.2, sy: 0.08, sz: h.d + 0.2 }) },
      // shelves along the back and the left wall, a pallet at the front, the work table on the right
      ...place(shelfUnit(2.7), at(h.x - 0.85, 0.08, h.z - h.d / 2 + 0.4)),
      ...place(shelfUnit(1.9), at(h.x - h.w / 2 + 0.4, 0.08, h.z + 0.4, { ry: Math.PI / 2 })),
      { geo: G.box, color: '#c98a4a', m: at(h.x - 0.4, 0.12, h.z + 1.15, { sx: 1.5, sy: 0.08, sz: 0.9 }) },
      ...place(workTable(), at(h.x + 1.5, 0.08, h.z + 0.9)),
    ];
    const fm = new THREE.Mesh(merge(floor), vcMaterial(true));
    fm.receiveShadow = true;
    fm.castShadow = true;
    this.scene.add(fm);
    this.addGlassHouse(h.x, h.z, glassHouse({ w: h.w, d: h.d, h: 1.6, rise: 0.6, frame: '#2f5d50', glass: '#d6ecef', door: { side: 'z-', at: h.door, width: 0.95 }, plinth: { h: 0.4, color: C.woodPlank } }), 0.15);
    this.addBoard(h.x, 1.85, h.z + h.d / 2 + 0.06, 'STOREHOUSE', 'store · harvest · produce', '#2f5d50');
    this.rects.push({ x0: h.x - h.w / 2, x1: h.x + h.w / 2, z0: h.z - h.d / 2, z1: h.z + h.d / 2 });
  }

  /** The storage annex against the storehouse's right-hand wall: a big freezer with its own door (src/world/models.ts
      freezerAnnex). Its name board and its display sit on the control strip over the door. */
  private buildStorage() {
    const a = STORAGE_AT;
    // a little light of its own, so the white cabinet reads as white on the side away from the sun
    const mat = vcMaterial(true);
    mat.emissive.set('#30373d');
    const fm = new THREE.Mesh(merge(place(freezerAnnex(a), at(a.x, 0, a.z))), mat);
    fm.castShadow = true;
    fm.receiveShadow = true;
    this.scene.add(fm);
    const front = a.z + a.d / 2;
    const stripY = a.h - FREEZER.strip / 2 - 0.06;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.32), sharpText(new THREE.MeshBasicMaterial({ map: nameBoardTexture('STORAGE', 'cold room · freezer', '#2a7fb8') })));
    board.position.set(a.x - 0.42, stripY, front + 0.035);
    board.renderOrder = 4;
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.26), sharpText(new THREE.MeshBasicMaterial({ map: freezerDisplayTexture() })));
    display.position.set(a.x + 0.88, stripY, front + 0.035);
    display.renderOrder = 4;
    this.scene.add(board, display);
    this.rects.push({ x0: a.x - a.w / 2, x1: a.x + a.w / 2, z0: a.z - a.d / 2, z1: a.z + a.d / 2 });
  }

  /** The greenhouse's beds, as grown (stage 0 just planted … 3 ready), and a badge over a bed that needs the farmer. */
  setGreenhouse(beds: FarmBed[]) {
    beds.forEach((f, i) => {
      const b = this.bedBadges[i];
      if (b) {
        b.visible = !!f.need;
        if (f.need) b.material.map = f.need === 'pick' ? this.badgeTex.harvest : f.need === 'water' ? this.badgeTex.treat : this.badgeTex.check;
        b.material.needsUpdate = true;
      }
      const key = `${f.crop}:${f.stage}`;
      if (key === this.bedKeys[i]) return;
      this.bedKeys[i] = key;
      const old = this.bedMeshes[i];
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
      }
      this.bedMeshes[i] = null;
      if (!f.crop || f.stage < 0) return;
      const c = ghBedCenter(i);
      const parts: Part[] = [];
      const vine = f.crop === 'tomatoes' || f.crop === 'cucumber';
      for (let r = 0; r < 2; r++)
        for (let k = 0; k < 4; k++) {
          const x = c.x + (k - 1.5) * 0.46;
          const z = c.z + (r ? 0.3 : -0.3);
          parts.push(...place(greenhousePlant(f.crop, f.stage, i * 8 + r * 4 + k), at(x, 0.3, z)));
          // the vines climb strings from a wire under the roof
          if (vine) parts.push({ geo: G.cyl6, color: '#e8e1c8', m: at(x, 0.95, z, { sx: 0.012, sy: 1.3, sz: 0.012 }) });
        }
      if (vine) for (const z of [-0.3, 0.3]) parts.push({ geo: G.box, color: '#9aa3a8', m: at(c.x, 1.6, c.z + z, { sx: GH_BED.w, sy: 0.02, sz: 0.02 }) });
      const m = new THREE.Mesh(merge(parts), vcMaterial(true));
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.bedMeshes[i] = m;
    });
    this.dirty = true;
  }

  /** The storehouse's shelves: a crate for every 15 kg of fresh produce, a sack for every 20 kg kept dry, a jar for
      every 2 kg made, up to what the shelves hold. */
  setStorehouse(st: FarmStore) {
    const crates = st.fresh.flatMap(f => Array.from({ length: Math.min(6, Math.ceil(f.kg / 15)) }, () => f.color)).slice(0, 12);
    const sacks = Math.min(8, Math.ceil(st.keeps / 20));
    const jars = st.made.flatMap(f => Array.from({ length: Math.min(6, Math.ceil(f.kg / 2)) }, () => f.color)).slice(0, 12);
    const key = `${crates.join(',')}|${sacks}|${jars.join(',')}`;
    if (key === this.storeKey) return;
    this.storeKey = key;
    if (this.storeMesh) {
      this.scene.remove(this.storeMesh);
      this.storeMesh.geometry.dispose();
      this.storeMesh = null;
    }
    const h = STOREHOUSE_AT;
    const parts: Part[] = [];
    // crates on the back wall's rack: the low tier first, then the high one
    const back = h.z - h.d / 2 + 0.4;
    crates.forEach((color, i) => {
      const t = i < 6 ? SHELF.low : SHELF.high;
      parts.push(...place(crate(color), at(h.x - 1.95 + (i % 6) * 0.44, 0.08 + t.y, back + t.z)));
    });
    // sacks on the pallet
    for (let i = 0; i < sacks; i++) parts.push(...place(sack(i % 2 ? '#e9d8a6' : '#dcc58e'), at(h.x - 0.95 + (i % 4) * 0.36, 0.16 + (i >= 4 ? 0.3 : 0), h.z + 1.15 + (i >= 4 ? 0.1 : -0.15))));
    // jars on the left wall's rack (turned to face into the room: its low tier is towards +x)
    const left = h.x - h.w / 2 + 0.4;
    jars.forEach((color, i) => {
      const t = i < 6 ? SHELF.low : SHELF.high;
      parts.push(...place(jar(color, i % 3 === 2), at(left + t.z, 0.08 + t.y, h.z + 0.4 - 0.75 + (i % 6) * 0.3)));
    });
    if (!parts.length) {
      this.dirty = true;
      return;
    }
    const m = new THREE.Mesh(merge(parts), vcMaterial(true));
    m.castShadow = true;
    this.scene.add(m);
    this.storeMesh = m;
    this.dirty = true;
  }

  /** The farmer opts into the place they stand in (the button on its white square): a shed or the pond hands over
      its load, every other place opens its screen. Returns false when the farmer stands in no place. */
  enterPlace(): boolean {
    const now = this.inPlace;
    if (!now) return false;
    const item = PICKUP_OF[now];
    if (item) this.ev.carry(item);
    else if (now === 'hire') {
      // the Train spot opens the tractor screen (World.tsx); its Hire section starts the oxen or the tractor
      if (this.riding) return false;
      this.ev.place('hire');
    } else this.ev.place(now);
    return true;
  }

  /** The place the farmer stands in (a shed spot, the pond…), or null. */
  placeHere() {
    return this.inPlace;
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
    this.striga = inst(strigaTile(), vcMaterial(), n, false);
    this.mounds = inst(moundTile(), vcMaterial(), n, false);
    this.gullies = inst(gullyTile(), vcMaterial(), n, false);
    this.trenches = inst(trenchTile(), vcMaterial(), n, false);
    this.mulch = inst(mulchTile(), vcMaterial(), n, false);
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
        sharpText(new THREE.MeshLambertMaterial({ map: signTexture(f + 1) })),
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
    // up to six cows in the pen and twelve hens by the coop: as many show as the farm has (setLife)
    for (const [x, z] of [
      [-17, -15],
      [-14.4, -17.6],
      [-19.2, -18.4],
      [-13.6, -13.6],
      [-18.6, -13.2],
      [-15.8, -19.2],
    ]) {
      const m = makeQuadruped('cow');
      m.root.position.set(x, 0, z);
      this.scene.add(m.root);
      this.cows.push({ m, at: new THREE.Vector2(x, z), to: new THREE.Vector2(x, z), wait: Math.random() * 3 });
    }
    this.buildCoops();
    for (let i = 0; i < 12; i++) {
      const m = makeChicken();
      const x = 5.0 + (i % 5) * 1.2;
      const z = -16 + (i % 2) * 1.1 + Math.floor(i / 5) * 0.4;
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

  private coops: Record<'site' | 'basic' | 'secure', THREE.Group> = { site: new THREE.Group(), basic: new THREE.Group(), secure: new THREE.Group() };
  private lifeKey = '';

  /** The coop as it can stand: a pile of timber (not built yet), the simple coop, and the raised coop with mesh. */
  private buildCoops() {
    const lam = (color: string) => new THREE.MeshLambertMaterial({ color });
    const box = (g: THREE.Group, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) => {
      const m = new THREE.Mesh(G.box, lam(color));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.x = rx;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const { site, basic, secure } = this.coops;
    // timber and iron sheets waiting for day 2
    for (let i = 0; i < 4; i++) box(site, i % 2 ? C.woodDark : C.woodPlank, 8.2, 0.1 + i * 0.16, -18.4, 2.2 - i * 0.2, 0.14, 0.3 + (i % 2) * 0.9);
    box(site, '#9aa3a8', 8.9, 0.08, -18.0, 1.0, 0.06, 1.2);
    // the simple coop: timber walls, an iron-sheet roof, a door
    box(basic, C.woodPlank, 8.2, 0.7, -18.4, 2.2, 1.4, 1.6);
    box(basic, C.roof, 8.2, 1.55, -18.4, 2.6, 0.25, 2.0, 0.15);
    box(basic, '#5c3a20', 8.2, 0.45, -17.58, 0.6, 0.7, 0.05);
    // the raised coop: on posts, a slatted floor, wire mesh on the front, a ramp and a padlocked door
    for (const [px, pz] of [[7.0, -19.2], [9.4, -19.2], [7.0, -17.6], [9.4, -17.6]]) box(secure, C.woodDark, px, 0.4, pz, 0.16, 0.8, 0.16);
    box(secure, C.woodPlank, 8.2, 0.85, -18.4, 2.6, 0.1, 1.8);
    box(secure, C.woodPlank, 8.2, 1.4, -19.25, 2.6, 1.1, 0.1);
    box(secure, C.woodPlank, 6.95, 1.4, -18.4, 0.1, 1.1, 1.8);
    box(secure, C.woodPlank, 9.45, 1.4, -18.4, 0.1, 1.1, 1.8);
    const mesh = box(secure, '#cfd6da', 8.6, 1.4, -17.52, 1.6, 1.1, 0.04);
    (mesh.material as THREE.MeshLambertMaterial).transparent = true;
    (mesh.material as THREE.MeshLambertMaterial).opacity = 0.55;
    box(secure, '#5c3a20', 7.5, 1.3, -17.52, 0.55, 0.85, 0.06);
    box(secure, '#e2b23a', 7.72, 1.3, -17.48, 0.09, 0.12, 0.05);
    box(secure, C.roofDark, 8.2, 2.05, -18.4, 3.0, 0.2, 2.3, 0.15);
    box(secure, C.woodDark, 7.5, 0.45, -17.0, 0.45, 0.06, 1.2, -0.65);
    for (const g of [site, basic, secure]) {
      g.visible = g === site;
      this.scene.add(g);
    }
    // the cow shed, upgraded by the player from day 3 (src/livestock)
    for (const [id, parts] of [['roofed', roofedShed()], ['zero', zeroGrazing()]] as const) {
      const m = new THREE.Mesh(merge(place(parts, at(-17.4, 0, -18.4))), vcMaterial(true));
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      this.sheds[id] = m;
      this.scene.add(m);
    }
  }
  private sheds: Record<'roofed' | 'zero', THREE.Mesh> = {} as never;

  /** The herd and the coop as the farm has them now: stolen or dead animals are gone, a built coop stands. */
  private lifeHad: FarmLife | null = null;
  setLife(l: FarmLife) {
    const key = `${l.cows}:${l.hens}:${l.coop}:${l.shed}`;
    if (key === this.lifeKey) return;
    // the coop or the cow shed just built
    if (this.settled() && this.lifeHad) {
      if (l.coop && l.coop !== this.lifeHad.coop) built(`coop:${l.coop}`);
      else if (l.shed && l.shed !== this.lifeHad.shed) built(`shed:${l.shed}`);
    }
    this.lifeHad = l;
    this.lifeKey = key;
    this.cows.forEach((c, i) => (c.m.root.visible = i < l.cows));
    const hens = Math.min(this.hens.length, l.hens);
    this.hens.forEach((h, i) => (h.m.root.visible = i < hens));
    this.coops.site.visible = !l.coop;
    this.coops.basic.visible = l.coop === 'basic';
    this.coops.secure.visible = l.coop === 'secure';
    this.sheds.roofed.visible = l.shed === 'roofed';
    this.sheds.zero.visible = l.shed === 'zero';
    this.dirty = true;
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
      stone: ['#a7a7a0', '#8d8d86', '#c9b79a'],
      hay: ['#e8c867', '#b8d46a', '#d4a94a'],
      milk: ['#ffffff', '#f4f1e8'],
      spark: ['#fff3a0', '#ffd23a', '#ffffff'],
      oil: ['#3a2f22', '#6b5a3a'],
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
    const meshes = [this.mound, this.wild, ...Object.values(this.plants), ...Object.values(this.kale), this.weeds, this.puddles, this.hail, this.pests, this.striga, this.mounds, this.gullies, this.trenches, this.mulch];
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
      // a resting farm (src/soil) is left to its grass and bush, or under a green cover crop: nothing is worked on it
      const rest = t && t.phase === 'growing' ? restOf(t, farm) : null;
      const active = !!t && farm < t.plans.length && t.phase !== 'plan' && !rest;
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
      // the newer problems show on some tiles (world/field.ts problemTiles); follow-up care brings sick plants or
      // striga back on new tiles until it is done
      const spots = h && t ? problemTiles(h, t, farm, day) : 0;
      const job = h ? jobOf(h, rec?.treatment) : undefined;
      const fuSick = fu?.job === 'uproot' ? fu.need & ~fuBits : 0;
      const fuStriga = fu?.job === 'pull' ? fu.need & ~fuBits : 0;
      const gaps = plan?.date === 'early' ? someTiles(`gap:${t?.cycle}:${farm}`, 5) : 0;
      // the farm grows with its seed, fertilizer and machines: taller or shorter, greener or paler
      const growth = active && t ? this.grown(t, farm, day).plots : [1];

      this.soilBits[farm] = active ? prep : 0;
      col.set(active && prep ? '#7a4224' : rest === 'cover' ? '#4f9e2c' : '#93cf33');
      this.base.setColorAt(farm, col);

      for (let i = 0; i < TILES; i++) {
        const c = tileCenter(farm, i);
        const bit = 1 << i;
        const isPrep = !!(prep & bit);
        // the soil
        const moundAt = at(c.x, 0.06, c.z, { sx: TILE * 0.82, sy: 0.16, sz: TILE * 0.94 });
        let soil = rest === 'cover' ? '#3f8a26' : C.grassDark;
        if (isPrep) soil = plan?.land === 'mulch' ? C.mulch : plan?.land === 'slash' ? '#8f6a3c' : C.soilTilled;
        if (isPrep && sown & bit) soil = plan?.land === 'mulch' ? C.mulch : C.soil;
        if (isPrep && fed & bit && day <= 1) soil = '#8a5838';
        if (showProblem && h === 'drought' && !(treatBits & bit)) soil = C.soilDry;
        if (fuDry & bit) soil = C.soilDry;
        if (h === 'drought' && treatBits & bit) soil = C.soilWet;
        if (h === 'flood') soil = C.soilDark;
        // the topsoil washed off the gullies: red subsoil until the trenches are dug
        if (showProblem && h === 'erosion' && spots & bit && !(treatBits & bit)) soil = '#c8642a';
        // weeds cut and laid as mulch, or bare soil covered
        const mulched = job === 'mulch' && !!(treatBits & spots & bit);
        if (mulched) soil = C.mulch;
        col.set(soil);
        put(this.mound, moundAt, col);
        if (!isPrep) put(this.wild, at(c.x, 0.12, c.z, { ry: i * 1.3 }));
        const spot = !!(spots & bit);
        const open = showProblem && spot && !(treatBits & bit);
        if (mulched) put(this.mulch, at(c.x, 0, c.z, { ry: i }));
        if (open && h === 'erosion') put(this.gullies, at(c.x, 0, c.z, { ry: (i % 3) * 0.15 }));
        if (h === 'erosion' && job === 'trench' && spot && treatBits & bit) put(this.trenches, at(c.x, 0, c.z));
        if (open && h === 'rodents') put(this.mounds, at(c.x + 0.15, 0, c.z - 0.1, { ry: i }));
        if ((open && h === 'striga') || fuStriga & bit) put(this.striga, at(c.x, 0.04, c.z, { ry: i * 0.7 }));
        // a sick plant pulled out and burnt leaves a gap
        if (h === 'virus' && job === 'uproot' && spot && treatBits & bit && active && sown & bit) continue;
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
            if (spot) {
              // maize lethal necrosis: yellow streaks, the top drying; striga: wilting in damp soil; rats: gnawed
              if (h === 'virus') tint = '#d8cf7e';
              if (h === 'striga') {
                tint = '#d9d68c';
                sy = 0.8;
              }
              if (h === 'rodents') {
                tint = '#e2dc98';
                sy = 0.7;
              }
              if (h === 'erosion') sy = 0.85;
            }
          }
        }
        if (fuSick & bit && stage !== 'stubble') tint = '#d8cf7e';
        // flattened by the wind: the plant lies on the ground until it is stood up and earthed up
        const flat = showProblem && h === 'wind' && spot && !(treatBits & bit) && stage !== 'stubble' && stage !== 'sprout';
        if (flat) tint = '#e4dc8a';
        if (h === 'plantLate') sy *= 0.8;
        const g = growth[0] ?? 1;
        if (stage !== 'sprout' && stage !== 'stubble') {
          sy *= 0.7 + 0.3 * Math.min(1, g);
          if (g < 0.62 && tint === '#ffffff') tint = '#e6eb9a';
        }
        if (lost > 0.08 && tint === '#ffffff' && stage !== 'stubble') tint = lost > 0.25 ? '#dcd27a' : '#eef0a8';
        col.set(tint);
        put((t && cropOf(t, farm) === 'kale' ? this.kale : this.plants)[stage], at(c.x, 0.06, c.z, flat ? { sy, ry: 0.6, rz: 1.25 } : { sy, ry: (i % 2) * 0.4 }), col);
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
      if (growing && t && farm < t.plans.length && !rest) {
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
      r = { lost: day > 1 ? harvestFarm(t, farm, Math.min(day - 1, CHECK_DAYS)).lost : 0, plots: plotGrowth(t, farm, CHECK_DAYS, day) };
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
    const rest = restOf(t, farm);
    if (rest) return { hint: `${farmName(farm)} is resting this cycle (${REST[rest].short.toLowerCase()}): leave it be` };
    const f = this.liveField();
    const plan = t.plans[farm];
    const day = fieldDay(t, v.today);
    const carry = v.field.carry;
    const setup = setupLeft(f, t, farm);
    if (setup === 'prep') {
      if (machinePrep(plan)) return { hint: `${plan.land === 'tractor' ? 'Hire the tractor' : 'Hire the oxen'} to plough Farm ${farm + 1}` };
      return { job: 'prep', need: FULL, fx: plan.land === 'slash' ? 'clear' : plan.land === 'mulch' ? 'mulch' : 'dig' };
    }
    if (setup === 'sow') return { job: 'sow', need: FULL, fx: 'seed' };
    if (setup === 'setupFeed') return carry === 'fertilizer' ? { job: 'setupFeed', need: needOf('setupFeed', t, farm), fx: 'fert' } : { hint: 'Get fertilizer from the shed' };
    if (day > CHECK_DAYS) return { job: 'harvest', need: FULL, fx: 'harvest' };
    const tr = careLeft(f, t, farm, day);
    if (!tr) {
      // scheduled care: what the farmer carries first, then weeding, which needs nothing carried
      const due = routineLeft(f, t, farm, day);
      const r = due.find(x => (x.job === 'borer' && carry === 'sprayer') || (x.job === 'topdress' && carry === 'fertilizer')) ?? due.find(x => x.job === 'weeding') ?? due[0];
      if (!r) return null;
      if (r.job === 'weeding') return { job: r.key, need: r.need, fx: 'weed' };
      if (r.job === 'borer') return carry === 'sprayer' ? { job: r.key, need: r.need, fx: 'spray' } : { hint: `Get the sprayer from the shed: ${ROUTINE.borer.teach}` };
      return carry === 'fertilizer' ? { job: r.key, need: r.need, fx: 'fert' } : { hint: `Get fertilizer from the shed: ${ROUTINE.topdress.teach}` };
    }
    if (tr.job === 'weed' || tr.job === 'pull') return { job: tr.key, need: tr.need, fx: 'weed' };
    if (tr.job === 'drain' || tr.job === 'trench') return { job: tr.key, need: tr.need, fx: 'drain' };
    if (tr.job === 'mulch') return { job: tr.key, need: tr.need, fx: 'mulch' };
    if (tr.job === 'uproot') return { job: tr.key, need: tr.need, fx: 'clear' };
    if (tr.job === 'prop' || tr.job === 'trap') return { job: tr.key, need: tr.need, fx: 'dig' };
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
    if (!t || t.phase !== 'growing' || !rig || farm >= t.plans.length || isResting(t, farm)) return;
    const f = this.liveField();
    const day = fieldDay(t, v.today);
    // the tool decides the job: its first one that the farm is waiting for (the spreader feeds at planting, then
    // top-dresses; the boom sprayer sprays a problem first, then against stalk borer)
    const jobs = toolJobs(rig.tool);
    let job = jobs[0];
    const tool = toolName(rig.tool).toLowerCase();
    const setup = setupLeft(f, t, farm);
    const routine = routineLeft(f, t, farm, day);
    const care = day >= 1 && day <= CHECK_DAYS ? careLeft(f, t, farm, day) : null;
    const due = routine.find(r => jobs.includes(r.job));
    let key: string | null = null;
    let need = 0;
    if (setup && jobs.includes(setup as PlotJob)) {
      job = setup as PlotJob;
      key = job;
      need = needOf(job, t, farm);
    } else if (setup) return this.rideHint(`${farmName(farm)} needs to ${JOB_INFO[setup as PlotJob].name.toLowerCase()} first: the ${tool} is for later`);
    else if (jobs.includes('spray') && care?.job === 'spray') {
      key = care.key;
      need = care.need;
    } else if (due) {
      job = due.job;
      key = due.key;
      need = due.need;
    } else if (job === 'harvest') {
      if (day <= CHECK_DAYS) return this.rideHint(`The ${CROP_WORDS[cropOf(t, farm)].name} on ${farmName(farm)} is not ready to harvest yet`);
      key = 'harvest';
      need = FULL;
    } else if (job === 'prep' || job === 'sow') return this.rideHint(`${farmName(farm)} is planted: nothing for the ${tool} here now`);
    else return this.rideHint(`Nothing for the ${tool} on ${farmName(farm)} today (${jobs.map(j => `${JOB_INFO[j].name.toLowerCase()}: ${JOB_INFO[j].when}`).join('; ')})`);
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
    this.jobTool = null;
    this.work = 0.45;
    this.workFx = fx;
    this.burst(fx, this.pos.x, this.pos.y, 2);
    working(fx, null);
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
    workDone(fx);
    this.ev.mark(farm, job, bits, false);
  }

  private fxOf(job: PlotJob): Fx {
    const plan = this.view?.trial?.plans[0];
    void plan;
    return ({ prep: 'dig', sow: 'seed', setupFeed: 'fert', weeding: 'weed', borer: 'spray', topdress: 'fert', spray: 'spray', harvest: 'harvest' } as const)[job];
  }

  /* ---------------- the daily tidy-up: today's bushes and rocks (the button and timer are World.tsx's) ---------------- */

  private tidy: TidyItem[] = [];
  private tidyKey: string | null = null;
  private tidyMesh: THREE.Mesh | null = null;

  /** Today's bushes and rocks still to clear: drawn as one mesh, rebuilt when one goes (a puff where it stood). */
  setTidy(items: TidyItem[]) {
    const key = items.map(i => `${i.id}@${i.x},${i.z}`).join('|');
    if (key === this.tidyKey) return;
    const gone = this.tidyKey === null ? [] : this.tidy.filter(o => !items.some(i => i.id === o.id && i.x === o.x && i.z === o.z));
    this.tidyKey = key;
    this.tidy = items;
    for (const g of gone) this.burst(g.kind === 'bush' ? 'clear' : 'stone', g.x, g.z, 10);
    if (gone.length) workDone(gone[0].kind === 'bush' ? 'clear' : 'stone');
    if (this.tidyMesh) {
      this.scene.remove(this.tidyMesh);
      this.tidyMesh.geometry.dispose();
    }
    this.tidyMesh = null;
    if (!items.length) return;
    const parts: Part[] = [];
    for (const i of items) parts.push(...place(i.kind === 'bush' ? wildBush(i.s) : rockPile(i.s), at(i.x, 0, i.z, { ry: i.x * 1.7 + i.z })));
    const m = new THREE.Mesh(merge(parts), vcMaterial(true));
    m.castShadow = true;
    m.receiveShadow = true;
    this.tidyMesh = m;
    this.scene.add(m);
  }

  /** The bush or rock the farmer stands by (on foot), the nearest one, or null. */
  tidyHere(): TidyItem | null {
    if (this.riding || !this.tidy.length) return null;
    let best: TidyItem | null = null;
    let bestD = TIDY.reach;
    for (const i of this.tidy) {
      const d = Math.hypot(i.x - this.pos.x, i.z - this.pos.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** The nearest bush or rock still to clear, from where the farmer stands. */
  nearestTidy(): TidyItem | null {
    let best: TidyItem | null = null;
    let bestD = Infinity;
    for (const i of this.tidy) {
      const d = Math.hypot(i.x - this.pos.x, i.z - this.pos.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** The farmer is at work on a bush (with the sickle) or a rock (lifting it): face it, swing, throw leaves or grit. */
  tidyWorking(item: TidyItem) {
    this.jobTool = null;
    this.work = 0.45;
    this.workFx = item.kind === 'bush' ? 'clear' : 'stone';
    const dx = item.x - this.pos.x;
    const dz = item.z - this.pos.y;
    if (Math.hypot(dx, dz) > 0.05) this.heading = Math.atan2(dx, dz);
    this.burst(this.workFx, item.x + (Math.random() - 0.5) * 0.6, item.z + (Math.random() - 0.5) * 0.6, 2);
    working(this.workFx, null);
  }

  /* ---------------- jobs done by hand (src/onsite: the button and the timer are World.tsx's) ---------------- */

  /** At work on a job's spot: face the work, swing the tool, throw hay, sparks, water or milk at it. */
  jobWorking(face: { x: number; z: number } | null, fx: Fx, tool: string | null) {
    this.work = 0.45;
    this.workFx = fx;
    this.jobTool = tool ?? 'none';
    working(fx, tool);
    const f = face ?? { x: this.pos.x, z: this.pos.y };
    const dx = f.x - this.pos.x;
    const dz = f.z - this.pos.y;
    if (Math.hypot(dx, dz) > 0.05) this.heading = Math.atan2(dx, dz);
    if (Math.hypot(f.x - FEEDER.x, f.z - FEEDER.z) < 0.8 && (fx === 'hay' || fx === 'water')) {
      // at the feeder: a stream from the bucket into the box, and (feeding) the heap rises
      this.pour(fx, 4);
      if (fx === 'hay') this.pouring = 0.45;
      return;
    }
    const bx = this.pos.x + (f.x - this.pos.x) * 0.6;
    const bz = this.pos.y + (f.z - this.pos.y) * 0.6;
    this.burst(fx, bx + (Math.random() - 0.5) * 0.4, bz + (Math.random() - 0.5) * 0.4, 2);
  }

  /** Feed or water poured from the bucket in the farmer's hand: an arc that lands in the feeder. */
  private pour(fx: Fx, n: number) {
    const col = fx === 'water' ? ['#56b9f0', '#a8defa'] : ['#e8c867', '#b8d46a', '#d4a94a', '#8fbf3a'];
    const c = new THREE.Color();
    const fwd = new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading));
    const fly = 0.42;
    for (let k = 0; k < n; k++) {
      const i = this.pNext++ % this.pData.length;
      const d = this.pData[i];
      d.p.set(this.pos.x + fwd.x * 0.45, 1.1, this.pos.y + fwd.y * 0.45);
      const tx = FEEDER.x + (Math.random() - 0.5) * 1.1;
      const tz = FEEDER.z + (Math.random() - 0.5) * 0.4;
      // up a little, then down into the box (gravity 7, see animateParticles)
      d.v.set((tx - d.p.x) / fly, 0.4, (tz - d.p.z) / fly);
      d.life = fly + 0.05;
      d.s = fx === 'water' ? 0.1 : 0.14;
      c.set(col[k % col.length]);
      this.parts.setColorAt(i, c);
    }
    if (this.parts.instanceColor) this.parts.instanceColor.needsUpdate = true;
  }

  /** A job's spot is done: a little burst of what was worked. */
  jobFinished(at: { x: number; z: number }, fx: Fx) {
    if (Math.hypot(at.x - FEEDER.x, at.z - FEEDER.z) < 0.8 && (fx === 'hay' || fx === 'water')) {
      this.pour(fx, 12);
      workDone(fx);
      if (fx === 'hay') this.feedLevel = 1;
      this.dirty = true;
      return;
    }
    this.burst(fx, at.x, at.z, 10);
    this.dirty = true;
    workDone(fx, this.jobTool === 'none' ? null : this.jobTool);
  }

  /** Carry a part or a tool on the back (to the first spot of a job that brings one). */
  setCrate(on: boolean) {
    if (on === this.crateOn) return;
    this.crateOn = on;
    this.dirty = true;
  }

  /** Where the tractor stands and which way it faces (jobs round the tractor are placed from it). */
  tractorPose() {
    return { x: this.tractor.position.x, z: this.tractor.position.z, ry: this.tractor.rotation.y };
  }

  /** The cows or the hens come over to a spot for a while (the trough at feeding, a cow to be milked). */
  gather(group: 'cows' | 'hens', x: number, z: number, secs = 6) {
    const herd = group === 'cows' ? this.cows : this.hens;
    const shown = herd.filter(a => a.m.root.visible);
    const atFeeder = group === 'cows' && Math.abs(x - FEEDER.x) < 0.5 && Math.abs(z - FEEDER.z) < 1.5;
    const n = group === 'cows' ? 1 + (atFeeder ? 1 : 0) : shown.length;
    shown.slice(0, n).forEach((a, i) => {
      const spread = group === 'cows' ? 0.9 : 0.55;
      a.to.set(x + (i - (n - 1) / 2) * spread + (group === 'hens' ? (Math.random() - 0.5) * 0.6 : 0), z + (group === 'hens' ? (Math.random() - 0.5) * 0.6 : 0));
      a.wait = 0;
      a.hold = secs;
      // at the feeder a cow turns to the fence and puts her head over the box
      (a as { look?: number }).look = atFeeder ? Math.atan2(FEEDER.x - a.to.x, FEEDER.z - a.to.y) : undefined;
    });
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
    // the first frame is drawn even under a pop-up, so the farm is ready behind it
    if (this.view?.paused && !this.firstFrame) return;
    const t0 = performance.now();
    // on a phone, a still farm is drawn 30 times a second instead of 60 (cooler phone, longer battery)
    if (this.level > 0 && !this.busy && t0 - this.lastDraw < IDLE_FRAME_MS) return;
    this.adapt(t0);
    this.lastDraw = t0;
    this.frame();
    this.cpu.ms += performance.now() - t0;
    this.cpu.frames++;
    if (this.firstFrame) {
      const done = this.firstFrame;
      this.firstFrame = null;
      // the frame is on screen at the next paint
      requestAnimationFrame(() => done());
    }
  };
  private lastDraw = 0;

  /** Now and then a band of light slides across each billboard's face (each a little after the last). */
  private sweepBillboards(time: number) {
    this.billboards.forEach((b, i) => {
      const t = (time + i * 1.7) % SWEEP.every;
      const on = t < SWEEP.takes;
      b.sweep.visible = on;
      if (on) (b.sweep.material as THREE.MeshBasicMaterial).map!.offset.x = 1 - (t / SWEEP.takes) * 2;
    });
  }
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
    hearAt(this.pos.x, this.pos.y);
    this.animateAnimals(dt, time);
    this.animateHire(dt);
    this.animateParticles(dt);
    this.sweepBillboards(time);
    if (this.dirty) {
      this.dirty = false;
      this.drawField();
    }
    // the green arrow over where the task card points
    const a = this.view?.arrowAt;
    this.arrow.visible = !!a && !this.hideArrow;
    if (a) this.arrow.position.set(a.x, 2.0 + Math.sin(time * 4) * 0.18, a.z);
    this.arrow.rotation.y = time * 1.5;
    this.animateFeed(dt);
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
    this.busy = this.walking > 0.01 || this.work > 0 || this.pouring > 0 || !!this.hire || this.ringLife > 0 || this.pData.some(d => d.life > 0);
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
    else if (!this.view?.paused) {
      // a controller's left stick: an analogue walk (input/gamepad.ts)
      const pad = padStick();
      if (pad.x * pad.x + pad.y * pad.y > 0.0004) {
        dir.set(pad.x, pad.y);
        this.target = null;
      }
    }
    // how far the spot being walked to is: a step never goes past it (a long frame on a slow phone, or a fast
    // farmer, used to overshoot and swing back and forth across it)
    let reach = Infinity;
    if (!dir.lengthSq() && this.target) {
      dir.subVectors(this.target, this.pos);
      reach = dir.length();
      if (reach < 0.15) {
        this.target = null;
        dir.set(0, 0);
        this.reached();
      }
    }
    const speed = 4.6 * this.speedScale * (this.riding ? RIDE_SPEED * this.tractorSpeed * (this.rig ? TRACTOR_PLOT[this.rig.tractor].speed : 1) : 1);
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
        if (there) this.reached();
      } else if (blocked) this.target = null;
      this.walking = Math.min(1, this.walking + dt * 8);
    } else this.walking = Math.max(0, this.walking - dt * 8);
    // the walk was stopped on the way (a tap, the joystick, the keys, a wall): the rest of the route goes with it
    if (this.route && !this.target) this.route = null;
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
    // Walking into a place's white square never starts its activity by itself: the farmer opts in with the button the
    // farm shows there (World.tsx), which calls enterPlace().
    if (now !== this.inPlace) this.inPlace = now;
    // a farm's sign
    let sign = -1;
    const t = this.view?.trial;
    if (t && t.phase === 'growing')
      for (let f = 0; f < t.plans.length; f++) {
        if (isResting(t, f)) continue;
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

  /** What is underfoot: a farm's cleared or tilled plot, the dirt yard and the paths are soil; the rest is grass. */
  groundAt(x: number, z: number): Ground {
    const on = plotAt(x, z);
    if (on) return this.soilBits[on.farm] & (1 << on.plot) ? 'soil' : 'grass';
    return PATHS.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1) ? 'soil' : 'grass';
  }

  private animateFarmer(dt: number, time: number) {
    const F = this.farmer;
    if (this.nightOn) this.lantern.position.set(this.pos.x, 2.2, this.pos.y + 0.4);
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
    // a footstep as each foot lands (the legs swing through the middle twice a stride), on grass or on soil
    const stride = Math.floor((time * 11) / Math.PI);
    if (stride !== this.stride) {
      this.stride = stride;
      if (w > 0.5 && !this.riding) footstep(this.groundAt(this.pos.x, this.pos.y));
    }
    this.work = Math.max(0, this.work - dt);
    const fx = this.work > 0 ? this.workFx : null;
    if (fx) F.armR.rotation.x = -1.0 + Math.sin(time * 18) * 0.7;
    else F.armR.rotation.x = sw * 0.8;
    // what is in the hand and on the back
    const carry = this.view?.field.carry ?? null;
    const tool = fx && this.jobTool !== null ? this.jobTool : fx === 'dig' || fx === 'drain' || fx === 'mulch' ? 'hoe' : fx === 'clear' || fx === 'weed' ? 'sickle' : carry === 'water' ? 'can' : carry === 'sprayer' ? 'wand' : null;
    for (const [k, o] of Object.entries(F.tools)) o.visible = k === tool;
    F.loads.crate.visible = this.crateOn && !carry;
    F.loads.seeds.visible = carry === 'seeds';
    F.loads.fertilizer.visible = carry === 'fertilizer';
    F.loads.sprayer.visible = carry === 'sprayer';
  }

  private animateAnimals(dt: number, time: number) {
    const wander = (a: { m: { root: THREE.Object3D }; at: THREE.Vector2; to: THREE.Vector2; wait: number; hold?: number; look?: number }, area: Rect, speed: number) => {
      // called over for a job (the feeder, the milking spot): walk there and stay until the job is done
      if (a.hold && a.hold > 0) {
        a.hold -= dt;
        if (a.hold <= 0) a.look = undefined;
        const d = new THREE.Vector2().subVectors(a.to, a.at);
        if (d.length() < 0.1) {
          if (a.look !== undefined) {
            let t = a.look - a.m.root.rotation.y;
            while (t > Math.PI) t -= Math.PI * 2;
            while (t < -Math.PI) t += Math.PI * 2;
            a.m.root.rotation.y += t * Math.min(1, dt * 5);
          }
          return 0;
        }
        d.normalize();
        a.at.addScaledVector(d, speed * 1.6 * dt);
        a.m.root.position.set(a.at.x, 0, a.at.y);
        a.m.root.rotation.y = Math.atan2(d.x, d.y);
        return 1;
      }
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
      c.m.head.rotation.x = moving ? 0 : c.look !== undefined ? 0.75 + Math.sin(time * 3 + c.at.x) * 0.12 : 0.3 + Math.sin(time * 1.5 + c.at.x) * 0.15;
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
        this.ev.hint(`Check Farm ${farm + 1} at its sign first`);
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
    if (this.riding) return atSpot ? this.ev.hint('Get off the tractor first') : undefined;
    const f = this.liveField();
    const { ready, toDrive, any } = this.hireFarms(t, f);
    if (!any) return atSpot ? this.ev.hint('No farm needs ploughing now') : undefined;
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

  /** The heap in the feeder: rises while feed is poured, then the cows eat it down over a few minutes. */
  private animateFeed(dt: number) {
    if (this.pouring > 0) {
      this.pouring -= dt;
      this.feedLevel = Math.min(1, this.feedLevel + dt / 2.4);
    } else this.feedLevel = Math.max(0.2, this.feedLevel - dt / 240);
    const h = 0.04 + this.feedLevel * 0.42;
    this.feed.scale.set(1.42 - (1 - this.feedLevel) * 0.1, h, 0.58);
    this.feed.position.y = 0.4 + h / 2;
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

  /** A fixed camera over the whole farm (the first session's backdrop is a picture taken with it), or null to follow
      the farmer. `capture` also hides the farmer and the green arrow. */
  setOverview(v: { x: number; z: number; h: number; back: number; capture?: boolean } | null) {
    this.overview = v;
    this.farmer.root.visible = !v?.capture;
    this.hideArrow = !!v?.capture;
    this.placeCamera();
    this.dirty = true;
  }
  private overview: { x: number; z: number; h: number; back: number } | null = null;
  private hideArrow = false;

  private placeCamera() {
    if (this.overview) {
      const o = this.overview;
      this.camera.position.set(o.x, o.h, o.z + o.back);
      this.camera.lookAt(o.x, 0, o.z);
      this.camera.updateMatrixWorld();
      this.sun.position.set(o.x - 9, 22, o.z + 9);
      this.sun.target.position.set(o.x, 0, o.z);
      const sc = this.sun.shadow.camera;
      sc.left = -30;
      sc.right = 30;
      sc.top = 26;
      sc.bottom = -26;
      sc.updateProjectionMatrix();
      return;
    }
    const a = this.camAt;
    this.camera.position.set(a.x, 13.5, a.z + 9.6);
    this.camera.lookAt(a.x, 0.4, a.z + 0.6);
    this.sun.position.set(a.x - 9, 22, a.z + 9);
    this.sun.target.position.set(a.x, 0, a.z);
  }
}

