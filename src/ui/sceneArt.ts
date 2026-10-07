import type { SceneId } from './scenery';

export const ART_WIDTH = 2400;
export const ART_HEIGHT = 860;

export const SCENE_LAYERS = ['sky', 'land', 'motes'] as const;

export type SceneLayer = (typeof SCENE_LAYERS)[number];

export interface SceneShape {
  tone: string;
  d: string;
  width?: number;
}

export type SceneArt = Record<SceneLayer, readonly SceneShape[]>;

type Point = readonly [number, number];
type Rand = () => number;

function seeded(seed: number): Rand {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rand: Rand, min: number, max: number): number {
  return min + (max - min) * rand();
}

function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function at([x, y]: Point): string {
  return `${num(x)} ${num(y)}`;
}

function polygon(points: readonly Point[]): string {
  return `M${points.map(at).join('L')}Z`;
}

function ellipse(x: number, y: number, rx: number, ry: number): string {
  const arc = `a${num(rx)} ${num(ry)} 0 1 1`;
  return `M${num(x - rx)} ${num(y)}${arc} ${num(2 * rx)} 0${arc} ${num(-2 * rx)} 0Z`;
}

function circle(x: number, y: number, r: number): string {
  return ellipse(x, y, r, r);
}

function capsule(x: number, y: number, width: number, height: number): string {
  const r = height / 2;
  const arc = `A${num(r)} ${num(r)} 0 0 1`;
  return `M${num(x + r)} ${num(y - height)}L${num(x + width - r)} ${num(y - height)}${arc} ${num(x + width - r)} ${num(y)}L${num(x + r)} ${num(y)}${arc} ${num(x + r)} ${num(y - height)}Z`;
}

function smooth(points: readonly Point[], bottom = ART_HEIGHT): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  let d = `M${num(first[0])} ${num(bottom)}L${at(first)}`;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const next = points[index + 1];
    if (!point || !next) continue;
    d += `Q${at(point)} ${at([(point[0] + next[0]) / 2, (point[1] + next[1]) / 2])}`;
  }
  return `${d}L${at(last)}L${num(last[0])} ${num(bottom)}Z`;
}

function jagged(points: readonly Point[], bottom = ART_HEIGHT): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `M${num(first[0])} ${num(bottom)}L${points.map(at).join('L')}L${num(last[0])} ${num(bottom)}Z`;
}

function rolling(rand: Rand, base: number, amplitude: number, lengths: readonly number[], step = 40): Point[] {
  const waves = lengths.map((length) => ({ length, phase: rand() * Math.PI * 2, weight: 0.55 + rand() * 0.45 }));
  const total = waves.reduce((sum, wave) => sum + wave.weight, 0);
  const points: Point[] = [];
  for (let x = -step; x <= ART_WIDTH + step; x += step) {
    const value = waves.reduce(
      (sum, wave) => sum + wave.weight * Math.sin((x / wave.length) * Math.PI * 2 + wave.phase),
      0,
    );
    points.push([x, base - (amplitude * value) / total]);
  }
  return points;
}

function heightAt(points: readonly Point[], x: number): number {
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;
    if (x <= to[0]) return from[1] + ((to[1] - from[1]) * (x - from[0])) / (to[0] - from[0]);
  }
  return points[points.length - 1]?.[1] ?? ART_HEIGHT;
}

function pine(x: number, y: number, height: number, spread = 0.3): string {
  const w = height * spread;
  return polygon([
    [x, y - height],
    [x + 0.46 * w, y - 0.66 * height],
    [x + 0.2 * w, y - 0.66 * height],
    [x + 0.76 * w, y - 0.33 * height],
    [x + 0.42 * w, y - 0.33 * height],
    [x + w, y + 2],
    [x - w, y + 2],
    [x - 0.42 * w, y - 0.33 * height],
    [x - 0.76 * w, y - 0.33 * height],
    [x - 0.2 * w, y - 0.66 * height],
    [x - 0.46 * w, y - 0.66 * height],
  ]);
}

interface Spacing {
  gap: readonly [number, number];
  size: readonly [number, number];
}

function treeLine(rand: Rand, ground: readonly Point[], { gap, size }: Spacing, spread = 0.3): string {
  let d = '';
  for (let x = -40 + between(rand, 0, gap[1]); x < ART_WIDTH + 40; x += between(rand, gap[0], gap[1])) {
    d += pine(x, heightAt(ground, x) + 3, between(rand, size[0], size[1]), spread);
  }
  return d;
}

