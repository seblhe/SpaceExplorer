// src/cosmos/phenomena.ts
import { mulberry32, pick, lerp } from './prng';
import type { RNG } from './prng';
import type { PhenomenonDescriptor } from './types';

export function generatePhenomenon({
  seed,
  index = 0,
  rng = Math.random as unknown as RNG,
  parentGalaxy = undefined,
}: {
  seed: number;
  index?: number;
  rng?: RNG;
  parentGalaxy?: { size?: number } | null;
}): PhenomenonDescriptor {
  const local = mulberry32((seed >>> 0) + index * 719);
  const types: PhenomenonDescriptor['type'][] = ['nebula', 'black_hole', 'pulsar', 'anomaly', 'supernova_remnant', 'gravitational_lens'];
  const type = pick(local, types);

  const intensity = Number(lerp(0.1, 1.0, local()).toFixed(2));
  const radiusLy = Math.round(
  lerp(
    1,
    parentGalaxy?.size ? Math.max(1, parentGalaxy.size * 0.02) : 1000,
    local()
  )
);

  const effects: Record<string, any> = {
    nebula: { visibility: 0.7, navigationPenalty: 0.2 },
    black_hole: { danger: 0.95, warpRisk: 0.9 },
    pulsar: { radiation: 0.8 },
    anomaly: { mystery: 1.0, commsDistortion: 0.6 },
    supernova_remnant: { radiation: 0.7, salvage: 0.5 },
    gravitational_lens: { timeDilation: 0.3 },
  };

  return {
    id: `PH-${seed}-${index}`,
    type,
    intensity,
    radiusLy,
    effects: effects[type] ?? {},
  };
}
