// src/main.ts
import * as THREE from 'three';
import { SolarSystemDescriptor, GalaxyDescriptor } from './cosmos/types';
import { OrbitControls } from './OrbitControls';
import { Universe } from './universe';
import { StarVisualizerCinematic } from './cosmos/StarVisualizerCinematic';
// import type { GalaxyDescriptor } from './cosmos/types';
import { generateStar } from './cosmos/star';
import { SolarSystem } from './cosmos/SolarSystem';
import { mulberry32 } from './cosmos/prng';
import { getSolarSystemExtremePoints } from './cosmos/getSolarSystemExtremePoints';


// --- DOM ---
const container = document.getElementById('app') as HTMLDivElement;
const seedEl = document.getElementById('seed') as HTMLElement;
// Nouveaux éléments pour l'affichage structuré
const galaxyNameEl = document.getElementById('galaxy-name') as HTMLElement;
const galaxyCoordsEl = document.getElementById('galaxy-coords') as HTMLElement;
const galaxyTypeEl = document.getElementById('galaxy-type') as HTMLElement;
const galaxySystemsEl = document.getElementById('galaxy-systems') as HTMLElement;

const systemNameEl = document.getElementById('system-name') as HTMLElement;
const systemCoordsEl = document.getElementById('system-coords') as HTMLElement;
const systemSpectralEl = document.getElementById('system-spectral') as HTMLElement;
const systemSizeEl = document.getElementById('system-size') as HTMLElement;
const systemPlanetsEl = document.getElementById('system-planets') as HTMLElement;
const systemPlanetListEl = document.getElementById('system-planet-list') as HTMLElement;

