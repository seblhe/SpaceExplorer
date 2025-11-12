// src/cosmos/prng.ts
export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashCoord(c: { x: number; y: number; z: number }): number {
  const x = c.x | 0;
  const y = c.y | 0;
  const z = c.z | 0;
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
}

export function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
