// src/cosmos/planet.ts
import { mulberry32, pick, lerp } from './prng';
import type { RNG } from './prng';
import type { PlanetDescriptor } from './types';
import { generateMoon } from './moon';

interface GeneratePlanetOpts {
	seed: number;
	index?: number;
	rng?: RNG;
	hostStar?: { spectralClass?: string; starMass?: number; luminosity?: number };
}

export function generatePlanet({
	seed,
	index = 0,
	rng = Math.random as unknown as RNG,
	hostStar = {}
}: GeneratePlanetOpts): PlanetDescriptor {

	//console.log("Planete generatePlanet")
	const local = mulberry32((seed >>> 0) + index * 911);

	// ---- Type de planète ----
	const possibleTypes: PlanetDescriptor['type'][] = [
		'rocky', 'gaseous', 'icy', 'volcanic', 'habitable', 'barren'
	];
	let type = pick(local, possibleTypes);

	// Influence du type stellaire sur le type de planète
	if (hostStar.spectralClass && ['G', 'K', 'M'].includes(hostStar.spectralClass) && local() > 0.6)
		type = 'habitable';

	// ---- Caractéristiques physiques ----
	const radiusKm = Math.round(
		lerp(type === 'gaseous' ? 25000 : 1500, type === 'gaseous' ? 70000 : 12000, local())
	);
	const gravityG = Math.max(0.05, (radiusKm / 6371) * lerp(0.4, 2.0, local()));

	// ---- Atmosphère ----
	const atmosChance = local();
	const atmosphere: PlanetDescriptor['atmosphere'] =
		type === 'habitable'
			? pick(local, ['thin', 'breathable', 'dense'])
			: atmosChance > 0.85
				? pick(local, ['thin', 'toxic', 'thin'])
				: 'none';

	// ---- Ressources ----
	const resources = {
		metals: Math.round(local() * 100),
		gas: Math.round(local() * (type === 'gaseous' ? 500 : 60)),
		exotic: Math.round(local() * (type === 'volcanic' ? 40 : 8))
	};

	// ---- Habitabilité ----
	const habitability = (() => {
		let score = 0;
		if (type === 'habitable') score += 0.6;
		if (atmosphere === 'breathable') score += 0.25;
		if (hostStar.spectralClass === 'G') score += 0.1;
		if (hostStar.spectralClass === 'M') score += 0.02;
		return Math.min(1, Number(score.toFixed(2)));
	})();

	// ---- Lunes ----
	const numMoons = Math.max(0, Math.floor(local() * (type === 'gaseous' ? 10 : 4)));
	const moons:any = [];
	//TODO : remoce comments for moons
	/*for (let m = 0; m < numMoons; m++) {
		const mSeed = (Math.floor(local() * 1e9) ^ (seed + m * 13)) >>> 0;
		moons.push(generateMoon({ seed: mSeed, index: m, rng: mulberry32(mSeed) }));
	}*/

	// ---- Caractéristiques orbitales ----
	const distance = lerp(
		type === 'habitable' ? 100 : 30,
		type === 'gaseous' ? 800 : 400,
		local()
	); // distance moyenne
	const orbitSpeed = lerp(0.00002, 0.00012, local());
	const orbitPhase = local() * Math.PI * 2;
	const orbitEccentricity = lerp(0.0, 0.4, local());
	const orbitInclination = lerp(0, Math.PI / 8, local());

	// ---- Rotation ----
	const selfRotationSpeed = lerp(0.0005, 0.01, local());
	const selfTilt = lerp(0, Math.PI / 5, local());

	// ---- Température ----
	const temperature = (() => {
		const base = 5800; // Soleil type G
		const starTempFactor =
			hostStar.spectralClass === 'M'
				? 0.5
				: hostStar.spectralClass === 'K'
					? 0.8
					: hostStar.spectralClass === 'F'
						? 1.2
						: 1;
		const distFactor = 1 / Math.sqrt(distance / 100);
		return Math.round(base * starTempFactor * distFactor * lerp(0.7, 1.3, local()));
	})();

	// ---- Apparence ----
	const colorMap: Record<PlanetDescriptor['type'], string> = {
		rocky: '#a0704b',
		gaseous: '#d6c682',
		icy: '#c9e8ff',
		volcanic: '#ff6b3d',
		habitable: '#4fa05f',
		barren: '#888888'
	};
	const color = colorMap[type] ?? '#aaaaaa';

	const biomeCandidates = {
		rocky: ['mountain', 'desert', 'canyon'],
		gaseous: ['storm', 'bands', 'clouds'],
		icy: ['ice', 'snow', 'glacier'],
		volcanic: ['lava', 'ash', 'basalt'],
		habitable: ['forest', 'oceanic', 'continental'],
		barren: ['dust', 'cratered', 'wasteland']
	};
	const biome = pick(local, biomeCandidates[type]);

	// ---- Structures et tags ----
	const structures =
		habitability > 0.5 && local() > 0.8
			? [{ id: `struct-${seed}`, type: 'station', techLevel: 3, intactness: 0.8, potential: 0.9, loot: ['data_core', 'fuel'] }]
			: [];
	const tags: string[] = [];
	if (habitability > 0.7) tags.push('terraformable');
	if (type === 'volcanic') tags.push('unstable');
	if (local() > 0.9) tags.push('ancient');

	return {
		id: `PL-${seed}-${index}`,
		name: `Planet-${index + 1}`,
		size: Math.max(0.5, radiusKm / 8000),
		color,
		type,
		radiusKm,
		gravityG: Number(gravityG.toFixed(2)),
		atmosphere,
		resources,
		habitability,
		moons,
		distance,
		orbitSpeed,
		orbitPhase,
		orbitEccentricity,
		orbitInclination,
		selfRotationSpeed,
		selfTilt,
		temperature,
		biome,
		structures,
		tags
	} as PlanetDescriptor;
}