const planetNameEl = document.getElementById('planet-name') as HTMLElement;
const planetTypeEl = document.getElementById('planet-type') as HTMLElement;
const planetDistanceEl = document.getElementById('planet-distance') as HTMLElement;
const planetBiomeEl = document.getElementById('planet-biome') as HTMLElement;
const planetGravityEl = document.getElementById('planet-gravity') as HTMLElement;
const planetAtmosphereEl = document.getElementById('planet-atmosphere') as HTMLElement;
const planetMoonsEl = document.getElementById('planet-moons') as HTMLElement;

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
displayGalaxyInfo(originGalaxy);
//galNameEl.textContent = originGalaxy.id ?? 'unknown';
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

		if (showStars) {
			// étoiles proches : on affiche les meshes et on cache le nuage de points
			this.galaxyDescriptor.stars.forEach((star, index) => {
				const starPos = new THREE.Vector3(star.position?.x ?? 0, star.position?.y ?? 0, star.position?.z ?? 0).multiplyScalar(this.scale);
				let vis = this.starVisualizers.get(index);
				if (!vis) {
					vis = new StarVisualizerCinematic(star, { lodDistance: 600 });
					vis.mesh.position.copy(starPos);
					this.starVisualizers.set(index, vis);
					this.group.add(vis.mesh);
				}
				vis.mesh.visible = true;
				// Correction: calcul de la distance en espace monde pour l'effet visuel
				const worldStarPos = starPos.clone().add(this.group.position);
				vis.updateEffects(worldStarPos.distanceTo(camPos));
			});
			this.pointCloud.visible = false;
		} else {
			// Points lointains : on affiche le nuage de points et on cache les meshes
			this.pointCloud.visible = true;
			this.starVisualizers.forEach(vis => vis.mesh.visible = false);
		}
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
	let firstGalaxyHelper: THREE.Box3Helper | null = null;
	const placedAABBs: THREE.Box3[] = [];
	const aabbScale = 0.15; // Réduit la taille des AABB
	const spacing = 1.5; // Augmente l'espacement entre galaxies
	let firstGalaxyOffset: THREE.Vector3 | null = null;
	for (let x = -range; x <= range; x++) {
		for (let y = -range; y <= range; y++) {
			for (let z = -range; z <= range; z++) {
				await new Promise(r => setTimeout(r, 1));
				const gal = universe.getGalaxyAt({ x, y, z });
				// Calculer la position proposée
				const offset = new THREE.Vector3(x * gal.size * spacing, y * gal.size * spacing, z * gal.size * spacing);
				// Calculer l'AABB déplacé et réduit
				let min = new THREE.Vector3(gal._aabb!.min.x, gal._aabb!.min.y, gal._aabb!.min.z).multiplyScalar(aabbScale).add(offset);
				let max = new THREE.Vector3(gal._aabb!.max.x, gal._aabb!.max.y, gal._aabb!.max.z).multiplyScalar(aabbScale).add(offset);
				const box = new THREE.Box3(min, max);
				// Vérifier le chevauchement
				let overlaps = placedAABBs.some(aabb => aabb.intersectsBox(box));
				if (overlaps) continue; // Refuser placement si chevauchement
				placedAABBs.push(box);
				// Placer la galaxie
				const lod = new GalaxyLOD(gal);
				lod.group.position.copy(offset);
				scene.add(lod.group);
				galaxyLODs.push(lod);
				// Ajout du Box3Helper pour l'AABB de la galaxie
				const color = (galaxyLODs.length === 1) ? 0xffa500 : 0x90ff90;
				const helper = new THREE.Box3Helper(box, color);
				scene.add(helper);
				if (galaxyLODs.length === 1) {
					firstGalaxyHelper = helper;
					firstGalaxyOffset = offset.clone();
				}
			}
		}
	}
	// Positionner la caméra près de la première galaxie
	if (firstGalaxyOffset) {
		camera.position.copy(firstGalaxyOffset.clone().add(new THREE.Vector3(0, 0, 2.5 * (galaxyLODs[0].galaxyDescriptor.size * aabbScale))));
		controls.target.copy(firstGalaxyOffset);
		controls.update();
	}
	// Affichage des AABB des systèmes solaires de la première galaxie
	if (galaxyLODs.length > 0) {
		const firstLOD = galaxyLODs[0];
		const gal = firstLOD.galaxyDescriptor;
		const offset = firstLOD.group.position;
		for (const star of gal.stars) {
			const starPos = new THREE.Vector3(star.position.x, star.position.y, star.position.z).multiplyScalar(0.05).add(offset);
			
			// Utiliser le rayon précalculé s'il existe, sinon recalculer
			let radius = star.systemRadius;
			if (!radius) {
				// Fallback si systemRadius n'a pas été calculé (ne devrait pas arriver avec le nouveau code)
				radius = 2000; 
			}
			
			// Appliquer l'échelle de la galaxie (0.05) au rayon du système ?
			
			// Appliquer l'échelle de la galaxie (0.05) au rayon du système ?
			// NON ! Le rayon du système est en unités locales du système solaire, qui sont affichées telles quelles quand on zoome.
			// MAIS ici on affiche les AABB dans la vue galactique.
			// Les systèmes solaires sont rendus via StarVisualizerCinematic qui a une taille fixe ou dépendante de la distance.
			// Quand on entre dans un système, on change d'échelle.
			// Si on veut visualiser la zone d'influence dans la galaxie, il faut savoir si l'échelle est cohérente.
			// Dans GalaxyLOD, on multiplie la position par 0.05.
			// Si on veut afficher la taille réelle du système dans la galaxie, il faut aussi multiplier le rayon par 0.05 ?
			// Le problème est que 20000 unités * 0.05 = 1000 unités.
			// Si les étoiles sont espacées de 1000 unités, ça va.
			
			// Dans generateGalaxy, on a utilisé les coordonnées brutes pour le check de collision.
			// Donc star.systemRadius est en unités brutes de galaxie (qui sont les mêmes que les unités de système solaire dans ce modèle simplifié où tout est dans le même espace de coordonnées avant scaling).
			
			const scaledRadius = (radius || 500) * 0.05;
			
			const min = starPos.clone().subScalar(scaledRadius);
			const max = starPos.clone().addScalar(scaledRadius);
			
			const box = new THREE.Box3(min, max);
			const helper = new THREE.Box3Helper(box, 0x3399ff); // bleu
			scene.add(helper);
		}
	}
})();

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
			   // Trouver la planète sélectionnée (mesh ou enfant)
			   const planetObj = solar.planetVisualizer.planets.find(p => p.mesh === target || p.mesh.children.includes(target));
			   if (planetObj) {
				   displayPlanetInfo(planetObj.descriptor);
			   }
            return; // ← évite de traiter le clic comme un clic sur une étoile
        }
    }
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
			if (vis.mesh.visible) {
				allStarMeshes.push(vis.mesh);
				// Ajoute explicitement le mesh du soleil (surfaceMeshTexture) pour le clic
				if ((vis as any).surfaceMeshTexture) {
					allStarMeshes.push((vis as any).surfaceMeshTexture);
				}
			}
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
			.find(vis => vis.mesh === target || vis.mesh.children.includes(target) || (vis as any).surfaceMeshTexture === target);
		console.log("Selected Star: ", selectedStar)
		if (selectedStar) {
			console.log("Selected Star: " + selectedStar)
			// Nettoyer l'ancien système s'il existe
			if (currentSolarSystem) {
				currentSolarSystem.dispose();
			}
			const solarSystem = createSolarSystemFromStarVisualizer(selectedStar);
			if (solarSystem) {
				currentSolarSystem = solarSystem;
				displaySystemInfo(solarSystem.getDescriptor());
				// On efface l'info planète
				clearPlanetInfo();
			}
		}
	}
});

