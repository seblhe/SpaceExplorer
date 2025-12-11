import './style.css';
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
import { Spaceship } from './Spaceship';

// Flags de debug
const SHOW_GALAXY_AABB = false;
const SHOW_SYSTEM_AABB = false;

// --- DOM ---
const container = document.getElementById('app') as HTMLDivElement;
const seedEl = document.getElementById('seed') as HTMLElement;

// --- HUD ELEMENTS ---
const hudGalaxyName = document.getElementById('hud-galaxy-name') as HTMLElement;
const hudGalaxyType = document.getElementById('hud-galaxy-type') as HTMLElement;
const hudGalaxySystems = document.getElementById('hud-galaxy-systems') as HTMLElement;
const hudCoords = document.getElementById('hud-coords') as HTMLElement;
const hudNearbyList = document.getElementById('hud-nearby-list') as HTMLElement;

const hudSystemInfo = document.getElementById('hud-system-info') as HTMLElement;
const hudSystemName = document.getElementById('hud-system-name') as HTMLElement;
const hudSystemStar = document.getElementById('hud-system-star') as HTMLElement;
const hudSystemPlanets = document.getElementById('hud-system-planets') as HTMLElement;

const hudPlanetInfo = document.getElementById('hud-planet-info') as HTMLElement;
const hudPlanetName = document.getElementById('hud-planet-name') as HTMLElement;
const hudPlanetType = document.getElementById('hud-planet-type') as HTMLElement;
const hudPlanetBiome = document.getElementById('hud-planet-biome') as HTMLElement;
const hudPlanetTemp = document.getElementById('hud-planet-temp') as HTMLElement;
const hudPlanetGravity = document.getElementById('hud-planet-gravity') as HTMLElement;
const hudNoTarget = document.getElementById('hud-no-target') as HTMLElement;

const resMetalBar = document.getElementById('res-metal-bar') as HTMLElement;
const resGasBar = document.getElementById('res-gas-bar') as HTMLElement;

const hudShipSpeed = document.getElementById('hud-ship-speed') as HTMLElement;
const hudShipFuelText = document.getElementById('hud-ship-fuel-text') as HTMLElement;
const hudShipFuelBar = document.getElementById('hud-ship-fuel-bar') as HTMLElement;
const hudShipHullText = document.getElementById('hud-ship-hull-text') as HTMLElement;
const hudShipHullBar = document.getElementById('hud-ship-hull-bar') as HTMLElement;
const hudShipShieldText = document.getElementById('hud-ship-shield-text') as HTMLElement;
const hudShipShieldBar = document.getElementById('hud-ship-shield-bar') as HTMLElement;
const hudShipCrew = document.getElementById('hud-ship-crew') as HTMLElement;
const hudShipCargo = document.getElementById('hud-ship-cargo') as HTMLElement;
const hudShipModules = document.getElementById('hud-ship-modules') as HTMLElement;

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ 
	antialias: true, 
	logarithmicDepthBuffer: true 
});
renderer.setPixelRatio(window.devicePixelRatio ?? 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 1e9);
camera.position.set(0, 2000, 5000);

