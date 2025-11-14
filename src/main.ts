// src/main.ts
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls';
import { Universe } from './universe';
import { StarVisualizerCinematic } from './cosmos/StarVisualizerCinematic';
import type { GalaxyDescriptor } from './cosmos/types';
import { generateStar } from './cosmos/star';
import { SolarSystem } from './cosmos/SolarSystem';
import { mulberry32 } from './cosmos/prng';

// --- DOM ---
const container = document.getElementById('app') as HTMLDivElement;
const seedEl = document.getElementById('seed') as HTMLElement;
const galNameEl = document.getElementById('gal-name') as HTMLElement;

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio ?? 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1e9);
camera.position.set(0, 2000, 5000);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// --- Universe ---
const universe = new Universe({ seed: Math.floor(Math.random() * 1e9), sizeRange: [40000, 200000] });
seedEl.textContent = String(universe.seed);
const originGalaxy = universe.getGalaxyAt({ x: 0, y: 0, z: 0 });
galNameEl.textContent = originGalaxy.id ?? 'unknown';
const bg = universe.getBackgroundColorForGalaxy?.(originGalaxy) ?? [8, 10, 18];
scene.background = new THREE.Color(`rgb(${bg[0]},${bg[1]},${bg[2]})`);
let activeStarId: string | null = null;
let currentSolarSystem: SolarSystem | null = null;

// --- GalaxyLOD ---
class GalaxyLOD {
	group: THREE.Group;
	public starVisualizers: Map<number, StarVisualizerCinematic> = new Map();
	private pointCloud!: THREE.Points;
	private dynamicPointsGeom!: THREE.BufferGeometry;
	private dynamicPointsMat!: THREE.PointsMaterial;
	rotationEnabled = false;


	private readonly scale = 0.05;
	private readonly starDistanceThreshold = 5000;
	private readonly galaxyDistanceThreshold = 2e6;

	constructor(public galaxyDescriptor: GalaxyDescriptor) {
		this.group = new THREE.Group();
		this.group.name = `galaxy-${galaxyDescriptor.id}`;
		this.buildPointCloud();
	}

	private buildPointCloud() {
		const stars = this.galaxyDescriptor.stars ?? [];
		const maxPoints = Math.min(stars.length, 4000); // plus visible
		const positions = new Float32Array(maxPoints * 3);
		const colors = new Float32Array(maxPoints * 3);

		for (let i = 0; i < maxPoints; i++) {
			const s = stars[i];
			positions[i * 3] = (s.position?.x ?? 0) * this.scale;
			positions[i * 3 + 1] = (s.position?.y ?? 0) * this.scale;
			positions[i * 3 + 2] = (s.position?.z ?? 0) * this.scale;

			const rgb = this.spectralToRgb(s.spectralClass);
			colors[i * 3] = rgb[0] / 255;
			colors[i * 3 + 1] = rgb[1] / 255;
			colors[i * 3 + 2] = rgb[2] / 255;
		}

		this.dynamicPointsGeom = new THREE.BufferGeometry();
		this.dynamicPointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		this.dynamicPointsGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		this.dynamicPointsMat = new THREE.PointsMaterial({
			size: 1.5,
			vertexColors: true,
			transparent: true,
			opacity: 0.95,
			depthWrite: false,
			sizeAttenuation: true
		});

		this.pointCloud = new THREE.Points(this.dynamicPointsGeom, this.dynamicPointsMat);
		this.group.add(this.pointCloud);
	}

	private spectralToRgb(s: string | undefined): [number, number, number] {
		const map: Record<string, [number, number, number]> = {
			O: [155, 180, 255],
			B: [170, 190, 255],
			A: [200, 210, 255],
			F: [230, 230, 255],
			G: [255, 245, 230],
			K: [255, 210, 170],
			M: [255, 180, 150],
		};
		return map[s ?? 'G'] ?? [220, 220, 220];
	}

	update(camera: THREE.Camera) {
		const camPos = camera.position;
		const galDistance = this.group.position.distanceTo(camPos);
		const showStars = galDistance < this.galaxyDistanceThreshold;

		// Points lointains
		this.pointCloud.visible = showStars;

		// étoiles proches
		this.galaxyDescriptor.stars.forEach((star, index) => {
			const starPos = new THREE.Vector3(star.position?.x ?? 0, star.position?.y ?? 0, star.position?.z ?? 0).multiplyScalar(this.scale);
			const distance = starPos.distanceTo(camPos);

			if (distance < this.starDistanceThreshold) {
				let vis = this.starVisualizers.get(index);
				if (!vis) {
					vis = new StarVisualizerCinematic(star, { lodDistance: 600 });
					vis.mesh.position.copy(starPos);
					this.starVisualizers.set(index, vis);
					this.group.add(vis.mesh);
				}
				vis.mesh.visible = true;
				vis.updateEffects(distance);
				// masquer point lointain
				this.pointCloud.visible = false;
			} else {
				const vis = this.starVisualizers.get(index);
				if (vis) vis.mesh.visible = false;
				if (this.starVisualizers.size > 0) this.pointCloud.visible = true;
			}
		});
	}

	animate(time: number) {
		this.starVisualizers.forEach(vis => {
			if (vis.mesh.visible) {
				vis.animate(time);
				vis.updateLabelOrientation(camera);
			}
		});
	}
}

