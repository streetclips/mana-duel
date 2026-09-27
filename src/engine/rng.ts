export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(next ^ (next >>> 15), next | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, next];
}

export interface RngHolder {
  rng: number;
}

export function random(holder: RngHolder): number {
  const [value, next] = nextRandom(holder.rng);
  holder.rng = next;
  return value;
}

export function randomInt(holder: RngHolder, maxExclusive: number): number {
  return Math.floor(random(holder) * maxExclusive);
}

export function shuffleInPlace<T>(holder: RngHolder, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(holder, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
}

export function normalizeSeed(seed: number): number {
  return Math.floor(Math.abs(seed)) >>> 0;
}
