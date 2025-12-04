import * as THREE from 'three';
import type { SolarSystemDescriptor } from './types';
import { StarVisualizerCinematic } from './StarVisualizerCinematic';
import { PlanetVisualizer } from './PlanetVisualizer';

export interface SolarSystemOptions {
	showOrbits?: boolean;
	scene: THREE.Scene;
	scale?: number;
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
		if (opts.scale) {
			this.starVisualizer.mesh.scale.setScalar(opts.scale);
		}
		//opts.scene.add(this.starVisualizer.mesh);

		// ---- Lumière du soleil ----
		// Decay = 0 pour que la lumière atteigne les planètes lointaines sans atténuation physique excessive
		const starLight = new THREE.PointLight(0xffffff, 1.5, 0, 0); 
		starLight.position.copy(descriptor.star.position);
		starLight.castShadow = true;
		
		// Configuration des ombres pour les éclipses
		starLight.shadow.mapSize.width = 2048;
		starLight.shadow.mapSize.height = 2048;
		starLight.shadow.camera.near = 1;
		starLight.shadow.camera.far = 20000; // Couvre tout le système largement
		starLight.shadow.bias = -0.00005; // Réduit pour éviter les artefacts (peter panning)
		
		opts.scene.add(starLight);

		// ---- Planètes et lunes ----
		this.planetVisualizer = new PlanetVisualizer(descriptor.planets, opts.scene, {
			starPosition: new THREE.Vector3(
				descriptor.star.position.x,
				descriptor.star.position.y,
				descriptor.star.position.z
			),
			starSize: descriptor.star.size,
			showOrbits: opts.showOrbits,
			scale: opts.scale
		});
		//opts.scene.add(this.planetVisualizer.group);
	}

	update(elapsedTime: number, cameraPosition: THREE.Vector3) {
		// console.log("SolarSystem update", elapsedTime);
		const distanceToStar = cameraPosition.distanceTo(this.starVisualizer.mesh.position);

		// ---- Mise à jour LOD Soleil ----
		this.starVisualizer.updateEffects(distanceToStar);
		this.starVisualizer.animate(elapsedTime);

		// ---- Affichage orbites ----
		// Toujours afficher les orbites quand le système est actif (sélectionné)
		this.planetVisualizer.toggleOrbits(true);

		// ---- Mise à jour planètes et lunes ----
		this.planetVisualizer.update(elapsedTime, this.starVisualizer.mesh.position);
	}

	dispose() {
		this.starVisualizer.mesh.parent?.remove(this.starVisualizer.mesh);
		this.planetVisualizer.dispose();
	}

	public getDescriptor(): SolarSystemDescriptor {
		return this.descriptor;
	}
}