function roundTree(x: number, y: number, r: number): string {
  return (
    polygon([
      [x - r * 0.1, y - r * 1.2],
      [x + r * 0.1, y - r * 1.2],
      [x + r * 0.16, y + 2],
      [x - r * 0.16, y + 2],
    ]) +
    circle(x, y - r * 1.75, r) +
    circle(x - r * 0.62, y - r * 1.3, r * 0.68) +
    circle(x + r * 0.66, y - r * 1.36, r * 0.62)
  );
}

function cloud(x: number, y: number, width: number, height: number): string {
  return (
    capsule(x, y, width, height * 0.42) +
    circle(x + width * 0.36, y - height * 0.5, height * 0.42) +
    circle(x + width * 0.62, y - height * 0.42, height * 0.32)
  );
}

function stars(rand: Rand, count: number, top: number, bottom: number): string {
  let d = '';
  for (let index = 0; index < count; index++) {
    d += circle(between(rand, 0, ART_WIDTH), between(rand, top, bottom), between(rand, 0.9, 2.1));
  }
  return d;
}

function motes(rand: Rand, count: number, top: number, bottom: number, size: readonly [number, number]): SceneShape[] {
  let glow = '';
  let core = '';
  for (let index = 0; index < count; index++) {
    const x = between(rand, 0, ART_WIDTH);
    const y = between(rand, top, bottom);
    const r = between(rand, size[0], size[1]);
    glow += circle(x, y, r * 4);
    core += circle(x, y, r);
  }
  return [
    { tone: 'mote-glow', d: glow },
    { tone: 'mote', d: core },
  ];
}

function crescent(x: number, y: number, r: number): string {
  return `M${num(x)} ${num(y - r)}A${num(r)} ${num(r)} 0 1 0 ${num(x)} ${num(y + r)}A${num(r * 0.62)} ${num(r)} 0 1 1 ${num(x)} ${num(y - r)}Z`;
}

function halos(x: number, y: number, r: number): SceneShape[] {
  return [
    { tone: 'glow', d: circle(x, y, r * 3.4) },
    { tone: 'sun', d: circle(x, y, r) },
  ];
}

function mist(y: number, height: number, from = -40, to = ART_WIDTH + 40): string {
  const middle = (from + to) / 2;
  const half = (to - from) / 2;
  return ellipse(middle, y, half, height / 2) + ellipse(middle, y, half * 0.94, height / 3.2);
}

function birds(points: readonly Point[]): string {
  return points
    .map(
      ([x, y]) =>
        `M${num(x - 9)} ${num(y - 2)}Q${num(x - 4.5)} ${num(y - 7)} ${num(x)} ${num(y)}Q${num(x + 4.5)} ${num(y - 7)} ${num(x + 9)} ${num(y - 2)}`,
    )
    .join('');
}

function tufts(rand: Rand, ground: readonly Point[], count: number, height: readonly [number, number]): string {
  let d = '';
  for (let index = 0; index < count; index++) {
    const x = between(rand, 0, ART_WIDTH);
    const y = heightAt(ground, x) + 6;
    const h = between(rand, height[0], height[1]);
    d += polygon([
      [x - 7, y],
      [x - 9, y - h * 0.7],
      [x - 3, y - 2],
      [x, y - h],
      [x + 3, y - 2],
      [x + 9, y - h * 0.75],
      [x + 7, y],
    ]);
  }
  return d;
}

function reeds(rand: Rand, x: number, y: number, count: number, height: number): string {
  let d = '';
  for (let index = 0; index < count; index++) {
    const foot = x + between(rand, -26, 26);
    const lean = between(rand, -16, 16);
    const h = height * between(rand, 0.55, 1);
    d += `M${num(foot)} ${num(y)}Q${num(foot + lean * 0.2)} ${num(y - h * 0.6)} ${num(foot + lean)} ${num(y - h)}`;
  }
  return d;
}

interface Peak {
  top: Point;
  left: Point;
  right: Point;
}

interface Range {
  points: Point[];
  peaks: Peak[];
}