// --- Generate galaxies ---
const galaxyLODs: GalaxyLOD[] = [];
const range = 1;
(async function generateGalaxies() {
	for (let x = -range; x <= range; x++) {
		for (let y = -range; y <= range; y++) {
			for (let z = -range; z <= range; z++) {
				await new Promise(r => setTimeout(r, 1));
				const gal = universe.getGalaxyAt({ x, y, z });
				const lod = new GalaxyLOD(gal);
				lod.group.position.set(x * gal.size * 0.05, y * gal.size * 0.05, z * gal.size * 0.05);
				scene.add(lod.group);
				galaxyLODs.push(lod);
			}
		}
	}
})();

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.1));

// --- Resize ---
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Raycaster pour sélectionner une étoile ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const distanceDisplay = document.getElementById('distanceDisplay');

container.addEventListener('click', (event) => {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

	raycaster.setFromCamera(mouse, camera);

	// 🔍 Détection des planètes si un système est actif
    if (currentSolarSystem) {
		const solar = currentSolarSystem as SolarSystem;

        const planetMeshes: THREE.Object3D[] = solar.planetVisualizer.planets.map(p => p.mesh);
        const planetIntersects = raycaster.intersectObjects(planetMeshes, true);

        if (planetIntersects.length > 0) {
            const target = planetIntersects[0].object;
            const targetPos = target.getWorldPosition(new THREE.Vector3());
            const distance = camera.position.distanceTo(targetPos);

            if (distanceDisplay) {
                distanceDisplay.textContent = `🪐 Distance à la planète : ${distance.toFixed(2)} unités`;
            }

            smoothCameraMove(targetPos);
            console.log("🪐 Planète sélectionnée :", target.name ?? "inconnue");
            return; // ← évite de traiter le clic comme un clic sur une étoile
        }
    }

    // 🔭 Détection des étoiles
	const allStarMeshes: THREE.Object3D[] = [];
	galaxyLODs.forEach(lod => {
		lod.starVisualizers.forEach(vis => {
			if (vis.mesh.visible) allStarMeshes.push(vis.mesh);
		});
	});

	const intersects = raycaster.intersectObjects(allStarMeshes, true);
	if (intersects.length > 0) {
		const target = intersects[0].object;
		const targetPos = target.getWorldPosition(new THREE.Vector3());
		const distance = camera.position.distanceTo(targetPos);

		if (distanceDisplay) {
			distanceDisplay.textContent = `📏 Distance à la caméra : ${distance.toFixed(2)} unités`;
		}

		//moveCameraTo(targetPos);
		smoothCameraMove(targetPos);

		// Récupérer l’étoile sélectionnée
		const selectedStar = galaxyLODs.flatMap(lod => Array.from(lod.starVisualizers.values()))
			.find(vis => vis.mesh === target || vis.mesh.children.includes(target));
		console.log("Selected Star: ", selectedStar)
		if (selectedStar) {
			console.log("Selected Star: " + selectedStar)
			const solarSystem = createSolarSystemFromStarVisualizer(selectedStar);
			if (solarSystem) {
				currentSolarSystem = solarSystem;
				displayPlanetDebug(solarSystem);
			}
		}
	}
});

function createSolarSystemFromStarVisualizer(vis: StarVisualizerCinematic): SolarSystem | null {
	console.log('🧪 Star descriptor:', vis.descriptor);
	if (vis.descriptor.seed === undefined || vis.descriptor.index === undefined) return null;

	const solarDescriptor = generateStar({
		seed: vis.descriptor.seed,
		index: vis.descriptor.index,
		rng: vis.descriptor.rng ?? mulberry32(vis.descriptor.seed),
		parentGalaxy: { size: 100000 }
	});
	solarDescriptor.position = vis.mesh.getWorldPosition(new THREE.Vector3());

	const solarSystemDescriptor = {
		id: `SS-${solarDescriptor.id}`,
		name: `System-${solarDescriptor.id}`,
		star: solarDescriptor,
		planets: solarDescriptor.planets
	};

	const solarSystem = new SolarSystem(solarSystemDescriptor, { scene, showOrbits: true });
	return solarSystem;
}

function moveCameraTo(position: THREE.Vector3) {
	camera.position.copy(position.clone().add(new THREE.Vector3(0, 0, 500)));
	controls.target.copy(position);
}

// --- Animation loop ---
const clock = new THREE.Clock();
function animate() {
	requestAnimationFrame(animate);
	const t = clock.getElapsedTime();
	controls.update();
	galaxyLODs.forEach(lod => {
		lod.update(camera);
		lod.animate(t);
	});
	renderer.render(scene, camera);
}
animate();

// --- Debug ---
(window as any).app = { renderer, scene, camera, universe, galaxyLODs };

function displayPlanetDebug(system: SolarSystem) {
	const descriptor = system.getDescriptor();
	const list = document.getElementById('planetList');
	if (!list) return;

	list.innerHTML = '';
	descriptor.planets.forEach((p, i) => {
		const li = document.createElement('li');
		li.textContent = `${p.name ?? 'Planète-' + (i + 1)} — ${p.type} — taille: ${p.size.toFixed(2)} — distance: ${p.distance.toFixed(0)}`;
		list.appendChild(li);
	});
}

function smoothCameraMove(target: THREE.Vector3, duration = 2) {
	const startPos = camera.position.clone();
	const endPos = target.clone().add(new THREE.Vector3(0, 0, 500));
	const startTarget = controls.target.clone();
	const endTarget = target.clone();

	let elapsed = 0;
	const animateMove = () => {
		elapsed += clock.getDelta();
		const t = Math.min(elapsed / duration, 1);

		camera.position.lerpVectors(startPos, endPos, t);
		controls.target.lerpVectors(startTarget, endTarget, t);
		controls.update();

		if (t < 1) requestAnimationFrame(animateMove);
	};
	animateMove();
}