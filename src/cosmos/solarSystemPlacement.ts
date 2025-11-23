// src/cosmos/solarSystemPlacement.ts
import * as THREE from 'three';
import type { PlanetDescriptor } from './types';

export function getSystemRadius(planets: PlanetDescriptor[]): number {
    return Math.max(...planets.map(p =>
        (p.distance ?? 0) + (p.size ?? 0)
    ));
}

export function isValidSolarSystemPosition(
    newPos: THREE.Vector3,
    newRadius: number,
    systems: {pos: THREE.Vector3, radius: number}[],
    minMargin: number
): boolean {
    for (const sys of systems) {
        const minDist = sys.radius + newRadius + minMargin;
        if (newPos.distanceTo(sys.pos) < minDist) {
            return false;
        }
    }
    return true;
}

export function generateSolarSystemPositions(
    solarSystemDescriptors: {planets: PlanetDescriptor[]}[],
    minMargin: number = 100,
    maxTries: number = 1000,
    spaceSize: number = 10000
): {pos: THREE.Vector3, radius: number}[] {
    const systems: {pos: THREE.Vector3, radius: number}[] = [];
    for (const descriptor of solarSystemDescriptors) {
        const radius = getSystemRadius(descriptor.planets);
        let pos: THREE.Vector3;
        let tries = 0;
        do {
            pos = new THREE.Vector3(
                Math.random() * spaceSize,
                0,
                Math.random() * spaceSize
            );
            tries++;
        } while (!isValidSolarSystemPosition(pos, radius, systems, minMargin) && tries < maxTries);
        systems.push({pos, radius});
        // Utilise pos pour placer le système solaire
    }
    return systems;
}
