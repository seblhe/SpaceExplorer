import * as THREE from 'three';
import type { PlanetDescriptor } from './types';

export interface PlanetVisualizerOptions {
	showOrbits?: boolean;
	starPosition?: THREE.Vector3;
	starSize?: number; // Taille de l'étoile pour ajuster la distance
	shadowDarkness?: number; // 0 = pas d'ombre, 1 = très sombre
	scale?: number;
}

export class PlanetVisualizer {
	public group: THREE.Group;
	public planets: {
		mesh: THREE.Object3D;
		planetSphere: THREE.Mesh;
		descriptor: PlanetDescriptor;
		orbitLine: THREE.Line;
		moonOrbitLines: THREE.Line[];
		moons: THREE.Mesh[];
	}[] = [];
	private starSize: number;

	constructor(planetsData: PlanetDescriptor[], scene: THREE.Scene, opts: PlanetVisualizerOptions = {}) {
		this.group = new THREE.Group();
		this.group.position.copy(opts.starPosition ?? new THREE.Vector3(0, 0, 0));
		this.starSize = opts.starSize ?? 1;
		if (opts.scale) {
			this.group.scale.setScalar(opts.scale);
		}
		scene.add(this.group);

		// Ajoute une lumière ambiante pour simuler l'ombre côté opposé au soleil
		const shadowDarkness = opts.shadowDarkness ?? 0.1; // 0.3 = côté sombre à 30% de la lumière
		const ambient = new THREE.AmbientLight(0xffffff, shadowDarkness);
		this.group.add(ambient);

		planetsData.forEach((p, i) => {
			const planetWithIndex = { ...p, index: i }; // ← injecte l'index

			const planet = this.createPlanetMesh(planetWithIndex);
			this.group.add(planet.mesh);
			this.group.add(planet.orbitLine);
			planet.moons.forEach(m => this.group.add(m));

			this.planets.push(planet);
			if (opts.showOrbits) {
				planet.orbitLine.visible = true;
				planet.moonOrbitLines.forEach(l => l.visible = true);
			}
		});
	}

