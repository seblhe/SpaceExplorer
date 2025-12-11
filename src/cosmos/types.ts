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
	kind: 'asteroid' | 'rocky' | 'icy' | 'desert' | 'gaseous' | 'oceanic' | 'forest' | 'lava' | 'ice' | 'mixed' | 'habitable' | 'barren' | 'volcanic';
	radiusKm: number;
	resources: {
		metals: number;
		volatile: number;
	};
}

/** ---------------------
 *  ANNEAUX
 *  -------------------- */
export interface RingDescriptor {
	innerRadius: number; // Multiplicateur du rayon de la planète (ex: 1.2)
	outerRadius: number; // Multiplicateur du rayon de la planète (ex: 2.0)
	type: 'dust' | 'rock' | 'ice';
	color: string;
	opacity: number;
}

/** ---------------------
 *  PLANÈTES
 *  -------------------- */
export interface PlanetDescriptor {
	id: string;
	index: number;
	name: string;
	size: number;                // taille (utilisée pour rendu 3D)
	color?: string;               // couleur visuelle
	distance: number;            // distance moyenne à l’étoile
	orbitSpeed?: number;          // vitesse angulaire orbitale
	orbitPhase?: number;         // phase initiale dans l'orbite (radians)
	orbitEccentricity?: number;  // excentricité (0=cercle, 0.1..0.6=ellipse)
	orbitInclination?: number;   // inclinaison orbitale en degrés
	orbitAscendingNode?: number; // longitude du noeud ascendant (radians)
	selfRotationSpeed?: number;  // vitesse de rotation sur elle-même (rad/s ou unité que tu utilises)
	selfTilt?: number;           // inclinaison de l’axe de rotation (degrés)
	type: 'rocky' | 'gaseous' | 'icy' | 'volcanic' | 'habitable' | 'barren';
	rings?: RingDescriptor[];
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
    structures?: StructureDescriptor[];
    tags?: string[];
}

/** ---------------------
 *  ÉTOILES
 *  -------------------- */
export interface StarDescriptor {
	id: string;
	name: string;
	spectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
	mass: number;                // en masses solaires approximatives
	luminosity: number;          // en luminosités solaires
	numPlanets: number;
	radius: number;
	size: number;                // échelle visuelle
	planets: PlanetDescriptor[];
	position: { x: number; y: number; z: number }; // position dans la galaxie
	systemRadius?: number; // Rayon visuel du système solaire (pour éviter les chevauchements)
    seed?: number;
    index?: number;
    rng?: any;
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
 *  VAISSEAU
 *  -------------------- */
export type ShipType = 'explorer' | 'hauler' | 'fighter' | 'shuttle' | 'mining';

export interface ShipStats {
	// Mouvement
	maxSpeed: number;        // Unités par seconde
	acceleration: number;    // Unités par seconde²
	turnRate: number;        // Radians par seconde (maniabilité)
	jumpRange: number;       // Distance max d'un saut hyperespace

	// Capacités
	cargoVolume: number;     // m³
	cargoWeight: number;     // Tonnes
	crewCapacity: number;    // Nombre de personnes
	
	// Energie & Survie
	fuelCapacity: number;    // Unités de fuel
	fuelConsumption: number; // Unités par seconde en poussée max
	energyStorage: number;   // Batterie pour les systèmes (boucliers, lasers)
	energyRegen: number;     // Recharge par seconde
	
	// Défense
	hullIntegrity: number;   // Points de structure (HP)
	shieldCapacity: number;  // Points de bouclier
	shieldRegen: number;     // Recharge bouclier par seconde
	
	// Exploration
	sensorRange: number;     // Rayon de détection des objets
	scanSpeed: number;       // Vitesse d'analyse des planètes
}

export interface SpaceshipDescriptor {
	id: string;
	name: string;
	type: ShipType;
    designClass: 'atmospheric' | 'industrial'; // Aerodynamique vs Deep Space
	stats: ShipStats;
	
	// État courant
	state: {
		position: { x: number; y: number; z: number };
		rotation: { x: number; y: number; z: number; w: number }; // Quaternion
		velocity: { x: number; y: number; z: number };
		fuelCurrent: number;
		energyCurrent: number;
		hullCurrent: number;
		shieldCurrent: number;
	};

	// Équipement
	modules: ShipModule[];       // Modules installés
	cargo: string[];         // IDs des items en soute
}

/** ---------------------
 *  MODULES DE VAISSEAU
 *  -------------------- */
export interface ShipModule {
	id: string;
	name: string;
	type: 'engine' | 'shield' | 'weapon' | 'scanner' | 'cargo' | 'reactor' | 'habitation' | 'science' | 'maintenance' | 'hyperdrive' | 'stealth' | 'utility' | 'hangar';
	description: string;
	mass: number; // Tonnes
	powerDraw: number; // Consommation d'énergie par seconde (- pour production)
	
	// Propriétés spécifiques aux moteurs
	thrust?: number; // Force de poussée
	fuelEfficiency?: number; // Consommation de fuel par unité de poussée
	maxSpeedBonus?: number;
    jumpEfficiency?: number; // Réduction du coût en fuel des sauts (0.0 - 1.0)

	// Propriétés Habitation & Survie
	crewSlots?: number; // Nombre de lits/places
	comfort?: number;   // Bonus de moral (0-100)
	healthRegen?: number; // Soin par seconde (Infirmerie)

	// Propriétés Science & Maintenance
	scienceBonus?: number; // Multiplicateur de vitesse de scan ou récompense
	repairRate?: number;   // Points de coque réparés par seconde
    automationBonus?: number; // Bonus global d'efficacité (IA)

	// Propriétés Combat & Défense
	shieldBonus?: number; // Points de bouclier max ajoutés
	shieldRegen?: number; // Points de bouclier régénérés par seconde
	weaponDamage?: number; // Dégâts par tir
    stealthFactor?: number; // Réduction de la distance de détection ennemie (0-100%)

	// Propriétés Soute & Minage
	cargoCapacity?: number; // Volume de soute ajouté
	miningSpeed?: number; // Vitesse de minage
    tractorPower?: number; // Force du rayon tracteur

    // Propriétés Hangar
    hangarSlots?: number; // Nombre de vaisseaux stockables

	// Propriétés Capteurs
	sensorRange?: number; // Portée de détection
	scanSpeed?: number; // Vitesse de scan
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
	_aabb?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
}
