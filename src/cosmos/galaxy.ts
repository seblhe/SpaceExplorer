// src/cosmos/galaxy.ts
import { mulberry32, hashCoord, pick, lerp } from './prng';
import { generateStar } from './star';
import type { GalaxyDescriptor, StarDescriptor } from './types';

export function generateGalaxy({ seed = 1, cell = { x:0,y:0,z:0 }, opts = {} as { sizeMin?: number; sizeMax?: number } }): GalaxyDescriptor {
  const combinedSeed = (seed ^ hashCoord(cell)) >>> 0;
  const local = mulberry32(combinedSeed);

  const type: GalaxyDescriptor['type'] = pick(local, ['spiral','barred','elliptical','irregular','dwarf']);
  const size = Math.round(lerp(opts.sizeMin ?? 40000, opts.sizeMax ?? 300000, local()));
  const age = Math.round(lerp(2e9, 13.5e9, local()));

  const numSystems = Math.max(20, Math.floor((size / 1000) * lerp(0.2, 1.2, local())));

  const stars: StarDescriptor[] = [];
  for (let i = 0; i < numSystems; i++) {
    const sSeed = (Math.floor(local() * 1e9) ^ combinedSeed ^ i) >>> 0;
    stars.push(generateStar({ seed: sSeed, index: i, rng: mulberry32(sSeed), parentGalaxy: { size, age } }));
  }

  // Compter les classes spectrales
  const spectralCount: Record<StarDescriptor['spectralClass'], number> = {
    O:0,B:0,A:0,F:0,G:0,K:0,M:0
  };
  stars.forEach(st => {
    spectralCount[st.spectralClass]++;
  });

  // Obtenir la dominante
  const dominant = (Object.keys(spectralCount).sort((a,b) => (spectralCount[b as StarDescriptor['spectralClass']] || 0) - (spectralCount[a as StarDescriptor['spectralClass']] || 0))[0] ?? 'G') as StarDescriptor['spectralClass'];

  return {
    id: `GAL-${combinedSeed}-${cell.x}-${cell.y}-${cell.z}`,
    seed: combinedSeed,
    type,
    size,
    age,
    numSystems: stars.length,
    stars,
    phenomena: [],
    structures: [],
    dominantSpectral: dominant,
    positionCell: cell
  };
}
