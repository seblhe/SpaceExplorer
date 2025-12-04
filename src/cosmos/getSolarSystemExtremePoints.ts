import * as THREE from 'three';
import type { StarDescriptor, PlanetDescriptor, MoonDescriptor } from './types';

/**
 * Calcule tous les points extrêmes utilisés pour la visualisation d'un système solaire,
 * en synchronisant la logique avec PlanetVisualizer (orbites, inclinaison, excentricité, phase, échelle).
 */
export function getSolarSystemExtremePoints(star: StarDescriptor, offset: THREE.Vector3 = new THREE.Vector3(0,0,0)) {
    const points: THREE.Vector3[] = [];
    const starPos = new THREE.Vector3(star.position.x, star.position.y, star.position.z).multiplyScalar(0.05).add(offset);
    points.push(starPos.clone());
    const planets = star.planets ?? [];
    
    // Paramètres alignés avec PlanetVisualizer
    const starVisualRadius = Math.max(2, (star.size ?? 1) * 2);
    const minBaseDistance = starVisualRadius * 4 + 100;
    const baseDistance = Math.max(300, minBaseDistance);
    const spacingFactor = 1.8;

    planets.forEach((planet, i) => {
        // Distance visuelle calculée (ignore planet.distance du descripteur)
        const planetDistance = baseDistance * Math.pow(spacingFactor, i + 1);
        
        // Taille visuelle (alignée avec PlanetVisualizer)
        const radiusScale = Math.max((planet.size ?? 0) * 20, 5);
        const planetVisualSize = radiusScale * 0.05; // Echelle du système

        const ex = planet.orbitEccentricity ?? 0;
        const incl = planet.orbitInclination ?? 0;
        const phase = planet.orbitPhase ?? 0;
        const a = planetDistance;
        const b = planetDistance * (1 - ex);
        
        // Points de l'orbite (échantillonnage)
        for (let t = 0; t < 120; t += 10) { // Optimisation: moins de points
            const theta = (t / 120) * Math.PI * 2 + phase;
            const px = a * Math.cos(theta);
            const pz = b * Math.sin(theta);
            const py = Math.sin(incl) * pz * 0.1;
            
            // Position monde de la planète sur son orbite
            const planetPos = starPos.clone().add(new THREE.Vector3(px, py, pz).multiplyScalar(0.05));
            
            points.push(planetPos.clone());
            
            // Points extrêmes de la sphère planétaire
            points.push(planetPos.clone().add(new THREE.Vector3(planetVisualSize, 0, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(-planetVisualSize, 0, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, planetVisualSize, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, -planetVisualSize, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, 0, planetVisualSize)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, 0, -planetVisualSize)));

            // Lunes
            for (const moon of planet.moons ?? []) {
                // Distance visuelle adaptée (doit matcher PlanetVisualizer)
                const mDistance = radiusScale * 1.5 + 10 + (moon.distance ?? 10) * 5;
                const ma = mDistance;
                // Orbite de la lune (cercle simple)
                for (let mt = 0; mt < 36; mt += 6) {
                    const mtheta = (mt / 36) * Math.PI * 2 + (moon.orbitPhase ?? 0);
                    const mx = ma * Math.cos(mtheta);
                    const mz = ma * Math.sin(mtheta);
                    
                    const moonPos = planetPos.clone().add(new THREE.Vector3(mx, 0, mz).multiplyScalar(0.05));
                    points.push(moonPos);
                }
            }
        }
    });
    return points;
}
