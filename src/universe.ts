// src/universe.ts
import { mulberry32 } from './cosmos/prng';
import { generateGalaxy } from './cosmos/galaxy';
import type { GalaxyDescriptor } from './cosmos/types';

export class Universe {
  seed: number;
  rng: ReturnType<typeof mulberry32>;
  private cache: Map<string, GalaxyDescriptor>;
  sizeRange: [number, number];

  constructor(opts: { seed?: number; sizeRange?: [number,number] } = {}) {
    this.seed = opts.seed ?? Math.floor(Math.random()*1e9)>>>0;
    this.rng = mulberry32(this.seed);
    this.cache = new Map();
    this.sizeRange = opts.sizeRange ?? [40000,300000];
  }

  getGalaxyAt(cell: {x:number,y:number,z:number}): GalaxyDescriptor {
    const key = `${cell.x}|${cell.y}|${cell.z}`;
    if(!this.cache.has(key)){
      const g = generateGalaxy({ seed:this.seed, cell, opts:{ sizeMin:this.sizeRange[0], sizeMax:this.sizeRange[1] }});
      this.cache.set(key,g);
    }
    return this.cache.get(key)!;
  }

  getBackgroundColorForGalaxy(galaxy: GalaxyDescriptor): [number,number,number] {
    const map: Record<string,[number,number,number]> = {
      O:[155,180,255], B:[170,190,255], A:[200,210,255], F:[230,230,255],
      G:[255,245,230], K:[255,210,170], M:[255,180,150]
    };
    const s = galaxy.dominantSpectral ?? 'G';
    const base = map[s] ?? [255,245,230];
    return [Math.max(6,Math.round(base[0]*0.06)),Math.max(6,Math.round(base[1]*0.06)),Math.max(10,Math.round(base[2]*0.06))];
  }
}
