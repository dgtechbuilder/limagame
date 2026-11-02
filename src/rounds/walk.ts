/* Walking network for the field rounds, in stage coordinates (874 × 402).
   Nodes are points on the painted map's grass and dirt path; every bed has a "stand" node on the grass in
   front of it. A walk is the shortest route over this network, so the farmer never crosses a bed. */

export type Pt = [number, number];

export type BedId = 'maizeFront' | 'maizeBack' | 'greensLeft' | 'greensFront' | 'tomatoLeft' | 'tomatoRight';

export interface Bed {
  id: BedId;
  /** soil outline on the painted map: used for the glow and taps */
  poly: Pt[];
  /** where the numbered pin sits */
  pin: Pt;
  /** where the farmer stands to look at it */
  stand: Pt;
}

export const BEDS: Record<BedId, Bed> = {
  maizeFront: { id: 'maizeFront', poly: [[402, 250], [500, 206], [557, 224], [455, 274]], pin: [482, 226], stand: [474, 292] },
  maizeBack: { id: 'maizeBack', poly: [[326, 222], [420, 176], [470, 196], [380, 247]], pin: [398, 206], stand: [396, 264] },
  greensLeft: { id: 'greensLeft', poly: [[179, 277], [268, 232], [348, 252], [238, 307]], pin: [262, 270], stand: [232, 326] },
  greensFront: { id: 'greensFront', poly: [[258, 313], [338, 278], [425, 290], [321, 340]], pin: [340, 312], stand: [336, 358] },
  tomatoLeft: { id: 'tomatoLeft', poly: [[510, 280], [596, 236], [657, 248], [562, 302]], pin: [585, 266], stand: [546, 314] },
  tomatoRight: { id: 'tomatoRight', poly: [[580, 306], [650, 272], [728, 278], [637, 328]], pin: [650, 302], stand: [645, 350] },
};

export const standNode = (bed: BedId) => `stand:${bed}`;

const NODES: Record<string, Pt> = {
  // the dirt path along the bottom of the map
  entry: [26, 292],
  a: [120, 322],
  b: [230, 352],
  c: [330, 378],
  d: [414, 388],
  e: [520, 384],
  f: [610, 372],
  // grass lanes between the beds
  m1: [440, 350],
  m2: [466, 314],
  m3: [448, 286],
  m4: [430, 274],
  m5: [443, 302],
  t1: [535, 342],
  t2: [592, 348],
  ...Object.fromEntries(Object.values(BEDS).map(b => [standNode(b.id), b.stand])),
};

const EDGES: [string, string][] = [
  ['entry', 'a'], ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'],
  ['b', standNode('greensLeft')],
  ['c', standNode('greensFront')],
  ['d', 'm1'], ['m1', 'm2'], ['m2', standNode('maizeFront')],
  [standNode('maizeFront'), 'm3'], ['m3', 'm4'], ['m4', standNode('maizeBack')],
  ['m4', 'm5'], ['m5', 'm1'],
  ['e', 't1'], ['t1', standNode('tomatoLeft')], ['t1', 't2'], ['t2', standNode('tomatoRight')], ['f', standNode('tomatoRight')],
];

export const START_NODE = 'entry';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const NEIGHBOURS: Record<string, string[]> = {};
EDGES.forEach(([x, y]) => {
  (NEIGHBOURS[x] ??= []).push(y);
  (NEIGHBOURS[y] ??= []).push(x);
});

/** Shortest route between two nodes (Dijkstra over a graph of about twenty points). */
export function routeBetween(from: string, to: string): Pt[] {
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const todo = new Set<string>(Object.keys(NODES));
  while (todo.size) {
    let u: string | null = null;
    todo.forEach(n => {
      if (best[n] !== undefined && (u === null || best[n] < best[u])) u = n;
    });
    if (u === null || u === to) break;
    todo.delete(u);
    for (const v of NEIGHBOURS[u] ?? []) {
      const alt = best[u] + dist(NODES[u], NODES[v]);
      if (best[v] === undefined || alt < best[v]) {
        best[v] = alt;
        prev[v] = u;
      }
    }
  }
  const path: Pt[] = [];
  for (let n: string | undefined = to; n !== undefined; n = prev[n]) path.unshift(NODES[n]);
  return path;
}

export function measure(pts: Pt[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return cum;
}

/** Point and facing at distance d along a route. */
export function pointAt(pts: Pt[], cum: number[], d: number): { p: Pt; dir: 1 | -1 } {
  for (let i = 1; i < pts.length; i++) {
    if (d <= cum[i] || i === pts.length - 1) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: bx >= ax ? 1 : -1 };
    }
  }
  return { p: pts[0], dir: 1 };
}

export const START_POINT: Pt = NODES[START_NODE];
