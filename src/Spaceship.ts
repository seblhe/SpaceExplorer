import * as THREE from 'three';
import { SpaceshipDescriptor, ShipModule } from './cosmos/types';

export class Spaceship {
	public mesh: THREE.Group;
	public descriptor: SpaceshipDescriptor;
    private rcsPlumes: { [key: string]: THREE.Mesh[] } = {}; // Stocke les flammes RCS
	private speed: number = 0;
	private inputs = {
		forward: false,
		backward: false,
		left: false,
		right: false,
		pitchUp: false,
		pitchDown: false,
		rollLeft: false,
		rollRight: false
	};

	constructor(scene: THREE.Scene, position: THREE.Vector3) {
		this.descriptor = this.createDefaultDescriptor();
		this.recalculateStats(); // Appliquer les bonus des modules initiaux
		this.mesh = this.createMesh();
		this.mesh.position.copy(position);
		scene.add(this.mesh);
		this.setupInputs();
	}

	private recalculateStats() {
		const stats = this.descriptor.stats;
		
        // Reset to base values (chassis stats)
        let totalCrew = 0;
        let totalEnergyRegen = 0;
        let totalCargo = 100;
        let totalShield = 100;
        let totalShieldRegen = 5;
        let totalSensorRange = 8000;
        let totalScanSpeed = 1.0;

		this.descriptor.modules.forEach(mod => {
			if (mod.crewSlots) totalCrew += mod.crewSlots;
			if (mod.type === 'reactor' && mod.powerDraw < 0) {
				totalEnergyRegen += Math.abs(mod.powerDraw);
			}
            if (mod.cargoCapacity) totalCargo += mod.cargoCapacity;
            if (mod.shieldBonus) totalShield += mod.shieldBonus;
            if (mod.shieldRegen) totalShieldRegen += mod.shieldRegen;
            if (mod.sensorRange) totalSensorRange += mod.sensorRange;
            if (mod.scienceBonus) totalScanSpeed += mod.scienceBonus;
		});

		stats.crewCapacity = totalCrew;
		stats.energyRegen = totalEnergyRegen;
        stats.cargoVolume = totalCargo;
        stats.shieldCapacity = totalShield;
        stats.shieldRegen = totalShieldRegen;
        stats.sensorRange = totalSensorRange;
        stats.scanSpeed = totalScanSpeed;
	}

	private setupInputs() {
		window.addEventListener('keydown', (e) => this.onKey(e, true));
		window.addEventListener('keyup', (e) => this.onKey(e, false));
	}

	private onKey(e: KeyboardEvent, pressed: boolean) {
		switch(e.code) {
			// Inversion des axes demandée
			case 'ArrowUp': this.inputs.pitchUp = pressed; break;
			case 'ArrowDown': this.inputs.pitchDown = pressed; break;
			case 'ArrowLeft': this.inputs.right = pressed; break;
			case 'ArrowRight': this.inputs.left = pressed; break;
			
			case 'KeyW': case 'KeyZ': this.inputs.forward = pressed; break;
			case 'KeyS': this.inputs.backward = pressed; break;
			case 'KeyA': case 'KeyQ': this.inputs.rollLeft = pressed; break;
			case 'KeyD': case 'KeyE': this.inputs.rollRight = pressed; break;
		}
	}

