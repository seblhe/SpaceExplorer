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

  // Taille et luminosité cohérentes
  const size = Math.max(0.5, rng() * 4 + 0.5); // en unités arbitraires
  const luminosity = Math.pow(size, 3); // simplifié pour la cohérence visuelle
  const mass = size * 2; // proportionnelle à la taille

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
