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
		//console.log("SolarSystem constructor")
		this.descriptor = descriptor;

		// ---- Soleil ----
		this.starVisualizer = new StarVisualizerCinematic(descriptor.star, {
			//showOrbits: opts.showOrbits
		});
    	this.starVisualizer.mesh.position.copy(descriptor.star.position);
		//opts.scene.add(this.starVisualizer.mesh);

		// ---- Lumière du soleil ----
		const starLight = new THREE.PointLight(0xffffff, 2, 0); // lumière infinie
		starLight.position.copy(descriptor.star.position);
		opts.scene.add(starLight);

		// ---- Planètes et lunes ----
		this.planetVisualizer = new PlanetVisualizer(descriptor.planets, opts.scene, {
			starPosition: new THREE.Vector3(
				descriptor.star.position.x,
				descriptor.star.position.y,
				descriptor.star.position.z
			),
			showOrbits: opts.showOrbits
		});
		//opts.scene.add(this.planetVisualizer.group);
	}

	update(elapsedTime: number, cameraPosition: THREE.Vector3) {
		const distanceToStar = cameraPosition.distanceTo(this.starVisualizer.mesh.position);

		// ---- Mise à jour LOD Soleil ----
		this.starVisualizer.updateEffects(distanceToStar);
		this.starVisualizer.animate(elapsedTime);

		// ---- Affichage orbites si proche ----
		const showOrbits = distanceToStar < 500;
		this.planetVisualizer.toggleOrbits(showOrbits);

		// ---- Mise à jour planètes et lunes ----
		this.planetVisualizer.update(elapsedTime);
	}

	dispose() {
		this.starVisualizer.mesh.parent?.remove(this.starVisualizer.mesh);
		this.planetVisualizer.dispose();
	}

	public getDescriptor(): SolarSystemDescriptor {
		return this.descriptor;
	}
}
