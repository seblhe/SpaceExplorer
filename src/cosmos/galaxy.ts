// src/cosmos/galaxy.ts
import { mulberry32, hashCoord, pick, lerp } from './prng';
import { generateStar } from './star';
import type { GalaxyDescriptor, StarDescriptor } from './types';

export function generateGalaxy({ seed = 1, cell = { x: 0, y: 0, z: 0 }, opts = {} as { sizeMin?: number; sizeMax?: number } }): GalaxyDescriptor {
	//console.log("Galaxy generateGalaxy")
	const combinedSeed = (seed ^ hashCoord(cell)) >>> 0;
	const local = mulberry32(combinedSeed);

	const type: GalaxyDescriptor['type'] = pick(local, ['spiral', 'barred', 'elliptical', 'irregular', 'dwarf']);
	const size = Math.round(lerp(opts.sizeMin ?? 40000, opts.sizeMax ?? 300000, local()));
	const age = Math.round(lerp(2e9, 13.5e9, local()));

	const numSystems = Math.max(10, Math.floor((size / 2000) * lerp(0.1, 0.5, local())));

	const stars: StarDescriptor[] = [];
	const placedStars: { position: { x: number; y: number; z: number }, radius: number }[] = [];

	for (let i = 0; i < numSystems; i++) {
		const sSeed = (Math.floor(local() * 1e9) ^ combinedSeed ^ i) >>> 0;
		const rng = mulberry32(sSeed);
		const star = generateStar({ seed: sSeed, index: i, rng, parentGalaxy: { size, age } });

		// Calcul du rayon visuel du système pour éviter les chevauchements
		// Formule alignée avec PlanetVisualizer et main.ts
		const planets = star.planets || [];
		let systemRadius = 500; // Rayon minimum (étoile seule)
		
		if (planets.length > 0) {
			let maxExtent = 0;
			planets.forEach((planet, pIndex) => {
				// Distance orbitale de la planète
				// Doit être aligné avec PlanetVisualizer
				const starVisualRadius = Math.max(2, (star.size || 1) * 2);
				const minBaseDistance = starVisualRadius * 4 + 100;
				const baseDistance = Math.max(300, minBaseDistance);
				
				const spacingFactor = 1.8;
				const planetOrbitRadius = baseDistance * Math.pow(spacingFactor, pIndex + 1);
				
				// Taille visuelle de la planète
				const planetVisualSize = Math.max((planet.size || 1) * 20, 5);
				
				// Extension due aux lunes
				let maxMoonDist = 0;
				if (planet.moons && planet.moons.length > 0) {
					planet.moons.forEach(moon => {
						// Distance de la lune par rapport à la planète
						// Si moon.distance est défini, on l'utilise, sinon fallback comme dans PlanetVisualizer
						const mDist = moon.distance ?? (planetVisualSize * 2 + 100);
						const mSize = (moon.size || 1); // Taille négligeable mais on peut l'ajouter
						if (mDist + mSize > maxMoonDist) {
							maxMoonDist = mDist + mSize;
						}
					});
				}
				
				// Rayon total pour cette planète = Orbite + (Lune la plus loin OU Taille Planète)
				// On prend le max entre la taille de la planète et l'orbite de la lune la plus lointaine
				const planetInfluenceRadius = Math.max(planetVisualSize, maxMoonDist);
				
				const totalDist = planetOrbitRadius + planetInfluenceRadius;
				if (totalDist > maxExtent) {
					maxExtent = totalDist;
				}
			});
			systemRadius = maxExtent + 200; // Marge de sécurité supplémentaire
		}

		// S'assurer que le rayon couvre au moins la taille visuelle du soleil dans la vue galactique
		// Dans GalaxyLOD, le soleil a une taille 'baseSize' = max(2, size * 2).
		// L'AABB est dessinée avec 'systemRadius * 0.05'.
		// Pour que l'AABB contienne le soleil, il faut systemRadius * 0.05 > baseSize.
		// Donc systemRadius > baseSize * 20.
		// On ajoute une marge de sécurité x1.5 pour les effets de pulsation et glow
		const sunBaseSize = Math.max(2, (star.size || 1) * 2);
		const minRadiusForSun = sunBaseSize * 20 * 1.5;
		if (systemRadius < minRadiusForSun) {
			systemRadius = minRadiusForSun;
		}

		star.systemRadius = systemRadius;

		// Tentative de placement sans chevauchement
		let pos = { x: 0, y: 0, z: 0 };
		let valid = false;
		let attempts = 0;
		const maxAttempts = 200; // Encore plus d'essais

		while (!valid && attempts < maxAttempts) {
			// Distribution aléatoire dans la galaxie
			// On augmente l'espacement vertical pour donner plus de volume et faciliter le placement
			pos = {
				x: (local() - 0.5) * size,
				y: (local() - 0.5) * size * 0.6, 
				z: (local() - 0.5) * size,
			};

			valid = true;
			for (const other of placedStars) {
				const dx = pos.x - other.position.x;
				const dy = pos.y - other.position.y;
				const dz = pos.z - other.position.z;
				
				// Vérification AABB stricte avec une petite marge supplémentaire (1.1)
				const r1 = systemRadius * 1.1;
				const r2 = other.radius * 1.1;
				const minDist = r1 + r2;
				
				if (Math.abs(dx) < minDist && Math.abs(dy) < minDist && Math.abs(dz) < minDist) {
					valid = false;
					break;
				}
			}
			attempts++;
		}

		if (valid) {
			star.position = pos;
			stars.push({
				...star,
				seed: sSeed,
				index: i,
				rng
			});
			placedStars.push({ position: pos, radius: systemRadius });
		} else {
			// Si on ne trouve pas de place, on ignore ce système (réduit la densité mais évite les bugs)
			// console.warn(`Skipped system ${i} due to overlap`);
		}
	}

	// Compter les classes spectrales
	const spectralCount: Record<StarDescriptor['spectralClass'], number> = {
		O: 0, B: 0, A: 0, F: 0, G: 0, K: 0, M: 0
	};
	stars.forEach(st => {
		spectralCount[st.spectralClass]++;
	});

	// Obtenir la dominante
	const dominant = (Object.keys(spectralCount).sort((a, b) => (spectralCount[b as StarDescriptor['spectralClass']] || 0) - (spectralCount[a as StarDescriptor['spectralClass']] || 0))[0] ?? 'G') as StarDescriptor['spectralClass'];

	// Calculer l'AABB de la galaxie (centrée sur l'origine, taille = size)
	const half = size * 0.5;
	const _aabb = {
		min: { x: -half, y: -half, z: -half },
		max: { x: half, y: half, z: half }
	};
	return {
		id: `GAL-${combinedSeed}-${cell.x}-${cell.y}-${cell.z}`,
		seed: combinedSeed,
		type,
		size,
		age,
		numSystems: stars.length,
		stars,
		phenomena: [],
		structures: [],
		dominantSpectral: dominant,
		positionCell: cell,
		_aabb
	};
}
