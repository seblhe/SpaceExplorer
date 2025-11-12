// src/cosmos/moon.ts
import type { MoonDescriptor } from './types';
import { mulberry32, lerp } from './prng';

export function generateMoon({ seed, index, rng }: { seed: number; index: number; rng: ReturnType<typeof mulberry32> }): MoonDescriptor {
  const radiusKm = Math.round(lerp(200, 3000, rng()));
  return {
    id: `MOON-${seed}-${index}`,
    kind: rng() > 0.5 ? 'rocky' : 'icy',
    radiusKm,
    resources: {
      metals: Math.round(rng() * 100),
      volatile: Math.round(rng() * 50)
    }
  };
}