// --- Spaceship ---
// On place le vaisseau devant la caméra initiale
const playerShip = new Spaceship(scene, new THREE.Vector3(0, 2000, 4800));
// On l'oriente pour qu'il regarde vers la galaxie (0,0,0)
playerShip.mesh.lookAt(0, 0, 0);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
(controls as any).enabled = false; // Désactivé pour le mode pilotage

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

		if (SHOW_GALAXY_AABB && galaxyDescriptor._aabb) {
			const min = galaxyDescriptor._aabb.min;
			const max = galaxyDescriptor._aabb.max;
			const width = (max.x - min.x) * this.scale;
			const height = (max.y - min.y) * this.scale;
			const depth = (max.z - min.z) * this.scale;
			
			const boxGeom = new THREE.BoxGeometry(width, height, depth);
			const boxMat = new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.3, transparent: true });
			const box = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeom), boxMat);
			this.group.add(box);
		}
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
			size: 3.0, // Taille fixe en pixels
			vertexColors: true,
			transparent: true,
			opacity: 1.0,
			depthWrite: false,
			sizeAttenuation: false // Désactivé pour que les étoiles soient visibles de loin
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
		
		// On garde toujours le nuage de points visible pour l'effet "étoiles lointaines"
		this.pointCloud.visible = true;

		// On n'active les meshes 3D que si on est vraiment DANS la galaxie
		// Seuil ajusté pour correspondre à la taille de la galaxie
		const insideGalaxyThreshold = this.galaxyDescriptor.size * this.scale * 1.2;
		const insideGalaxy = galDistance < insideGalaxyThreshold;

		if (insideGalaxy) {
			// étoiles proches : on affiche les meshes SEULEMENT si elles sont proches de la caméra
			this.galaxyDescriptor.stars.forEach((star, index) => {
				const starPos = new THREE.Vector3(star.position?.x ?? 0, star.position?.y ?? 0, star.position?.z ?? 0).multiplyScalar(this.scale);
				const worldStarPos = starPos.clone().add(this.group.position);
				const distToStar = worldStarPos.distanceTo(camPos);

				// Distance d'activation du mesh (ex: 2000 unités)
				// Cela évite d'afficher 4000 meshes invisibles
				if (distToStar < 2000) {
					let vis = this.starVisualizers.get(index);
					if (!vis) {
						vis = new StarVisualizerCinematic(star, { lodDistance: 600 });
						vis.mesh.position.copy(starPos);
						this.starVisualizers.set(index, vis);
						this.group.add(vis.mesh);
					}
					vis.mesh.visible = true;
					vis.updateEffects(distToStar);
				} else {
					// Si trop loin, on cache le mesh (le point du nuage prend le relais)
					const vis = this.starVisualizers.get(index);
					if (vis) vis.mesh.visible = false;
				}
			});
		} else {
			// Hors de la galaxie : on cache tous les meshes
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
				if (SHOW_GALAXY_AABB) {
					const color = (galaxyLODs.length === 1) ? 0xffa500 : 0x90ff90;
					const helper = new THREE.Box3Helper(box, color);
					scene.add(helper);
					if (galaxyLODs.length === 1) {
						firstGalaxyHelper = helper;
					}
				}
				if (galaxyLODs.length === 1) {
					firstGalaxyOffset = offset.clone();
				}
			}
		}
	}
	// Positionner la caméra près de la première galaxie
	if (firstGalaxyOffset) {
		// Position beaucoup plus proche (0.5 au lieu de 2.0)
		const startPos = firstGalaxyOffset.clone().add(new THREE.Vector3(0, 0, 0.5 * (galaxyLODs[0].galaxyDescriptor.size * aabbScale)));
		
		// Placer le vaisseau
		playerShip.mesh.position.copy(startPos);
		playerShip.mesh.lookAt(firstGalaxyOffset);
		
		// Initialiser l'affichage des modules
		renderShipModules(playerShip);

		// Placer la caméra juste derrière le vaisseau
		// Le vaisseau regarde vers -Z (local) qui est vers la galaxie
		// Donc on place la caméra en +Z (local) par rapport au vaisseau
		const camOffset = new THREE.Vector3(0, 5, 20);
		// On positionne la caméra relative au vaisseau (qui est aligné avec l'axe Z du monde pour l'instant car lookAt(0,0,-dist))
		// Note: lookAt oriente le -Z de l'objet vers la cible.
		// Ici la cible est en (0,0,0) (relativement au vaisseau si on considère l'axe Z).
		// Bref, startPos est en +Z par rapport à la galaxie.
		// Donc le vecteur (Galaxy -> Ship) est +Z.
		// Le vaisseau regarde la galaxie, donc son "avant" est vers -Z world.
		// Son "arrière" est vers +Z world.
		// Donc on ajoute du +Z à la position du vaisseau pour mettre la caméra derrière.
		
		camera.position.copy(startPos).add(camOffset);
		controls.target.copy(playerShip.mesh.position);
		controls.update();
	}
	// Affichage des AABB des systèmes solaires de la première galaxie
	if (SHOW_SYSTEM_AABB && galaxyLODs.length > 0) {
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

            console.log("🪐 Planète sélectionnée :", target.name ?? "inconnue");
			
			// Trouver la planète sélectionnée (mesh ou enfant)
			const planetObj = solar.planetVisualizer.planets.find(p => p.mesh === target || p.mesh.children.includes(target));
			if (planetObj) {
				displayPlanetInfo(planetObj.descriptor);
			}
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
	hudGalaxyName.textContent = galaxy.id ?? '—';
	hudCoords.textContent = `${galaxy.positionCell?.x ?? 0}, ${galaxy.positionCell?.y ?? 0}, ${galaxy.positionCell?.z ?? 0}`;
	hudGalaxyType.textContent = galaxy.type ?? '—';
	hudGalaxySystems.textContent = galaxy.numSystems?.toString() ?? '—';
}
(window as any).app = { renderer, scene, camera, universe, galaxyLODs };

function displaySystemInfo(system: SolarSystemDescriptor) {
	hudSystemName.textContent = system.name ?? '—';
	hudSystemStar.textContent = `${system.star.spectralClass} (Size: ${system.star.size?.toFixed(2)})`;
	hudSystemPlanets.textContent = system.planets?.length?.toString() ?? '—';
	
	// Afficher le panneau système
	hudSystemInfo.classList.remove('hidden');
	hudNoTarget.classList.add('hidden');
}

