import * as THREE from 'three';
import type { PlanetDescriptor } from './types';

export interface PlanetVisualizerOptions {
	showOrbits?: boolean;
	starPosition?: THREE.Vector3;
	shadowDarkness?: number; // 0 = pas d'ombre, 1 = très sombre
}

export class PlanetVisualizer {
	public group: THREE.Group;
	public planets: {
		mesh: THREE.Object3D;
		descriptor: PlanetDescriptor;
		orbitLine: THREE.Line;
		moons: THREE.Mesh[];
	}[] = [];

	constructor(planetsData: PlanetDescriptor[], scene: THREE.Scene, opts: PlanetVisualizerOptions = {}) {
		this.group = new THREE.Group();
		this.group.position.copy(opts.starPosition ?? new THREE.Vector3(0, 0, 0));
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
			}
		});
	}

	private createPlanetMesh(p: PlanetDescriptor) {
		const radiusScale = p.size * 5;
		const spacingFactor = 1.8;
		const baseDistance = 300;

		const distance = baseDistance * Math.pow(spacingFactor, (p.index ?? 0) + 1);
		const angle = p.orbitPhase ?? 0;
		const ex = p.orbitEccentricity ?? 0;
		const incl = p.orbitInclination ?? 0;

		// Crée la courbe d’orbite
		const a = distance;
		const b = distance * (1 - ex);
		const c = Math.sqrt(a * a - b * b); // distance du centre au foyer

		const orbitCurve = new THREE.EllipseCurve(
			-c, 0, // ← décalage du centre vers la gauche
			a,
			b,
			0, Math.PI * 2,
			false,
			0
		);

		// Position de la planète sur l’ellipse (dans le plan XZ)
		const point = orbitCurve.getPoint(angle / (Math.PI * 2));
		const x = point.x;
		const z = point.y;

		// Création de la planète
		const textureLoader = new THREE.TextureLoader();
		const texturePath = '/textures/' + p.type + '_planet.png';
		const texture = textureLoader.load(texturePath);
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
		mesh.position.set(x, 0, z);
		mesh.receiveShadow = true;

		// Ligne d’orbite inclinée
		const orbitPoints = orbitCurve.getPoints(120).map(pt => {
			const px = pt.x;
			const pz = pt.y;
			const py = Math.sin(incl) * pz * 0.1; // inclinaison réelle
			return new THREE.Vector3(px, py, pz);
		});
		const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
		const orbitMat = new THREE.LineBasicMaterial({ color: 0x444444, opacity: 0.25, transparent: true });
		const orbitLine = new THREE.LineLoop(orbitGeom, orbitMat);
		orbitLine.visible = false;

		// Groupe contenant planète + orbite
		const orbitGroup = new THREE.Group();
		orbitGroup.add(mesh);
		orbitGroup.add(orbitLine);

		// Lunes (non inclinées ici, à adapter si besoin)
		const moons: THREE.Mesh[] = [];
		(p.moons ?? []).forEach((moon) => {
			const mGeom = new THREE.SphereGeometry(moon.size * 0.5, 16, 16);
			const mMat = new THREE.MeshStandardMaterial({ color: moon.color ?? 0x999999, roughness: 0.9 });
			const mMesh = new THREE.Mesh(mGeom, mMat);

			const mDistance = moon.distance ?? (radiusScale * 2 + 100);
			const mAngle = moon.orbitPhase ?? 0;
			const mx = mesh.position.x + Math.cos(mAngle) * mDistance;
			const mz = mesh.position.z + Math.sin(mAngle) * mDistance;
			mMesh.position.set(mx, mesh.position.y, mz);

			moons.push(mMesh);
		});

		return { mesh: orbitGroup, descriptor: p, orbitLine, moons };
	}




	public update(elapsedTime: number, sunPosition?: THREE.Vector3) {
		this.planets.forEach((planetObj) => {
			const p = planetObj.descriptor;
			const radiusScale = p.size * 50;
			const baseDistance = 300;
			const spacingFactor = 1.8; // espacement exponentiel

			const distance = baseDistance * Math.pow(spacingFactor, p.index ?? 0) + radiusScale;
			const ex = p.orbitEccentricity ?? 0;
			const incl = p.orbitInclination ?? 0;
			const angle = (elapsedTime * (p.orbitSpeed ?? 0.0001)) + (p.orbitPhase ?? 0);

			const x = Math.cos(angle) * distance * (1 + ex * Math.sin(angle));
			const z = Math.sin(angle) * distance;
			const y = Math.sin(incl) * distance * 0.1;
			planetObj.mesh.position.set(x, y, z);

			// Met à jour la position du soleil dans le shader
			// Utilise la position du mesh du soleil du système
			if (sunPosition) {
				planetObj.mesh.traverse(obj => {
					const meshObj = obj as THREE.Mesh;
					if (
						meshObj.material &&
						(meshObj.material as any).uniforms &&
						(meshObj.material as any).uniforms.sunPos
					) {
						(meshObj.material as any).uniforms.sunPos.value.set(sunPosition.x, sunPosition.y, sunPosition.z);
					}
				});
			}

			if (p.selfRotationSpeed) planetObj.mesh.rotation.y += p.selfRotationSpeed;

			planetObj.mesh.lookAt(new THREE.Vector3(0, 0, 0));

			(p.moons ?? []).forEach((moon, mi) => {
				const mMesh = planetObj.moons[mi];
				const mDistance = moon.distance ?? (radiusScale * 2 + 100);
				const mAngle = (elapsedTime * (moon.orbitSpeed ?? 0.001)) + (moon.orbitPhase ?? 0);
				const mx = planetObj.mesh.position.x + Math.cos(mAngle) * mDistance;
				const mz = planetObj.mesh.position.z + Math.sin(mAngle) * mDistance;
				mMesh.position.set(
					Math.cos(mAngle) * mDistance + planetObj.mesh.position.x,
					planetObj.mesh.position.y,
					Math.sin(mAngle) * mDistance + planetObj.mesh.position.z
				);
			});
		});
	}

	public toggleOrbits(visible: boolean) {
		this.planets.forEach(p => p.orbitLine.visible = visible);
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
