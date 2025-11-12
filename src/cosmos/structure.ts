// src/cosmos/structure.ts
import { mulberry32, pick } from './prng';
import type { RNG } from './prng';
import type { StructureDescriptor } from './types';

export function generateStructure({
  seed,
  index = 0,
  rng = Math.random as unknown as RNG,
  typeHint = undefined,
}: {
  seed: number;
  index?: number;
  rng?: RNG;
  typeHint?: StructureDescriptor['type'] | null;
}): StructureDescriptor {
  const local = mulberry32((seed >>> 0) + index * 1021);
  const kinds: StructureDescriptor['type'][] = ['station', 'ruins', 'beacon', 'derelict', 'mining_outpost', 'research_facility'];
  const type: StructureDescriptor['type'] = typeHint ?? pick(local, kinds);

  const techLevel = Math.max(0, Math.floor(local() * 10));
  const intactness = Number(local().toFixed(2));
  const potential = Number((techLevel * intactness).toFixed(2));

  const lootCategories: Record<StructureDescriptor['type'], string[]> = {
    station: ['supplies', 'trade_goods', 'blueprints'],
    ruins: ['artifacts', 'data_shards', 'unknown_tech'],
    beacon: ['navigation_data', 'signal_logs'],
    derelict: ['ship_parts', 'salvage_metal'],
    mining_outpost: ['ore', 'machinery'],
    research_facility: ['research_notes', 'experimental_cores'],
  };

  return {
    id: `STR-${seed}-${index}`,
    type,
    techLevel,
    intactness,
    potential,
    loot: lootCategories[type] ?? [],
  };
}

