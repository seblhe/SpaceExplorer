import * as THREE from 'three';
import type { SolarSystemDescriptor } from './types';
import { StarVisualizerCinematic } from './StarVisualizerCinematic';
import { PlanetVisualizer } from './PlanetVisualizer';

export interface SolarSystemOptions {
    showOrbits?: boolean;
    scene: THREE.Scene;
}

export class SolarSystem {
    public starVisualizer: StarVisualizerCinematic;
    public planetVisualizer: PlanetVisualizer;
    private descriptor: SolarSystemDescriptor;

    constructor(descriptor: SolarSystemDescriptor, opts: SolarSystemOptions) {
        this.descriptor = descriptor;

        // ---- Soleil ----
        this.starVisualizer = new StarVisualizerCinematic(descriptor.star, {
            showOrbits: opts.showOrbits
        });
        opts.scene.add(this.starVisualizer.mesh);

        // ---- Planètes et lunes ----
        this.planetVisualizer = new PlanetVisualizer(descriptor.planets, opts.scene, {
            starPosition: new THREE.Vector3(0, 0, 0),
            showOrbits: opts.showOrbits
        });
    }

    update(elapsedTime: number, cameraPosition: THREE.Vector3) {
        const distanceToStar = cameraPosition.distanceTo(this.starVisualizer.mesh.position);

        // ---- Mise à jour LOD Soleil ----
        this.starVisualizer.updateEffects(distanceToStar);
        this.starVisualizer.animate(elapsedTime);

        // ---- Affichage orbites si proche ----
        const showOrbits = distanceToStar < 1000;
        this.planetVisualizer.toggleOrbits(showOrbits);

        // ---- Mise à jour planètes et lunes ----
        this.planetVisualizer.update(elapsedTime, this.starVisualizer.mesh.position);
    }

    dispose() {
        this.starVisualizer.mesh.parent?.remove(this.starVisualizer.mesh);
        this.planetVisualizer.dispose();
    }
}