function crags(rand: Rand, base: number, low: number, high: number, width: readonly [number, number]): Range {
  const corners: Point[] = [];
  let x = -260;
  let up = false;
  while (x < ART_WIDTH + 260) {
    corners.push([x, base - (up ? between(rand, low, high) : between(rand, 0, low * 0.5))]);
    x += between(rand, width[0], width[1]) / 2;
    up = !up;
  }
  const points: Point[] = [];
  const peaks: Peak[] = [];
  corners.forEach((corner, index) => {
    points.push(corner);
    const next = corners[index + 1];
    if (!next) return;
    const peakFirst = index % 2 === 1;
    const top = peakFirst ? corner : next;
    const foot = peakFirst ? next : corner;
    const shares = [between(rand, 0.48, 0.6), between(rand, 0.7, 0.86)];
    const rough = shares.map((share): Point => {
      const jitter = between(rand, -1, 1) * Math.hypot(foot[0] - top[0], foot[1] - top[1]) * 0.05;
      return [top[0] + (foot[0] - top[0]) * share + jitter, top[1] + (foot[1] - top[1]) * share - Math.abs(jitter)];
    });
    points.push(...(peakFirst ? rough : rough.reverse()));
    if (peakFirst) {
      const left = corners[index - 1];
      if (left) peaks.push({ top: corner, left, right: next });
    }
  });
  return { points, peaks };
}

function snowcaps(rand: Rand, range: Range, base: number, rise: number): string {
  let d = '';
  for (const { top, left, right } of range.peaks) {
    if (base - top[1] < rise) continue;
    const towardLeft = between(rand, 0.24, 0.34);
    const towardRight = between(rand, 0.24, 0.34);
    const a: Point = [top[0] + (right[0] - top[0]) * towardRight, top[1] + (right[1] - top[1]) * towardRight];
    const b: Point = [top[0] + (left[0] - top[0]) * towardLeft, top[1] + (left[1] - top[1]) * towardLeft];
    const span = a[0] - b[0];
    d += polygon([
      top,
      a,
      [a[0] - span * 0.25, a[1] - between(rand, 6, 14)],
      [a[0] - span * 0.45, Math.max(a[1], b[1]) + between(rand, 2, 10)],
      [b[0] + span * 0.25, b[1] - between(rand, 4, 12)],
      b,
    ]);
  }
  return d;
}

function shades(range: Range, base: number): string {
  let d = '';
  for (const { top, left, right } of range.peaks) {
    const foot: Point = [top[0] + (right[0] - top[0]) * 0.18, base + 40];
    d += polygon([top, foot, [left[0], base + 40], left]);
  }
  return d;
}

function lighthouse(x: number, y: number): SceneShape[] {
  const tower = (from: number, to: number): string => {
    const half = (height: number): number => 15 - (height / 112) * 6;
    return polygon([
      [x - half(from), y - from],
      [x - half(to), y - to],
      [x + half(to), y - to],
      [x + half(from), y - from],
    ]);
  };
  return [
    { tone: 'tower', d: tower(0, 112) },
    { tone: 'tower-2', d: tower(28, 46) + tower(70, 88) },
    {
      tone: 'tower-2',
      d:
        capsule(x - 15, y - 112, 30, 5) +
        polygon([
          [x - 11, y - 132],
          [x, y - 146],
          [x + 11, y - 132],
        ]),
    },
    { tone: 'lamp-glow', d: circle(x, y - 124, 54) },
    {
      tone: 'lamp',
      d: polygon([
        [x - 7, y - 117],
        [x - 7, y - 131],
        [x + 7, y - 131],
        [x + 7, y - 117],
      ]),
    },
  ];
}

function sailboat(x: number, y: number): string {
  return (
    polygon([
      [x - 15, y - 4],
      [x + 15, y - 4],
      [x + 10, y + 2],
      [x - 10, y + 2],
    ]) +
    polygon([
      [x - 1, y - 7],
      [x - 1, y - 40],
      [x + 13, y - 7],
    ]) +
    polygon([
      [x - 4, y - 7],
      [x - 4, y - 32],
      [x - 15, y - 7],
    ])
  );
}

function deadTree(x: number, y: number, height: number, flip: 1 | -1): SceneShape[] {
  const p = (dx: number, dy: number): Point => [x + dx * height * flip, y - dy * height];
  const trunk = polygon([
    p(-0.07, 0),
    p(-0.035, 0.3),
    p(-0.04, 0.55),
    p(-0.012, 0.86),
    p(0.004, 1),
    p(0.014, 0.86),
    p(0.026, 0.55),
    p(0.04, 0.3),
    p(0.08, 0),
  ]);
  const branch = (from: Point, bend: Point, to: Point): string => `M${at(from)}Q${at(bend)} ${at(to)}`;
  const limbs =
    branch(p(-0.02, 0.56), p(-0.16, 0.6), p(-0.27, 0.78)) +
    branch(p(0.02, 0.42), p(0.14, 0.44), p(0.25, 0.6)) +
    branch(p(0, 0.74), p(0.08, 0.82), p(0.12, 0.97));
  const twigs =
    branch(p(-0.16, 0.66), p(-0.2, 0.72), p(-0.14, 0.82)) +
    branch(p(0.16, 0.5), p(0.2, 0.52), p(0.21, 0.42)) +
    branch(p(-0.24, 0.74), p(-0.3, 0.76), p(-0.35, 0.72)) +
    branch(p(0.08, 0.86), p(0.04, 0.9), p(0.02, 0.96));
  return [
    { tone: 'trunk', d: trunk },
    { tone: 'limb', d: limbs, width: height * 0.024 },
    { tone: 'limb', d: twigs, width: height * 0.012 },
  ];
}