	private createPlanetMesh(p: PlanetDescriptor) {
		// Augmenter la taille visuelle des planètes pour qu'elles soient bien visibles
		const radiusScale = Math.max(p.size * 20, 5); 
		const spacingFactor = 1.8;
		
			// Calculer la distance de base en fonction de la taille de l'étoile
			// Le rayon visuel de l'étoile est starSize * 2 (voir StarVisualizerCinematic)
			// On veut que la première planète soit au moins à 3x le rayon de l'étoile + une marge
			const starVisualRadius = Math.max(2, this.starSize * 2);
			const minBaseDistance = starVisualRadius * 4 + 100;
			const baseDistance = Math.max(300, minBaseDistance);		const distance = baseDistance * Math.pow(spacingFactor, (p.index ?? 0) + 1);
		const angle = p.orbitPhase ?? 0;
		const ex = p.orbitEccentricity ?? 0;
		const incl = p.orbitInclination ?? 0;

		// Crée la courbe d’orbite centrée sur le soleil
		const a = distance;
		const b = distance * (1 - ex);
		// Centre géométrique (le soleil) : (0,0)
		const orbitCurve = new THREE.EllipseCurve(
			0, 0, // centre sur le soleil
			a,
			b,
			0, Math.PI * 2,
			false,
			0
		);

		// Création de la planète
		const textureLoader = new THREE.TextureLoader();
		const texturePath = '/textures/planet/' + p.type + '_planet.png';
		const texture = textureLoader.load(texturePath, undefined, undefined, (err) => {
			console.error("Error loading planet texture", texturePath, err);
		});
		const geom = new THREE.SphereGeometry(radiusScale, 32, 32);

		// ShaderMaterial avec effet jour/nuit
		const sunPosition = this.group.position.clone(); // centre du système = soleil
		const shadowDarkness = (this as any).shadowDarkness ?? 0.3;
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				sunPos: { value: sunPosition },
				texture1: { value: texture },
				shadowDarkness: { value: 0.15 } // côté opposé quasi noir
			},
			vertexShader: `
				varying vec3 vWorldPosition;
				varying vec3 vNormal;
				varying vec2 vUv;
				void main() {
					vUv = uv;
					vNormal = normalize(mat3(modelMatrix) * normal);
					vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D texture1;
				uniform vec3 sunPos;
				uniform float shadowDarkness;
				varying vec3 vWorldPosition;
				varying vec3 vNormal;
				varying vec2 vUv;
				void main() {
					vec3 toSun = normalize(sunPos - vWorldPosition);
					float intensity = max(dot(normalize(vNormal), toSun), 0.0);
					float shade = shadowDarkness + (1.0 - shadowDarkness) * intensity;
					vec4 texColor = texture2D(texture1, vUv);
					gl_FragColor = vec4(texColor.rgb * shade, texColor.a);
				}
			`,
		});
		const mesh = new THREE.Mesh(geom, mat);
		mesh.position.set(0, 0, 0);
		mesh.receiveShadow = true;

		// Ligne d’orbite inclinée
		const orbitPoints = orbitCurve.getPoints(120).map(pt => {
			const px = pt.x;
			const pz = pt.y;
			const py = Math.sin(incl) * pz * 0.1; // inclinaison réelle
			return new THREE.Vector3(px, py, pz);
		});
		const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
		const orbitMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, opacity: 0.6, transparent: true });
		const orbitLine = new THREE.LineLoop(orbitGeom, orbitMat);
		orbitLine.visible = false;

		// Groupe de translation
		const translationGroup = new THREE.Group();
		translationGroup.add(mesh);

		// Orbites des lunes
		const moonOrbitLines: THREE.Line[] = [];
		(p.moons ?? []).forEach(moon => {
			const mDistance = moon.distance ?? (radiusScale * 2 + 100);
			const mCurve = new THREE.EllipseCurve(0, 0, mDistance, mDistance, 0, Math.PI * 2, false, 0);
			const mPoints = mCurve.getPoints(64).map(pt => new THREE.Vector3(pt.x, 0, pt.y));
			const mGeom = new THREE.BufferGeometry().setFromPoints(mPoints);
			const mMat = new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true });
			const mLine = new THREE.LineLoop(mGeom, mMat);
			mLine.visible = false;
			translationGroup.add(mLine);
			moonOrbitLines.push(mLine);
		});

		// Lunes (meshes)
		const moons: THREE.Mesh[] = [];
		(p.moons ?? []).forEach((moon) => {
			const mGeom = new THREE.SphereGeometry(moon.size * 0.5, 16, 16);
			const mMat = new THREE.MeshStandardMaterial({ color: moon.color ?? 0x999999, roughness: 0.9 });
			const mMesh = new THREE.Mesh(mGeom, mMat);
			moons.push(mMesh);
		});

		return { mesh: translationGroup, planetSphere: mesh, descriptor: p, orbitLine, moons, moonOrbitLines };
	}




	public update(elapsedTime: number, sunPosition?: THREE.Vector3) {
		this.planets.forEach((planetObj) => {
			const p = planetObj.descriptor;
			// Utiliser les mêmes paramètres que createPlanetMesh
			const radiusScale = Math.max(p.size * 20, 5); 
			const spacingFactor = 1.8;
			
			// Calculer la distance de base en fonction de la taille de l'étoile
			const starVisualRadius = Math.max(2, this.starSize * 2);
			const minBaseDistance = starVisualRadius * 4 + 100;
			const baseDistance = Math.max(300, minBaseDistance);

			const a = baseDistance * Math.pow(spacingFactor, (p.index ?? 0) + 1);
			const ex = p.orbitEccentricity ?? 0;
			const b = a * (1 - ex);
			const incl = p.orbitInclination ?? 0;
			
			// Ralentir la vitesse orbitale (facteur 0.1)
			const angle = (elapsedTime * (p.orbitSpeed ?? 0.0001) * 0.1) + (p.orbitPhase ?? 0);

			// Orbite elliptique centrée sur le soleil
			const x = a * Math.cos(angle);
			const z = b * Math.sin(angle);
			// Inclinaison réelle : la planète doit suivre l'orbite incliné
			const y = Math.sin(incl) * z * 0.1;
			planetObj.mesh.position.set(x, y, z);

			// Met à jour la position du soleil dans le shader
			if (sunPosition) {
				const mat = planetObj.planetSphere.material as THREE.ShaderMaterial;
				if (mat.uniforms && mat.uniforms.sunPos) {
					mat.uniforms.sunPos.value.set(sunPosition.x, sunPosition.y, sunPosition.z);
				}
			}

			// Rotation sur elle-même (basée sur le temps et ralentie)
			if (p.selfRotationSpeed) {
				planetObj.planetSphere.rotation.y = elapsedTime * p.selfRotationSpeed * 0.1;
			}

			// planetObj.mesh.lookAt(new THREE.Vector3(0, 0, 0)); // Désactivé pour ne pas perturber les orbites de lunes

			(p.moons ?? []).forEach((moon, mi) => {
				const mMesh = planetObj.moons[mi];
				const mDistance = moon.distance ?? (radiusScale * 2 + 100);
				// Ralentir la vitesse orbitale des lunes
				const mAngle = (elapsedTime * (moon.orbitSpeed ?? 0.001) * 0.5) + (moon.orbitPhase ?? 0);
				// Position relative au groupe de translation (qui est déjà à la position de la planète)
				const mx = Math.cos(mAngle) * mDistance;
				const mz = Math.sin(mAngle) * mDistance;
				mMesh.position.set(mx, 0, mz);
			});
		});
	}

	public toggleOrbits(visible: boolean) {
		this.planets.forEach(p => {
			p.orbitLine.visible = visible;
			p.moonOrbitLines.forEach(l => l.visible = visible);
		});
	}

	public dispose() {
		this.group.traverse(obj => {
			if ((obj as any).geometry) (obj as any).geometry.dispose();
			if ((obj as any).material) {
				const mat = (obj as any).material;
				if (mat.map) mat.map.dispose();
				mat.dispose();
			}
		});
		if (this.group.parent) this.group.parent.remove(this.group);
	}
}
