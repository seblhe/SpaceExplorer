// src/cosmos/star.ts
import type { StarDescriptor } from './types';
import { mulberry32 } from './prng';
import { generatePlanet } from './planet';

export function generateStar(opts: { 
  seed: number; 
  index: number; 
  rng: ReturnType<typeof mulberry32>; 
  parentGalaxy: { size: number; age?: number }; 
}): StarDescriptor {
  //console.log("Star generateStar")
  const { seed, index, rng, parentGalaxy } = opts;

  // Spectral classes selon la classification réelle OBAFGKM
  const spectralClasses: StarDescriptor['spectralClass'][] = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
  const spectralClass = spectralClasses[Math.floor(rng() * spectralClasses.length)];

  // Taille basée sur la classe spectrale (Rayon relatif au Soleil ~1.0)
  // O: > 6.6, B: 1.8-6.6, A: 1.4-1.8, F: 1.15-1.4, G: 0.96-1.15, K: 0.7-0.96, M: < 0.7
  // Ajusté pour éviter des étoiles trop énormes visuellement
  const sizeRanges: Record<string, [number, number]> = {
    O: [4.0, 6.0], // Réduit de [6.6, 15.0]
    B: [2.5, 4.0], // Réduit de [1.8, 6.6]
    A: [1.8, 2.5],
    F: [1.2, 1.8],
    G: [0.9, 1.2],
    K: [0.6, 0.9],
    M: [0.3, 0.6]
  };
  const range = sizeRanges[spectralClass] ?? [0.5, 5.0];
  const size = range[0] + rng() * (range[1] - range[0]);

  // Luminosité approximative (L ~ R^2 * T^4), ici simplifié
  const luminosity = Math.pow(size, 3); 
  const mass = size * 2; // proportionnelle à la taille (simplifié)

  // Position 3D dans la galaxie
  const position = {
    x: (rng() - 0.5) * parentGalaxy.size,
    y: (rng() - 0.5) * parentGalaxy.size,
    z: (rng() - 0.5) * parentGalaxy.size,
  };

  // Déterminer un nombre réaliste de planètes
  const planetCount = Math.floor(rng() * 6) + (spectralClass === 'G' ? 3 : 1); // les G ont souvent plus de planètes
  const planets = [];

  for (let i = 0; i < planetCount; i++) {
    const pSeed = (seed ^ (index * 131) ^ (i * 977)) >>> 0;
    const planetRng = mulberry32(pSeed);

    // Distance de la planète à l’étoile (en millions de km)
    const baseDistance = (i + 1) * (20 + rng() * 30); // espace progressif
    const orbitEccentricity = Math.min(0.4, rng() * 0.3); // orbites plus ou moins elliptiques
    const orbitInclination = (rng() - 0.5) * 15; // inclinaison orbitale en degrés

    // Génération de la planète
    const planet = generatePlanet({
      seed: pSeed,
      index: i,
      rng: planetRng,
      hostStar: { spectralClass, starMass: mass, luminosity },
    });

    // Ajout des propriétés orbitales
    Object.assign(planet, {
      distance: baseDistance,
      orbitEccentricity,
      orbitInclination,
      orbitSpeed: Math.max(0.001, 0.05 / Math.sqrt(baseDistance)), // plus la planète est loin, plus elle tourne lentement
      selfRotationSpeed: 0.1 + rng() * 0.3, // rotation sur elle-même (jours)
      selfTilt: (rng() - 0.5) * 45, // axe de rotation décalé
    });

    planets.push(planet);
  }
  //console.log(planets.length +" planètes générées")

  return {
    id: `STAR-${seed}-${index}`,
	name: `STAR-${seed}-${index}`,
    spectralClass,
    mass,
    luminosity,
    numPlanets: planets.length,
    radius: size * 20,
    size,
    position,
    planets,
  };
}