// --- Debug ---

function displayGalaxyInfo(galaxy: GalaxyDescriptor) {
	galaxyNameEl.textContent = galaxy.id ?? '—';
	galaxyCoordsEl.textContent = `${galaxy.positionCell?.x ?? 0}, ${galaxy.positionCell?.y ?? 0}, ${galaxy.positionCell?.z ?? 0}`;
	galaxyTypeEl.textContent = galaxy.type ?? '—';
	galaxySystemsEl.textContent = galaxy.numSystems?.toString() ?? '—';
}
(window as any).app = { renderer, scene, camera, universe, galaxyLODs };

function displaySystemInfo(system: SolarSystemDescriptor) {
	systemNameEl.textContent = system.name ?? '—';
	systemCoordsEl.textContent = `${system.star.position?.x?.toFixed(0) ?? 0}, ${system.star.position?.y?.toFixed(0) ?? 0}, ${system.star.position?.z?.toFixed(0) ?? 0}`;
	systemSpectralEl.textContent = system.star.spectralClass ?? '—';
	systemSizeEl.textContent = system.star.size?.toFixed(2) ?? '—';
	systemPlanetsEl.textContent = system.planets?.length?.toString() ?? '—';
	systemPlanetListEl.innerHTML = '';
	system.planets.forEach((p: import('./cosmos/types').PlanetDescriptor, i: number) => {
		const li = document.createElement('li');
		li.textContent = `${p.name ?? 'Planète-' + (i + 1)} — ${p.type} — distance: ${p.distance?.toFixed(0) ?? '—'}  — size: ${p.size}`;
		systemPlanetListEl.appendChild(li);
	});
}

function displayPlanetInfo(planet: import('./cosmos/types').PlanetDescriptor) {
	planetNameEl.textContent = planet.name ?? '—';
	planetTypeEl.textContent = planet.type ?? '—';
	planetDistanceEl.textContent = planet.distance?.toFixed(0) ?? '—';
	planetBiomeEl.textContent = planet.biome ?? '—';
	planetGravityEl.textContent = planet.gravityG?.toFixed(2) ?? '—';
	planetAtmosphereEl.textContent = planet.atmosphere ?? '—';
	planetMoonsEl.textContent = (planet.moons?.map(m => m.id).join(', ') || '—');
}

function clearPlanetInfo() {
	planetNameEl.textContent = '—';
	planetTypeEl.textContent = '—';
	planetDistanceEl.textContent = '—';
	planetBiomeEl.textContent = '—';
	planetGravityEl.textContent = '—';
	planetAtmosphereEl.textContent = '—';
	planetMoonsEl.textContent = '—';
}

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.1));

function createSolarSystemFromStarVisualizer(vis: StarVisualizerCinematic): SolarSystem | null {
	console.log('🧪 Star descriptor:', vis.descriptor);
	if (vis.descriptor.seed === undefined || vis.descriptor.index === undefined) return null;

	const solarDescriptor = generateStar({
		seed: vis.descriptor.seed,
		index: vis.descriptor.index,
		// IMPORTANT : Toujours recréer un RNG frais basé sur la graine pour garantir le déterminisme.
		// Si on réutilise vis.descriptor.rng, son état a avancé et on obtient des résultats différents à chaque clic.
		rng: mulberry32(vis.descriptor.seed),
		parentGalaxy: { size: 100000 }
	});
	solarDescriptor.position = vis.mesh.getWorldPosition(new THREE.Vector3());

	const solarSystemDescriptor = {
		id: `SS-${solarDescriptor.id}`,
		name: `System-${solarDescriptor.id}`,
		star: solarDescriptor,
		planets: solarDescriptor.planets
	};

	const solarSystem = new SolarSystem(solarSystemDescriptor, { scene, showOrbits: true, scale: 0.05 });
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
	if (currentSolarSystem) {
		currentSolarSystem.update(t, camera.position);
	}
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