	private createDefaultDescriptor(): SpaceshipDescriptor {
		// --- CATALOGUE DES MODULES ---
		
		// 1. ENGINEERING
		const engine: ShipModule = {
			id: 'eng-ion-mk1',
			name: 'Ion Thruster Mk1',
			type: 'engine',
			description: 'Moteur ionique standard. Faible consommation, poussée moyenne.',
			mass: 8,
			powerDraw: 5,
			thrust: 80,
			fuelEfficiency: 0.05
		};

		const reactor: ShipModule = {
			id: 'pwr-fusion-mk1',
			name: 'Fusion Reactor Core',
			type: 'reactor',
			description: 'Générateur à fusion compact. Fournit l\'énergie de base du vaisseau.',
			mass: 15,
			powerDraw: -50, // Produit 50 énergie/s
		};

		// 2. HABITATION & VIE
		const crewQuarters: ShipModule = {
			id: 'hab-bunks-std',
			name: 'Crew Bunks (Standard)',
			type: 'habitation',
			description: 'Quartiers d\'équipage basiques avec lits superposés et rangements personnels.',
			mass: 5,
			powerDraw: 1,
			crewSlots: 4,
			comfort: 10
		};

		const canteen: ShipModule = {
			id: 'hab-canteen',
			name: 'Mess Hall & Kitchen',
			type: 'habitation',
			description: 'Cantine automatisée et espace de détente. Essentiel pour le moral.',
			mass: 4,
			powerDraw: 2,
			comfort: 25
		};

		const gym: ShipModule = {
			id: 'hab-gym',
			name: 'Zero-G Gym',
			type: 'habitation',
			description: 'Salle de sport adaptée à la micro-gravité pour éviter l\'atrophie musculaire.',
			mass: 3,
			powerDraw: 1,
			comfort: 15,
			healthRegen: 0.1 // Maintien en forme
		};

		const medbay: ShipModule = {
			id: 'hab-medbay',
			name: 'Auto-Doc Infirmary',
			type: 'habitation',
			description: 'Unité médicale d\'urgence avec capsule de stase et diagnostic IA.',
			mass: 6,
			powerDraw: 5,
			healthRegen: 2.0
		};

		// 3. SCIENCE
		const scienceLab: ShipModule = {
			id: 'sci-lab-bio',
			name: 'Exobiology Lab',
			type: 'science',
			description: 'Laboratoire équipé pour l\'analyse d\'échantillons organiques et géologiques.',
			mass: 8,
			powerDraw: 8,
			scienceBonus: 1.5
		};

		// 4. MAINTENANCE
		const workshop: ShipModule = {
			id: 'maint-workshop',
			name: 'Drone Workshop',
			type: 'maintenance',
			description: 'Atelier de fabrication de pièces détachées et drones de réparation.',
			mass: 10,
			powerDraw: 4,
			repairRate: 0.5 // Répare lentement la coque
		};

		// 5. DEFENSE
		const shieldGen: ShipModule = {
			id: 'def-shield-mk1',
			name: 'Deflector Shield Mk1',
			type: 'shield',
			description: 'Générateur de bouclier énergétique standard.',
			mass: 12,
			powerDraw: 15,
			shieldBonus: 200,
			shieldRegen: 10
		};

		// 6. CARGO & MINING
		const cargoHold: ShipModule = {
			id: 'cargo-bay-s',
			name: 'Cargo Bay (Small)',
			type: 'cargo',
			description: 'Extension de soute pressurisée.',
			mass: 5,
			powerDraw: 1,
			cargoCapacity: 50
		};

		const miningLaser: ShipModule = {
			id: 'tool-mining-laser',
			name: 'Asteroid Mining Laser',
			type: 'weapon', // Utilisé comme outil
			description: 'Laser industriel pour l\'extraction de minerais sur les astéroïdes.',
			mass: 4,
			powerDraw: 8,
			miningSpeed: 1.0
		};

		// 7. SENSORS
		const scanner: ShipModule = {
			id: 'sensor-lra',
			name: 'Long-Range Sensor Array',
			type: 'scanner',
			description: 'Réseau de capteurs pour la détection longue distance.',
			mass: 3,
			powerDraw: 5,
			sensorRange: 5000,
			scienceBonus: 0.5
		};

		const hydroponics: ShipModule = {
			id: 'hab-hydro',
			name: 'Hydroponics Garden',
			type: 'habitation',
			description: 'Jardin hydroponique pour la production de nourriture fraîche et l\'oxygène.',
			mass: 8,
			powerDraw: 3,
			comfort: 15
		};

        // 8. ADVANCED TECH (SF Classics)
        const hyperdrive: ShipModule = {
            id: 'drv-alcubierre',
            name: 'Alcubierre Warp Drive',
            type: 'hyperdrive',
            description: 'Moteur à distorsion pliant l\'espace-temps pour le voyage supraluminique.',
            mass: 25,
            powerDraw: 100, // Consommation énorme lors de l'activation
            jumpEfficiency: 0.8 // Très efficace
        };

        const aiCore: ShipModule = {
            id: 'ai-hal',
            name: 'H.A.L. 9000 Core',
            type: 'utility',
            description: 'Intelligence Artificielle heuristique. "Je suis désolé Dave, je ne peux pas faire ça."',
            mass: 2,
            powerDraw: 5,
            automationBonus: 0.2, // +20% efficacité globale
            scienceBonus: 1.0
        };

        const cloakingDevice: ShipModule = {
            id: 'stl-romulan',
            name: 'Phasing Cloak Generator',
            type: 'stealth',
            description: 'Dispositif d\'occultation optique et radar.',
            mass: 5,
            powerDraw: 30,
            stealthFactor: 0.9 // 90% invisible
        };

        const tractorBeam: ShipModule = {
            id: 'util-tractor',
            name: 'Graviton Tractor Beam',
            type: 'utility',
            description: 'Projecteur de gravitons pour manipuler des objets à distance.',
            mass: 6,
            powerDraw: 12,
            tractorPower: 500
        };

        const hangarBay: ShipModule = {
            id: 'hangar-small',
            name: 'Small Shuttle Hangar',
            type: 'hangar',
            description: 'Baie d\'amarrage pressurisée pour un vaisseau atmosphérique de classe navette.',
            mass: 20,
            powerDraw: 10,
            hangarSlots: 1
        };

		return {
			id: 'ship-01',
			name: 'Icarus',
			type: 'explorer',
            designClass: 'atmospheric',
			stats: {
				maxSpeed: 50,
				acceleration: 10,
				turnRate: 2.0,
				jumpRange: 10000,
				cargoVolume: 100,
				cargoWeight: 0,
				crewCapacity: 0, // Sera calculé via les modules
				fuelCapacity: 1000,
				fuelConsumption: 0, // Sera calculé via les modules
				energyStorage: 500,
				energyRegen: 0, // Sera calculé via les modules
				hullIntegrity: 200,
				shieldCapacity: 100,
				shieldRegen: 5,
				sensorRange: 8000,
				scanSpeed: 1.0
			},
			state: {
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0, w: 1 },
				velocity: { x: 0, y: 0, z: 0 },
				fuelCurrent: 1000,
				energyCurrent: 500,
				hullCurrent: 200,
				shieldCurrent: 100
			},
			modules: [
				engine, 
				reactor, 
				crewQuarters, 
				canteen, 
				scienceLab,
				workshop,
				shieldGen,
				cargoHold,
				scanner,
				miningLaser,
				hydroponics,
                hyperdrive,
                aiCore,
                tractorBeam,
                hangarBay
			],
			cargo: []
		};
	}

	private createMesh(): THREE.Group {
        let group: THREE.Group;
        if (this.descriptor.designClass === 'industrial') {
            group = this.createIndustrialMesh();
        } else {
            group = this.createAtmosphericMesh();
        }
        // Mise à l'échelle pour que le vaisseau ne soit pas gigantesque par rapport aux planètes
        group.scale.set(0.005, 0.005, 0.005);
        return group;
    }

    private createIndustrialMesh(): THREE.Group {
        const group = new THREE.Group();
        const panelTexture = this.generatePanelTexture();

        // --- SPINE (Structure centrale) ---
        // La longueur dépend un peu du nombre de modules
        const spineLength = 12;
        const spineGeom = new THREE.BoxGeometry(1.5, 1.5, spineLength);
        const spineMat = new THREE.MeshStandardMaterial({
            color: 0x404040,
            roughness: 0.8,
            metalness: 0.5,
            bumpMap: panelTexture,
            bumpScale: 0.1
        });
        const spine = new THREE.Mesh(spineGeom, spineMat);
        spine.position.z = 0;
        spine.castShadow = true;
        spine.receiveShadow = true;
        group.add(spine);

        // --- COCKPIT (Front - Industriel) ---
        // Une sphère de verre ou un polygone facetté
        const cockpitGeom = new THREE.IcosahedronGeometry(1.8, 0);
        const cockpitMat = new THREE.MeshPhysicalMaterial({
            color: 0xffaa00, // Verre ambré/doré
            transmission: 0.3,
            opacity: 0.95,
            transparent: true,
            roughness: 0.2,
            metalness: 0.8,
            clearcoat: 1.0
        });
        const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
        cockpit.position.z = -spineLength / 2 - 1.5;
        group.add(cockpit);

        // --- ENGINES (Back - Massif) ---
        const engineBlockGeom = new THREE.BoxGeometry(3, 3, 2);
        const engineBlockMat = new THREE.MeshStandardMaterial({ color: 0x333333, bumpMap: panelTexture });
        const engineBlock = new THREE.Mesh(engineBlockGeom, engineBlockMat);
        engineBlock.position.z = spineLength / 2 + 1;
        group.add(engineBlock);

        // Propulseurs principaux (Gros et brutaux)
        const thrusterGeom = new THREE.CylinderGeometry(1.2, 0.8, 2, 16);
        thrusterGeom.rotateX(-Math.PI / 2);
        const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xff3300 }); // Orange/Rouge
        
        const t1 = new THREE.Mesh(thrusterGeom, thrusterMat);
        t1.position.set(1.2, 0, spineLength / 2 + 2);
        group.add(t1);
        
        const t2 = new THREE.Mesh(thrusterGeom, thrusterMat);
        t2.position.set(-1.2, 0, spineLength / 2 + 2);
        group.add(t2);

        // --- MODULES (Placement procédural le long de la structure) ---
        let currentZ = -spineLength / 2 + 2;
        
        this.descriptor.modules.forEach((mod, index) => {
            // On ignore les moteurs et réacteurs qui sont "intégrés" à la structure arrière
            if (mod.type === 'engine' || mod.type === 'reactor' || mod.type === 'hyperdrive') return;

            const modGroup = new THREE.Group();
            
            // Représentation visuelle selon le type
            let geom: THREE.BufferGeometry;
            let mat: THREE.Material;
            
            if (mod.type === 'cargo') {
                // Conteneurs rectangulaires
                geom = new THREE.BoxGeometry(1.8, 1.8, 2.5);
                mat = new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.9, bumpMap: panelTexture }); 
            } else if (mod.type === 'habitation') {
                // Modules cylindriques rotatifs (visuellement)
                geom = new THREE.CylinderGeometry(1.5, 1.5, 2, 16);
                geom.rotateZ(Math.PI / 2); 
                mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.2 }); 
            } else if (mod.type === 'shield' || mod.type === 'scanner') {
                // Antennes / Dômes
                geom = new THREE.SphereGeometry(1, 8, 8);
                mat = new THREE.MeshStandardMaterial({ color: 0x5555ff, wireframe: true });
            } else if (mod.type === 'weapon' || mod.type === 'utility') {
                // Tourelles / Bras
                geom = new THREE.CylinderGeometry(0.2, 0.5, 2);
                geom.rotateX(Math.PI / 4);
                mat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            } else if (mod.type === 'hangar') {
                // Hangar Bay (Plateforme d'atterrissage)
                geom = new THREE.BoxGeometry(2.5, 0.5, 4);
                mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6, bumpMap: panelTexture });
            } else {
                // Générique
                geom = new THREE.BoxGeometry(1, 1, 1);
                mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
            }

            const mesh = new THREE.Mesh(geom, mat);
            modGroup.add(mesh);

            // Visualisation spécifique pour le hangar : un petit vaisseau garé
            if (mod.type === 'hangar') {
                 const tinyShipGroup = new THREE.Group();
                 
                 // Mini fuselage
                 const body = new THREE.Mesh(
                    new THREE.ConeGeometry(0.3, 1.2, 8),
                    new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.8, roughness: 0.2 })
                 );
                 body.rotation.x = -Math.PI / 2;
                 tinyShipGroup.add(body);
                 
                 // Mini ailes
                 const wings = new THREE.Mesh(
                    new THREE.BoxGeometry(1.2, 0.05, 0.4),
                    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5 })
                 );
                 wings.position.z = 0.2;
                 tinyShipGroup.add(wings);

                 tinyShipGroup.position.y = 0.5; // Posé sur la plateforme
                 modGroup.add(tinyShipGroup);
            }

            // Placement alterné gauche/droite
            const side = index % 2 === 0 ? 1 : -1;
            // Un peu de variation verticale aussi
            const heightVar = (index % 3 === 0) ? 1.5 : 0;
            
            modGroup.position.set(side * 2.0, heightVar, currentZ);
            
            // Connecteur vers la structure centrale
            const connectorGeom = new THREE.CylinderGeometry(0.3, 0.3, 2);
            connectorGeom.rotateZ(Math.PI / 2);
            const connector = new THREE.Mesh(connectorGeom, spineMat);
            connector.position.set(-side * 1.0, -heightVar, 0); // Relatif au groupe
            modGroup.add(connector);

            group.add(modGroup);

            // On avance le long de la structure
            if (index % 2 !== 0) currentZ += 3.0; 
        });

        return group;
    }

	private createAtmosphericMesh(): THREE.Group {
		const group = new THREE.Group();
        const panelTexture = this.generatePanelTexture();

        // --- MATERIAUX ---
        const hullMat = new THREE.MeshStandardMaterial({ 
            color: 0xeeeeee, 
            roughness: 0.4, 
            metalness: 0.6,
            bumpMap: panelTexture,
            bumpScale: 0.02,
            roughnessMap: panelTexture
        });

        const darkMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            roughness: 0.6, 
            metalness: 0.8,
            bumpMap: panelTexture,
            bumpScale: 0.05
        });

        const glassMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x111111, 
            roughness: 0.05, 
            metalness: 0.9,
            transmission: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const engineGlowMat = new THREE.MeshBasicMaterial({ color: 0x00aaff });

        // --- FUSELAGE (Nez + Corps) ---
        // Nez pointu (Pointe vers -Z)
        const noseGeom = new THREE.ConeGeometry(0.8, 4, 32);
        noseGeom.rotateX(-Math.PI / 2); // Pointe vers -Z
        const nose = new THREE.Mesh(noseGeom, hullMat);
        nose.position.z = -2.9; // Chevauchement léger avec le corps pour éviter le Z-fighting
        nose.castShadow = true;
        nose.receiveShadow = true;
        group.add(nose);

        // Corps central
        const bodyGeom = new THREE.CylinderGeometry(0.8, 1.2, 3, 32);
        bodyGeom.rotateX(-Math.PI / 2); // Oriente vers -Z
        const body = new THREE.Mesh(bodyGeom, hullMat);
        body.position.z = 0.5;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Arrière (Bloc moteur)
        const rearGeom = new THREE.BoxGeometry(2, 1.5, 2);
        const rear = new THREE.Mesh(rearGeom, darkMat);
        rear.position.z = 2.9; // Chevauchement léger
        rear.castShadow = true;
        rear.receiveShadow = true;
        group.add(rear);

        // --- COCKPIT ---
        // Forme plus profilée
        const cockpitGeom = new THREE.BoxGeometry(1, 0.8, 2.5);
        const cockpit = new THREE.Mesh(cockpitGeom, glassMat);
        cockpit.position.set(0, 0.8, -0.5);
        group.add(cockpit);

        // --- AILES (Forme Delta) ---
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(4, -2); // Pointe extérieure arrière
        wingShape.lineTo(4, -1); // Pointe extérieure avant
        wingShape.lineTo(0, 2);  // Racine avant
        
        const wingExtrudeSettings = {
            steps: 1,
            depth: 0.2,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 2
        };
        
        const wingGeom = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
        // L'extrusion se fait en Z.
        // On veut que l'aile aille vers l'arrière (+Z).
        // Shape (0,0) -> (4, -2). Rotate -90 X -> (4, 2Z).
        wingGeom.rotateX(-Math.PI / 2); 
        
        // Aile Droite (Extend vers +X)
        const rWing = new THREE.Mesh(wingGeom, hullMat);
        rWing.position.set(0.8, -0.5, 0); // Attaché au fuselage
        rWing.rotation.z = -0.1; // Léger dièdre négatif
        rWing.castShadow = true;
        rWing.receiveShadow = true;
        group.add(rWing);

        // Aile Gauche (Miroir vers -X)
        const lWing = rWing.clone();
        lWing.position.set(-0.8, -0.5, 0);
        lWing.scale.set(-1, 1, 1); // Miroir X
        lWing.rotation.z = 0.1; // Tip down (inversé car scale -1)
        group.add(lWing);

        // --- MOTEURS ---
        const engineGeom = new THREE.CylinderGeometry(0.5, 0.7, 2.5, 16);
        engineGeom.rotateX(-Math.PI / 2);
        
        const lEngine = new THREE.Mesh(engineGeom, darkMat);
        lEngine.position.set(1.5, 0, 2.5);
        group.add(lEngine);

        const rEngine = new THREE.Mesh(engineGeom, darkMat);
        rEngine.position.set(-1.5, 0, 2.5);
        group.add(rEngine);

        // Glow (Pointe vers +Z)
        const glowGeom = new THREE.ConeGeometry(0.4, 0.5, 16);
        glowGeom.rotateX(-Math.PI / 2); // Pointe vers +Z
        
        const lGlow = new THREE.Mesh(glowGeom, engineGlowMat);
        lGlow.position.set(1.5, 0, 3.8);
        group.add(lGlow);

        const rGlow = new THREE.Mesh(glowGeom, engineGlowMat);
        rGlow.position.set(-1.5, 0, 3.8);
        group.add(rGlow);

        // Lumières des propulseurs
        const lLight = new THREE.PointLight(0x00aaff, 2, 1);
        lLight.position.copy(lGlow.position);
        group.add(lLight);

        const rLight = new THREE.PointLight(0x00aaff, 2, 1);
        rLight.position.copy(rGlow.position);
        group.add(rLight);

        // --- DÉTAILS (Canons, Ailerons) ---
        const finGeom = new THREE.BoxGeometry(0.1, 1.5, 1.5);
        const lFin = new THREE.Mesh(finGeom, hullMat);
        lFin.position.set(1.5, 1, 2.5);
        lFin.rotation.z = 0.2;
        group.add(lFin);

        const rFin = new THREE.Mesh(finGeom, hullMat);
        rFin.position.set(-1.5, 1, 2.5);
        rFin.rotation.z = -0.2;
        group.add(rFin);

        // --- RCS THRUSTERS (Manoeuvre) ---
        this.rcsPlumes = {
            pitchUp: [],
            pitchDown: [],
            yawLeft: [],
            yawRight: [],
            rollLeft: [],
            rollRight: []
        };

        const rcsGeom = new THREE.ConeGeometry(0.1, 0.4, 8);
        rcsGeom.translate(0, 0.2, 0); // Pivot à la base
        rcsGeom.rotateX(Math.PI / 2); // Pointe vers +Z par défaut
        const rcsMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });

        const addRCS = (pos: THREE.Vector3, dir: THREE.Vector3, type: string) => {
            // Nozzle (visuel)
            const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.1), darkMat);
            nozzle.position.copy(pos);
            nozzle.lookAt(pos.clone().add(dir));
            nozzle.rotateX(Math.PI / 2);
            group.add(nozzle);

            // Plume (flamme)
            const plume = new THREE.Mesh(rcsGeom, rcsMat);
            plume.position.copy(pos);
            plume.lookAt(pos.clone().add(dir));
            plume.scale.set(0, 0, 0); // Invisible au départ
            group.add(plume);
            
            if (this.rcsPlumes[type]) {
                this.rcsPlumes[type].push(plume);
            }
        };

        // Configuration des RCS pour le modèle Atmosphérique (Forward = -Z)
        
        // Pitch UP (Nez monte) -> Force vers le HAUT à l'avant -> Gaz vers le BAS
        addRCS(new THREE.Vector3(0, -0.5, -2.5), new THREE.Vector3(0, -1, 0), 'pitchUp');
        
        // Pitch DOWN (Nez descend) -> Force vers le BAS à l'avant -> Gaz vers le HAUT
        addRCS(new THREE.Vector3(0, 0.5, -2.5), new THREE.Vector3(0, 1, 0), 'pitchDown');

        // Yaw LEFT (Nez gauche) -> Force vers la GAUCHE (-X) -> Gaz vers la DROITE (+X)
        addRCS(new THREE.Vector3(0.4, 0, -2.8), new THREE.Vector3(1, 0, 0), 'yawLeft');

        // Yaw RIGHT (Nez droite) -> Force vers la DROITE (+X) -> Gaz vers la GAUCHE (-X)
        addRCS(new THREE.Vector3(-0.4, 0, -2.8), new THREE.Vector3(-1, 0, 0), 'yawRight');

        // Roll LEFT (Aile gauche descend, droite monte)
        // Aile gauche (-X): Force vers le BAS -> Gaz vers le HAUT
        addRCS(new THREE.Vector3(-3.5, 0, 0), new THREE.Vector3(0, 1, 0), 'rollLeft');
        // Aile droite (+X): Force vers le HAUT -> Gaz vers le BAS
        addRCS(new THREE.Vector3(3.5, 0, 0), new THREE.Vector3(0, -1, 0), 'rollLeft');

        // Roll RIGHT (Aile gauche monte, droite descend)
        // Aile gauche (-X): Force vers le HAUT -> Gaz vers le BAS
        addRCS(new THREE.Vector3(-3.5, 0, 0), new THREE.Vector3(0, -1, 0), 'rollRight');
        // Aile droite (+X): Force vers le BAS -> Gaz vers le HAUT
        addRCS(new THREE.Vector3(3.5, 0, 0), new THREE.Vector3(0, 1, 0), 'rollRight');

		return group;
	}

	private generatePanelTexture(): THREE.Texture {
		const size = 512;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) return new THREE.Texture();

		// Fond gris moyen
		ctx.fillStyle = '#808080';
		ctx.fillRect(0, 0, size, size);

		// Bruit pour le grain du métal
		for (let i = 0; i < 10000; i++) {
			const v = Math.floor(Math.random() * 40) - 20; // -20 à +20
			const c = 128 + v;
			ctx.fillStyle = `rgb(${c},${c},${c})`;
			ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
		}

		// Lignes de panneaux (Panels)
		ctx.strokeStyle = '#404040';
		ctx.lineWidth = 3;
		ctx.beginPath();
		for (let i = 0; i < 10; i++) {
			const x = Math.random() * size;
			const y = Math.random() * size;
			const w = 50 + Math.random() * 100;
			const h = 50 + Math.random() * 100;
			ctx.strokeRect(x, y, w, h);
			
			// Quelques détails techniques (trappes, rivets)
			ctx.fillStyle = '#606060';
			ctx.fillRect(x + 5, y + 5, 10, 10);
			ctx.fillRect(x + w - 15, y + h - 15, 10, 10);
		}
		ctx.stroke();

		const texture = new THREE.CanvasTexture(canvas);
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		return texture;
	}

	public update(dt: number) {
		const stats = this.descriptor.stats;
		const state = this.descriptor.state;
		
		// Rotation
		const pitchSpeed = stats.turnRate * dt;
		const yawSpeed = stats.turnRate * dt;
		const rollSpeed = stats.turnRate * 1.5 * dt;

		// Note: rotateX/Y/Z apply rotations in local space
		if (this.inputs.pitchUp) this.mesh.rotateX(pitchSpeed);
		if (this.inputs.pitchDown) this.mesh.rotateX(-pitchSpeed);
		if (this.inputs.left) this.mesh.rotateY(-yawSpeed);
		if (this.inputs.right) this.mesh.rotateY(yawSpeed);
		if (this.inputs.rollLeft) this.mesh.rotateZ(rollSpeed);
		if (this.inputs.rollRight) this.mesh.rotateZ(-rollSpeed);

        // Animation des RCS
        const updateRCS = (type: string, active: boolean) => {
            if (this.rcsPlumes[type]) {
                this.rcsPlumes[type].forEach(plume => {
                    if (active) {
                        // Scale up avec un peu de jitter aléatoire pour l'effet de flamme
                        const jitter = 0.8 + Math.random() * 0.4;
                        plume.scale.set(jitter, jitter, jitter);
                    } else {
                        plume.scale.set(0, 0, 0);
                    }
                });
            }
        };

        updateRCS('pitchUp', this.inputs.pitchUp);
        updateRCS('pitchDown', this.inputs.pitchDown);
        updateRCS('yawLeft', this.inputs.left); // Note: input.left is Yaw Left
        updateRCS('yawRight', this.inputs.right);
        updateRCS('rollLeft', this.inputs.rollLeft);
        updateRCS('rollRight', this.inputs.rollRight);

		// Calcul de la consommation de fuel
		// On regarde si on a des moteurs
		const engines = this.descriptor.modules.filter(m => m.type === 'engine');
		let totalThrust = 0;
		let totalFuelConsumption = 0;
		
		if (engines.length > 0) {
			engines.forEach(eng => {
				totalThrust += eng.thrust || 0;
				// Consommation de base * efficacité
				// Si on accélère, on consomme
				if (this.inputs.forward || this.inputs.backward) {
					totalFuelConsumption += (eng.powerDraw || 0) * (eng.fuelEfficiency || 1);
				}
			});
		} else {
			// Fallback si pas de module (stats de base)
			if (this.inputs.forward || this.inputs.backward) {
				totalFuelConsumption = stats.fuelConsumption;
			}
		}

		// Acceleration
		if (state.fuelCurrent > 0) {
			if (this.inputs.forward) {
				this.speed += stats.acceleration * dt;
				state.fuelCurrent -= totalFuelConsumption * dt;
			} else if (this.inputs.backward) {
				this.speed -= stats.acceleration * dt;
				state.fuelCurrent -= totalFuelConsumption * dt;
			} else {
				// Drag (ralentissement naturel)
				this.speed *= 0.98;
			}
		} else {
			// Plus de fuel : on ne peut plus accélérer, juste ralentir
			this.speed *= 0.98;
			if (this.inputs.forward || this.inputs.backward) {
				console.warn("Out of fuel!");
			}
		}
		
		// Clamp fuel
		state.fuelCurrent = Math.max(0, state.fuelCurrent);
		
		// Clamp speed
		this.speed = Math.max(-stats.maxSpeed / 2, Math.min(stats.maxSpeed, this.speed));

		// Apply velocity
		// Forward is -Z in local space
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
		const velocity = forward.multiplyScalar(this.speed);
		
		this.mesh.position.add(velocity.multiplyScalar(dt));
		
		// Mise à jour de l'état
		this.descriptor.state.position.x = this.mesh.position.x;
		this.descriptor.state.position.y = this.mesh.position.y;
		this.descriptor.state.position.z = this.mesh.position.z;
		this.descriptor.state.velocity = { x: velocity.x, y: velocity.y, z: velocity.z };
	}
}