function plains(): SceneArt {
  const rand = seeded(7);
  const far = rolling(rand, 512, 22, [900, 420]);
  const mid = rolling(rand, 590, 30, [720, 320]);
  const near = rolling(rand, 694, 26, [560, 260]);
  const deep = rolling(rand, 802, 16, [480, 220]);
  const trees = [
    [560, 15],
    [826, 18],
    [1062, 15],
    [1118, 11],
    [1336, 19],
    [1604, 14],
    [1866, 17],
  ]
    .map(([x = 0, r = 12]) => roundTree(x, heightAt(mid, x) + 3, r))
    .join('');
  return {
    sky: [
      { tone: 'star', d: stars(rand, 150, 10, 470) + stars(rand, 70, 10, 440) },
      ...halos(1110, 190, 40),
      { tone: 'moon', d: crescent(1110, 190, 40) },
      {
        tone: 'cloud',
        d: cloud(860, 150, 150, 46) + cloud(1210, 112, 120, 38) + cloud(1290, 300, 96, 30) + cloud(1580, 200, 170, 50),
      },
    ],
    land: [
      { tone: 'far', d: smooth(far) },
      { tone: 'mist', d: mist(560, 50) },
      { tone: 'mid', d: smooth(mid) },
      { tone: 'mid-2', d: trees },
      { tone: 'near', d: smooth(near) },
      { tone: 'near-2', d: tufts(rand, near, 70, [12, 22]) },
      { tone: 'deep', d: smooth(deep) },
    ],
    motes: [],
  };
}

function ripples(rand: Rand, count: number, top: number, bottom: number, avoid?: readonly [number, number]): string {
  let d = '';
  for (let index = 0; index < count; index++) {
    const depth = between(rand, 0, 1);
    const y = top + depth * depth * (bottom - top);
    const length = 10 + depth * 44;
    const x = between(rand, 0, ART_WIDTH);
    if (avoid && x + length > avoid[0] && x < avoid[1]) continue;
    d += `M${num(x)} ${num(y)}h${num(length)}`;
  }
  return d;
}

function sunPath(rand: Rand, x: number, top: number, rows: number): string {
  let d = '';
  for (let index = 0; index < rows; index++) {
    const half = 10 + index * 3.4 + between(rand, -6, 6);
    d += `M${num(x - half)} ${num(top + index * 13)}h${num(half * 2 * between(rand, 0.4, 0.9))}`;
  }
  return d;
}

