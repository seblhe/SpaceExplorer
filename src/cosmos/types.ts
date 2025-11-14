// src/cosmos/types.ts

import * as THREE from 'three'

/** ---------------------
 *  SOLAR SYSTEM
 *  -------------------- */
export interface SolarSystemDescriptor {
	id: string;
	name: string;
	star: StarDescriptor;
	planets: PlanetDescriptor[];
}

/** ---------------------
 *  LUNES
 *  -------------------- */
export interface MoonDescriptor {
	id: string;
	size: number;                // taille (utilisée pour rendu 3D)
	distance: number;            // distance moyenne à l’étoile
	color?: string;               // couleur visuelle
	orbitSpeed?: number;          // vitesse angulaire orbitale
	orbitPhase?: number;         // phase initiale dans l'orbite (radians)
	kind: 'asteroid' | 'rocky' | 'icy' | 'small';
	radiusKm: number;
	resources: {
		metals: number;
		volatile: number;
	};
}

/** ---------------------
 *  PLANÈTES
 *  -------------------- */
export interface PlanetDescriptor {
	id: string;
	name: string;
	size: number;                // taille (utilisée pour rendu 3D)
	color?: string;               // couleur visuelle
	distance: number;            // distance moyenne à l’étoile
	orbitSpeed?: number;          // vitesse angulaire orbitale
	orbitPhase?: number;         // phase initiale dans l'orbite (radians)
	orbitEccentricity?: number;  // excentricité (0=cercle, 0.1..0.6=ellipse)
	orbitInclination?: number;   // inclinaison orbitale en degrés
	selfRotationSpeed?: number;  // vitesse de rotation sur elle-même (rad/s ou unité que tu utilises)
	selfTilt?: number;           // inclinaison de l’axe de rotation (degrés)
	type: 'rocky' | 'gaseous' | 'icy' | 'volcanic' | 'habitable' | 'barren';
	radiusKm?: number;
	gravityG?: number;
	atmosphere?: 'none' | 'thin' | 'breathable' | 'toxic' | 'dense';
	biome?: 'desert' | 'oceanic' | 'forest' | 'ice' | 'lava' | 'mixed';
	resources?: {
		metals: number;
		gas: number;
		exotic: number;
	};
	temperature?: number;
	habitability?: number;
	moons: MoonDescriptor[];
}

/** ---------------------
 *  ÉTOILES
 *  -------------------- */
export interface StarDescriptor {
	id: string;
	spectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
	mass: number;                // en masses solaires approximatives
	luminosity: number;          // en luminosités solaires
	numPlanets: number;
	radius: number;
	size: number;                // échelle visuelle
	planets: PlanetDescriptor[];
	position: { x: number; y: number; z: number }; // position dans la galaxie
}

/** ---------------------
 *  ÉVENEMENT SOLAIRE
 *  -------------------- */
export type SolarEventVisual = THREE.Mesh | THREE.Points | THREE.Line;
export interface SolarEvent {
	type: 'loop' | 'jet' | 'shockwave';
	mesh: SolarEventVisual; // <- spécifier Mesh ici
	duration: number;
	elapsed: number;
	position: THREE.Vector3;
	scale: number;
}


/** ---------------------
 *  PHÉNOMÈNES COSMIQUES
 *  -------------------- */
export interface PhenomenonDescriptor {
	id: string;
	type: 'nebula' | 'black_hole' | 'pulsar' | 'anomaly' | 'supernova_remnant' | 'gravitational_lens';
	intensity: number;  // 0..1
	radiusLy: number;
	effects: Record<string, any>;
}

/** ---------------------
 *  STRUCTURES (stations, ruines, etc.)
 *  -------------------- */
export interface StructureDescriptor {
	id: string;
	type: 'station' | 'ruins' | 'beacon' | 'derelict' | 'mining_outpost' | 'research_facility';
	techLevel: number;     // 0..10
	intactness: number;    // 0..1
	potential: number;     // niveau d’intérêt
	loot: string[];
}

/** ---------------------
 *  GALAXIE
 *  -------------------- */
export interface GalaxyDescriptor {
	id: string;
	seed: number;
	type: 'spiral' | 'barred' | 'elliptical' | 'irregular' | 'dwarf';
	size: number;           // en années-lumière
	age: number;            // en années
	numSystems: number;
	stars: StarDescriptor[];
	phenomena: PhenomenonDescriptor[];
	structures: StructureDescriptor[];
	dominantSpectral: StarDescriptor['spectralClass'];
	positionCell: { x: number; y: number; z: number };
}