function displayPlanetInfo(planet: import('./cosmos/types').PlanetDescriptor) {
	hudPlanetInfo.classList.remove('hidden');
	hudSystemInfo.classList.add('hidden');
	hudNoTarget.classList.add('hidden');

	hudPlanetName.textContent = planet.name ?? '—';
	hudPlanetType.textContent = planet.type ?? '—';
	hudPlanetBiome.textContent = planet.biome ?? '—';
	hudPlanetTemp.textContent = planet.temperature ? `${planet.temperature} K` : '—';
	hudPlanetGravity.textContent = planet.gravityG != null ? planet.gravityG.toFixed(2) + ' G' : '—';
	
	// Ressources
	const metals = planet.resources?.metals ?? 0;
	const gas = planet.resources?.gas ?? 0;
	// Normalisation approximative pour l'affichage (0-1000 -> 0-100%)
	resMetalBar.style.width = Math.min(100, metals / 10) + '%';
	resGasBar.style.width = Math.min(100, gas / 10) + '%';
	
	// Visuel (couleur simple pour l'instant)
	const visual = document.getElementById('hud-planet-visual');
	if (visual) {
		visual.style.backgroundColor = planet.color ?? '#555';
		visual.style.boxShadow = `0 0 20px ${planet.color ?? '#555'}`;
	}
}

function clearPlanetInfo() {
	hudPlanetInfo.classList.add('hidden');
	// Si on a un système actif, on le réaffiche
	if (currentSolarSystem) {
		hudSystemInfo.classList.remove('hidden');
	} else {
		hudNoTarget.classList.remove('hidden');
	}
}

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.1));
scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3)); // Lumière globale douce pour voir le vaisseau


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

	const solarSystem = new SolarSystem(solarSystemDescriptor, { 
		scene, 
		showOrbits: true, 
		scale: 0.05,
		showAABB: SHOW_SYSTEM_AABB
	});
	return solarSystem;
}

function moveCameraTo(position: THREE.Vector3) {
	camera.position.copy(position.clone().add(new THREE.Vector3(0, 0, 500)));
	controls.target.copy(position);
}

// --- Animation loop ---
const clock = new THREE.Clock();
let lastHudUpdate = 0;

function animate() {
	requestAnimationFrame(animate);
	const delta = clock.getDelta();
	const t = clock.getElapsedTime();
	controls.update();
	
	// Mise à jour HUD (toutes les 0.5s pour ne pas surcharger)
	if (t - lastHudUpdate > 0.5) {
		updateHUD(camera.position);
		lastHudUpdate = t;
	}

	galaxyLODs.forEach(lod => {
		lod.update(camera);
		lod.animate(t);
	});
	if (currentSolarSystem) {
		currentSolarSystem.update(t, camera.position);
	}
	
	// Update Spaceship & Camera
	if (playerShip) {
		playerShip.update(delta);
		// Force la mise à jour de la matrice du vaisseau pour que la caméra suive la position ACTUELLE et non celle de la frame précédente
		playerShip.mesh.updateMatrixWorld();
		
		updateShipHUD();

		// Camera Follow (TPS)
		// Offset défini dans l'espace local du vaisseau (avant mise à l'échelle)
		const relativeOffset = new THREE.Vector3(0, 8, 40); 
		const cameraOffset = relativeOffset.applyMatrix4(playerShip.mesh.matrixWorld);
		
		// Suivi immédiat
		camera.position.lerp(cameraOffset, 1.0); 
		
		// Regarder loin devant le vaisseau
		const lookAtPos = playerShip.mesh.position.clone().add(
			new THREE.Vector3(0, 0, -100).applyQuaternion(playerShip.mesh.quaternion)
		);
		camera.lookAt(lookAtPos);
	} else {
		controls.update();
	}

	renderer.render(scene, camera);
}
animate();