function island(): SceneArt {
  const rand = seeded(19);
  const horizon = 522;
  const shore = 640;
  const rock: Point[] = [
    [600, shore + 16],
    [690, 560],
    [760, 506],
    [860, 468],
    [960, 448],
    [1030, 440],
    [1074, 448],
    [1098, 478],
    [1112, 530],
    [1134, 590],
    [1160, shore + 16],
  ];
  return {
    sky: [
      { tone: 'star', d: stars(rand, 150, 10, horizon - 30) + stars(rand, 70, 10, horizon - 40) },
      ...halos(1300, 200, 34),
      {
        tone: 'cloud',
        d:
          capsule(820, 170, 260, 12) +
          capsule(900, 150, 140, 9) +
          capsule(1150, 300, 210, 10) +
          capsule(1330, 120, 230, 11) +
          capsule(1580, 250, 300, 12),
      },
    ],
    land: [
      {
        tone: 'far',
        d:
          smooth([
            [1440, horizon + 4],
            [1500, horizon - 22],
            [1580, horizon - 34],
            [1680, horizon - 20],
            [1760, horizon + 4],
          ]) +
          smooth([
            [380, horizon + 4],
            [450, horizon - 26],
            [560, horizon - 16],
            [620, horizon + 4],
          ]) +
          smooth([
            [1860, horizon + 4],
            [1920, horizon - 14],
            [2000, horizon + 4],
          ]),
      },
      {
        tone: 'water',
        d: polygon([
          [-40, horizon],
          [ART_WIDTH + 40, horizon],
          [ART_WIDTH + 40, ART_HEIGHT],
          [-40, ART_HEIGHT],
        ]),
      },
      { tone: 'glint', d: ripples(rand, 40, horizon + 12, shore, [590, 1170]), width: 2.4 },
      { tone: 'far-2', d: sailboat(1206, horizon - 2) },
      { tone: 'rock', d: jagged(rock) },
      {
        tone: 'rock-2',
        d: polygon([
          [1074, 448],
          [1098, 478],
          [1112, 530],
          [1134, 590],
          [1160, shore + 16],
          [1112, shore + 16],
          [1096, 588],
          [1086, 532],
          [1074, 484],
          [1056, 456],
        ]),
      },
      {
        tone: 'mid',
        d: polygon([
          [760, 506],
          [860, 468],
          [960, 448],
          [1030, 440],
          [1074, 448],
          [1092, 470],
          [1062, 462],
          [1010, 464],
          [948, 470],
          [880, 488],
          [812, 512],
          [786, 524],
        ]),
      },
      {
        tone: 'mid-2',
        d: [
          [872, 470, 40],
          [902, 462, 50],
          [928, 456, 44],
          [956, 452, 56],
        ]
          .map(([x = 0, y = 0, h = 0]) => pine(x, y + 6, h))
          .join(''),
      },
      ...lighthouse(1034, 442),
      {
        tone: 'rock-2',
        d:
          polygon([
            [1338, shore],
            [1346, horizon + 34],
            [1360, horizon + 22],
            [1374, horizon + 36],
            [1380, shore],
          ]) +
          polygon([
            [1394, shore],
            [1400, horizon + 54],
            [1410, horizon + 50],
            [1418, shore],
          ]),
      },
      { tone: 'water-2', d: smooth(rolling(rand, shore, 8, [300, 140])) },
      { tone: 'glint', d: ripples(rand, 40, shore + 16, 760), width: 2.6 },
      { tone: 'water-3', d: smooth(rolling(rand, 764, 10, [260, 120])) },
      { tone: 'glint', d: ripples(rand, 26, 778, 836), width: 2.8 },
      { tone: 'glint', d: sunPath(rand, 1300, horizon + 8, 22), width: 3 },
      { tone: 'water-4', d: smooth(rolling(rand, 840, 12, [320, 150])) },
    ],
    motes: [],
  };
}

function swamp(): SceneArt {
  const rand = seeded(31);
  const shore = 548;
  const willows: Point[] = [];
  let crown = true;
  for (let x = -60; x < ART_WIDTH + 60; x += between(rand, 26, 54)) {
    willows.push([x, shore - (crown ? between(rand, 26, 58) : between(rand, 10, 22))]);
    crown = !crown;
  }
  const water: string[] = [];
  for (let index = 0; index < 60; index++) {
    const depth = between(rand, 0, 1);
    water.push(`M${num(between(rand, 0, ART_WIDTH))} ${num(shore + 16 + depth * 250)}h${num(14 + depth * 40)}`);
  }
  const reflection: string[] = [];
  for (let index = 0; index < 16; index++) {
    const y = shore + 12 + index * 12;
    const half = 22 + between(rand, -10, 10) + index * 1.6;
    reflection.push(`M${num(1250 - half)} ${num(y)}h${num(half * 2 * between(rand, 0.4, 0.85))}`);
  }
  return {
    sky: [
      { tone: 'star', d: stars(rand, 140, 10, 450) + stars(rand, 70, 10, 430) },
      ...halos(1196, 150, 40),
      {
        tone: 'cloud',
        d:
          capsule(880, 196, 300, 10) +
          capsule(1120, 140, 180, 8) +
          capsule(1360, 330, 260, 9) +
          capsule(1560, 180, 240, 10),
      },
    ],
    land: [
      { tone: 'far', d: smooth(willows, shore + 6) },
      { tone: 'mist', d: mist(shore - 18, 64) },
      {
        tone: 'water',
        d: polygon([
          [-40, shore],
          [ART_WIDTH + 40, shore],
          [ART_WIDTH + 40, ART_HEIGHT],
          [-40, ART_HEIGHT],
        ]),
      },
      { tone: 'glint', d: reflection.join(''), width: 3 },
      { tone: 'glint', d: water.join(''), width: 2.2 },
      {
        tone: 'water-2',
        d: ellipse(1150, 650, 46, 7) + ellipse(1196, 664, 26, 5) + ellipse(980, 702, 40, 6) + ellipse(1390, 690, 34, 6),
      },
      ...deadTree(1060, 600, 210, 1),
      ...deadTree(1366, 586, 130, -1),
      ...deadTree(640, 590, 170, -1),
      ...deadTree(1800, 596, 190, 1),
      {
        tone: 'reed',
        d: reeds(rand, 1000, 610, 9, 70) + reeds(rand, 1300, 596, 7, 54) + reeds(rand, 1460, 640, 9, 80),
        width: 3,
      },
      { tone: 'mist', d: mist(626, 46, 600, 1900) },
      { tone: 'near', d: smooth(rolling(rand, 812, 18, [360, 170])) },
      { tone: 'reed-2', d: reeds(rand, 960, 806, 14, 120) + reeds(rand, 1420, 812, 14, 130), width: 4 },
    ],
    motes: [...motes(rand, 9, 560, 760, [2.4, 3.4]), ...motes(rand, 7, 580, 780, [2, 3])],
  };
}

