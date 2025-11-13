// src/cosmos/moon.ts
import type { MoonDescriptor } from './types';
import { mulberry32, lerp, pick } from './prng';

interface GenerateMoonOpts {
  seed: number;
  index: number;
  rng: ReturnType<typeof mulberry32>;
  hostPlanet?: { radiusKm?: number };
}

export function generateMoon({
  seed,
  index,
  rng,
  hostPlanet
}: GenerateMoonOpts): MoonDescriptor {
  // Rayon réaliste : proportionnel à la planète hôte si disponible
  const baseRadius = hostPlanet?.radiusKm ? hostPlanet.radiusKm * 0.1 : 2000;
  const radiusKm = Math.round(lerp(100, baseRadius, rng()));

  // Taille utilisée pour le rendu 3D
  const size = Math.max(0.1, radiusKm / 1000);

  // Type de lune
  const kind = pick(rng, ['asteroid', 'rocky', 'icy', 'small']);

  // Couleur indicative selon le type
  const colorMap: Record<typeof kind, string> = {
    asteroid: '#888888',
    rocky: '#a0704b',
    icy: '#c9e8ff',
    small: '#bbbbbb'
  };
  const color = colorMap[kind] ?? '#aaaaaa';

  // Ressources selon type
  const resources = {
    metals: Math.round(rng() * (kind === 'rocky' ? 150 : 60)),
    volatile: Math.round(rng() * (kind === 'icy' ? 80 : 40))
  };

  // Orbite autour de la planète
  const distance = lerp(1, 20, rng()) + (hostPlanet?.radiusKm ?? 0) * 0.05;
  const orbitSpeed = lerp(0.001, 0.01, rng());
  const orbitPhase = rng() * Math.PI * 2;

  return {
    id: `MOON-${seed}-${index}`,
    name: `Moon-${index + 1}`,
    kind,
    radiusKm,
    size,
    color,
    distance,
    orbitSpeed,
    orbitPhase,
    resources
  } as MoonDescriptor;
}
