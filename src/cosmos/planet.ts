// src/cosmos/planet.ts
import { mulberry32, pick, lerp } from './prng';
import type { RNG } from './prng';
import type { PlanetDescriptor } from './types';
import { generateMoon } from './moon';

interface GeneratePlanetOpts {
  seed: number;
  index?: number;
  rng?: RNG;
  hostStar?: { spectralClass?: string; starMass?: number; luminosity?: number };
}

export function generatePlanet({
  seed,
  index = 0,
  rng = Math.random as unknown as RNG,
  hostStar = {}
}: GeneratePlanetOpts): PlanetDescriptor {
  const local = mulberry32((seed >>> 0) + index * 911);

  const possibleTypes: PlanetDescriptor['type'][] = [
    'rocky',
    'gaseous',
    'icy',
    'volcanic',
    'habitable',
    'barren'
  ];
  let type = pick(local, possibleTypes);

  if (hostStar.spectralClass && ['G', 'K', 'M'].includes(hostStar.spectralClass) && local() > 0.6)
    type = 'habitable';

  const radiusKm = Math.round(lerp(1500, 70000, local()));
  const gravityG = Math.max(0.05, (radiusKm / 6371) * lerp(0.4, 2.0, local()));

  const atmosChance = local();
  const atmosphere: PlanetDescriptor['atmosphere'] =
    type === 'habitable'
      ? pick(local, ['thin', 'breathable', 'dense'])
      : atmosChance > 0.85
      ? pick(local, ['thin', 'toxic', 'thin'])
      : 'none';

  const resources = {
    metals: Math.round(local() * 100),
    gas: Math.round(local() * (type === 'gaseous' ? 500 : 60)),
    exotic: Math.round(local() * (type === 'volcanic' ? 40 : 8))
  };

  const habitability = (() => {
    let score = 0;
    if (type === 'habitable') score += 0.6;
    if (atmosphere === 'breathable') score += 0.25;
    if (hostStar.spectralClass === 'G') score += 0.1;
    if (hostStar.spectralClass === 'M') score += 0.02;
    return Math.min(1, Number(score.toFixed(2)));
  })();

  const numMoons = Math.max(0, Math.floor(local() * 4));
  const moons = [];
  for (let m = 0; m < numMoons; m++) {
    const mSeed = (Math.floor(local() * 1e9) ^ (seed + m * 13)) >>> 0;
    moons.push(generateMoon({ seed: mSeed, index: m, rng: mulberry32(mSeed) }));
  }

  // ---- Ajout des paramètres de mouvement réalistes ----
  const distance = lerp(30, 400, local()); // distance arbitraire du soleil
  const orbitSpeed = lerp(0.00005, 0.00015, local()); // vitesse lente
  const rotationSpeed = lerp(0.001, 0.005, local()); // plus rapide que orbite
  const orbitEccentricity = lerp(0.0, 0.3, local()); // excentricité de l'orbite
  const orbitInclination = lerp(0, Math.PI / 12, local()); // inclinaison orbitale
  const axialTilt = lerp(0, Math.PI / 6, local()); // axe de rotation incliné
  const orbitPhase = local() * Math.PI * 2; // position initiale dans l'orbite

  // ---- Couleur indicative selon le type ----
  const colorMap: Record<PlanetDescriptor['type'], string> = {
    rocky: '#a0704b',
    gaseous: '#d6c682',
    icy: '#c9e8ff',
    volcanic: '#ff6b3d',
    habitable: '#4fa05f',
    barren: '#888888'
  };
  const color = colorMap[type] ?? '#aaaaaa';

  return {
    id: `PL-${seed}-${index}`,
    name: `Planet-${index + 1}`,
    size: Math.max(0.5, radiusKm / 8000),
    color,
    distance,
    orbitSpeed,
    type,
    radiusKm,
    gravityG: Number(gravityG.toFixed(2)),
    atmosphere,
    resources,
    habitability,
    moons,
    // champs additionnels pour le rendu 3D
    orbitEccentricity,
    orbitInclination,
    orbitPhase,
    rotationSpeed,
    axialTilt
  } as PlanetDescriptor;
}