function mountain(): SceneArt {
  const rand = seeded(43);
  const far = crags(rand, 568, 70, 230, [300, 460]);
  const mid = crags(rand, 652, 40, 150, [220, 340]);
  const near = crags(rand, 748, 30, 110, [170, 270]);
  return {
    sky: [
      { tone: 'star', d: stars(rand, 150, 10, 420) + stars(rand, 70, 10, 400) },
      ...halos(1306, 232, 42),
      {
        tone: 'cloud',
        d: cloud(840, 190, 160, 44) + cloud(1300, 150, 130, 40) + cloud(1610, 240, 180, 48),
      },
      {
        tone: 'bird',
        d: birds([
          [1096, 214],
          [1122, 198],
          [1150, 222],
          [1196, 300],
          [1218, 312],
        ]),
      },
    ],
    land: [
      { tone: 'far', d: jagged(far.points) },
      { tone: 'far-2', d: shades(far, 568) },
      { tone: 'snow', d: snowcaps(rand, far, 568, 120) },
      { tone: 'mid', d: jagged(mid.points) },
      { tone: 'mid-2', d: shades(mid, 652) },
      { tone: 'near', d: jagged(near.points) },
      { tone: 'near-2', d: shades(near, 748) },
      { tone: 'deep', d: smooth(rolling(rand, 822, 14, [420, 190])) },
    ],
    motes: [...motes(rand, 22, 560, 840, [1.4, 2.6]), ...motes(rand, 18, 520, 820, [1.2, 2.2])],
  };
}

function woods(): SceneArt {
  const rand = seeded(59);
  const far = rolling(rand, 478, 26, [700, 300]);
  const mid = rolling(rand, 566, 30, [620, 280]);
  const near = rolling(rand, 680, 26, [520, 240]);
  const deep = rolling(rand, 806, 18, [460, 210]);
  return {
    sky: [
      { tone: 'star', d: stars(rand, 150, 10, 440) + stars(rand, 70, 10, 420) },
      ...halos(1150, 206, 36),
      { tone: 'moon', d: crescent(1150, 206, 36) },
      {
        tone: 'cloud',
        d: cloud(900, 160, 140, 40) + cloud(1340, 120, 120, 36) + cloud(1540, 260, 160, 44),
      },
    ],
    land: [
      { tone: 'far', d: smooth(far) + treeLine(rand, far, { gap: [12, 20], size: [24, 40] }, 0.28) },
      { tone: 'mist', d: mist(492, 56) },
      { tone: 'mid', d: smooth(mid) + treeLine(rand, mid, { gap: [18, 30], size: [42, 66] }, 0.3) },
      { tone: 'mist', d: mist(584, 48) },
      { tone: 'near', d: smooth(near) + treeLine(rand, near, { gap: [28, 46], size: [70, 104] }, 0.31) },
      { tone: 'deep', d: smooth(deep) + treeLine(rand, deep, { gap: [70, 120], size: [120, 170] }, 0.32) },
    ],
    motes: [...motes(rand, 12, 560, 820, [2, 3]), ...motes(rand, 10, 600, 840, [1.8, 2.8])],
  };
}

export const SCENE_ART: Record<SceneId, SceneArt> = {
  plains: plains(),
  island: island(),
  swamp: swamp(),
  mountain: mountain(),
  forest: woods(),
};
