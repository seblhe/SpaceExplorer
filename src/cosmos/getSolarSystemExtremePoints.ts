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
            const x0 = a * Math.cos(theta);
            const z0 = b * Math.sin(theta);
            
            // 1. Rotation autour de X (Inclinaison)
            const y1 = z0 * Math.sin(incl);
            const z1 = z0 * Math.cos(incl);
            const x1 = x0;

            // 2. Rotation autour de Y (Noeud ascendant)
            const omega = planet.orbitAscendingNode ?? 0;
            const x2 = x1 * Math.cos(omega) + z1 * Math.sin(omega);
            const y2 = y1;
            const z2 = -x1 * Math.sin(omega) + z1 * Math.cos(omega);
            
            // Position monde de la planète sur son orbite
            const planetPos = starPos.clone().add(new THREE.Vector3(x2, y2, z2).multiplyScalar(0.05));
            
            points.push(planetPos.clone());
            
            // Points extrêmes de la sphère planétaire
            points.push(planetPos.clone().add(new THREE.Vector3(planetVisualSize, 0, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(-planetVisualSize, 0, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, planetVisualSize, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, -planetVisualSize, 0)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, 0, planetVisualSize)));
            points.push(planetPos.clone().add(new THREE.Vector3(0, 0, -planetVisualSize)));

            // Anneaux
            if (planet.rings && planet.rings.length > 0) {
                const maxRingRadius = Math.max(...planet.rings.map(r => r.outerRadius));
                const ringVisualRadius = radiusScale * maxRingRadius;
                
                // Ajouter des points extrêmes pour les anneaux (cercle dans le plan incliné)
                const tilt = planet.selfTilt ?? 0;
                for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 2) {
                    const rx = ringVisualRadius * Math.cos(ang);
                    const rz = ringVisualRadius * Math.sin(ang);
                    
                    // Rotation tilt (autour de Z)
                    const tx = rx * Math.cos(tilt);
                    const ty = rx * Math.sin(tilt);
                    const tz = rz;
                    
                    points.push(planetPos.clone().add(new THREE.Vector3(tx, ty, tz)));
                }
            }

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
                    
                    // Appliquer l'inclinaison (selfTilt) comme dans PlanetVisualizer
                    const tilt = planet.selfTilt ?? 0;
                    // Rotation autour de Z (comme translationGroup.rotation.z = tilt)
                    // Le plan orbital des lunes est initialement XZ (y=0)
                    // x' = x*cos(t) - y*sin(t) -> x*cos(t)
                    // y' = x*sin(t) + y*cos(t) -> x*sin(t)
                    // z' = z
                    const rx = mx * Math.cos(tilt);
                    const ry = mx * Math.sin(tilt);
                    const rz = mz;

                    // On n'utilise pas de facteur 0.05 ici pour être cohérent avec le visuel
                    const moonPos = planetPos.clone().add(new THREE.Vector3(rx, ry, rz));
                    points.push(moonPos);
                }
            }
        }
    });
    return points;
}