// --- HUD Logic ---
function updateHUD(camPos: THREE.Vector3) {
	// 1. Trouver la galaxie la plus proche
	let closestGalaxyLOD: GalaxyLOD | null = null;
	let minGalDist = Infinity;

	galaxyLODs.forEach(lod => {
		const dist = lod.group.position.distanceTo(camPos);
		if (dist < minGalDist) {
			minGalDist = dist;
			closestGalaxyLOD = lod;
		}
	});

	if (closestGalaxyLOD) {
		const gal = (closestGalaxyLOD as GalaxyLOD).galaxyDescriptor;
		displayGalaxyInfo(gal);
		
		// 2. Trouver les étoiles proches dans cette galaxie
		const stars = gal.stars;
		const galaxyPos = (closestGalaxyLOD as GalaxyLOD).group.position;
		
		// Calculer les distances
		const nearbyStars = stars.map(s => {
			const sPos = new THREE.Vector3(s.position.x, s.position.y, s.position.z).multiplyScalar(0.05).add(galaxyPos);
			return {
				star: s,
				dist: sPos.distanceTo(camPos)
			};
		})
		.sort((a, b) => a.dist - b.dist)
		.slice(0, 5); // Top 5

		// Mettre à jour la liste
		hudNearbyList.innerHTML = '';
		nearbyStars.forEach(item => {
			const div = document.createElement('div');
			div.className = 'list-item';
			div.innerHTML = `<span>⭐ ${item.star.spectralClass}-Class</span> <span class="dist">${item.dist.toFixed(0)}u</span>`;
			div.onclick = () => {
				const sPos = new THREE.Vector3(item.star.position.x, item.star.position.y, item.star.position.z).multiplyScalar(0.05).add(galaxyPos);
				smoothCameraMove(sPos);
			};
			hudNearbyList.appendChild(div);
		});
	}
}

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
	let lastTime = performance.now();
	const animateMove = () => {
		const now = performance.now();
		const dt = (now - lastTime) / 1000;
		lastTime = now;
		elapsed += dt;
		const t = Math.min(elapsed / duration, 1);

		camera.position.lerpVectors(startPos, endPos, t);
		controls.target.lerpVectors(startTarget, endTarget, t);
		controls.update();

		if (t < 1) requestAnimationFrame(animateMove);
	};
	animateMove();
}

function renderShipModules(ship: Spaceship) {
	hudShipModules.innerHTML = '';
	ship.descriptor.modules.forEach(mod => {
		const div = document.createElement('div');
		div.className = 'module-item';
		
		let stats = '';
		if (mod.type === 'engine') stats = `Thrust: ${mod.thrust} | Eff: ${mod.fuelEfficiency}`;
		else if (mod.type === 'reactor') stats = `Power: ${Math.abs(mod.powerDraw)}/s`;
		else if (mod.type === 'habitation') stats = `Crew: +${mod.crewSlots || 0} | Comfort: ${mod.comfort || 0}`;
		else if (mod.type === 'science') stats = `Sci Bonus: x${mod.scienceBonus}`;
		else if (mod.type === 'maintenance') stats = `Repair: ${mod.repairRate}/s`;
		
		div.innerHTML = `
			<div class="module-header">
				<span>${mod.name}</span>
				<span class="module-type">${mod.type}</span>
			</div>
			<div class="module-stats">${stats}</div>
		`;
		hudShipModules.appendChild(div);
	});
}

function updateShipHUD() {
	if (!playerShip) return;
	
	const state = playerShip.descriptor.state;
	const stats = playerShip.descriptor.stats;
	
	// Vitesse (magnitude du vecteur vélocité)
	const speed = Math.sqrt(state.velocity.x**2 + state.velocity.y**2 + state.velocity.z**2);
	hudShipSpeed.textContent = speed.toFixed(0) + ' u/s';
	
	// Carburant
	const fuelPct = Math.max(0, Math.min(100, (state.fuelCurrent / stats.fuelCapacity) * 100));
	hudShipFuelText.textContent = fuelPct.toFixed(0) + '%';
	hudShipFuelBar.style.width = fuelPct + '%';
	hudShipFuelText.style.color = fuelPct < 20 ? '#ff4444' : '#fff';
	
	// Coque
	const hullPct = Math.max(0, Math.min(100, (state.hullCurrent / stats.hullIntegrity) * 100));
	hudShipHullText.textContent = hullPct.toFixed(0) + '%';
	hudShipHullBar.style.width = hullPct + '%';
	hudShipHullText.style.color = hullPct < 50 ? '#ffaa00' : '#fff';
	
	// Bouclier
	const shieldPct = Math.max(0, Math.min(100, (state.shieldCurrent / stats.shieldCapacity) * 100));
	hudShipShieldText.textContent = shieldPct.toFixed(0) + '%';
	hudShipShieldBar.style.width = shieldPct + '%';

	// Équipage
	hudShipCrew.textContent = `${stats.crewCapacity} / ${stats.crewCapacity}`;

	// Cargo
	// On suppose que chaque item a un volume de 1 pour l'instant si pas défini, ou on compte juste le nombre d'items
	// Mais le descriptor a cargo: any[]
	const currentCargo = playerShip.descriptor.cargo.length; // Simplification
	hudShipCargo.textContent = `${currentCargo} / ${stats.cargoVolume}`;
}

