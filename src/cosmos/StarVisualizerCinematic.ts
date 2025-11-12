// src/cosmos/StarVisualizerCinematic.ts
import * as THREE from 'three';
import type { StarDescriptor } from './types';

interface StarVisualizerOptions {
	flareIntensity?: number;
	haloIntensity?: number;
	lodDistance?: number;
	pointScale?: number; // facteur pour la taille du point lointain
	showOrbits?: boolean;
}

export class StarVisualizerCinematic {
	public mesh: THREE.Object3D;
	private isCloseLOD = false;
	private pointMesh!: THREE.Points;
	private surfaceMesh!: THREE.Mesh;
	private uniforms!: {
		time: { value: number };
		flareIntensity: { value: number };
		haloIntensity: { value: number };
		color: { value: THREE.Color };
		size: { value: number };
		noiseOffset: { value: number };
	};
	private planetMeshes: THREE.Mesh[] = [];
	private orbitCurves: THREE.Line[] = [];

	private readonly lodDistance: number;
	private readonly flareIntensity: number;
	private readonly haloIntensity: number;
	private readonly pointScale: number;
	private readonly showOrbits: boolean;

	// internal smoothing state
	private currentScale = 1;

	constructor(public descriptor: StarDescriptor, opts: StarVisualizerOptions = {}) {
		this.lodDistance = opts.lodDistance ?? 2000;
		this.flareIntensity = opts.flareIntensity ?? 0.12;
		this.haloIntensity = opts.haloIntensity ?? 0.05;
		this.pointScale = opts.pointScale ?? 1.0;
		this.showOrbits = opts.showOrbits ?? true;

		this.mesh = new THREE.Object3D();
		this.mesh.name = `star-${descriptor.id}`;

		this.buildPointLOD();
		this.buildSurfaceLOD();
		this.buildPlanets();
	}

	// --- helper: create a circular point texture from canvas so points don't look like squares
	private createPointTexture(diameter = 128): THREE.Texture {
		const size = diameter;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
		grad.addColorStop(0, 'rgba(255,255,255,1)');
		grad.addColorStop(0.2, 'rgba(255,255,255,0.95)');
		grad.addColorStop(0.45, 'rgba(255,255,255,0.6)');
		grad.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);

		const tex = new THREE.CanvasTexture(canvas);
		tex.minFilter = THREE.LinearFilter;
		tex.magFilter = THREE.LinearFilter;
		tex.needsUpdate = true;
		return tex;
	}

	private buildPointLOD() {
		const geom = new THREE.BufferGeometry();
		geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
		const col = new THREE.Color(this.getColor());
		const colors = new Float32Array([col.r, col.g, col.b]);
		geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		const tex = this.createPointTexture(128);

		const mat = new THREE.PointsMaterial({
			size: (this.descriptor.size ?? 1) * 2.0 * this.pointScale,
			map: tex,
			vertexColors: true,
			sizeAttenuation: true,
			transparent: true,
			alphaTest: 0.01,
			depthWrite: false,
		});

		this.pointMesh = new THREE.Points(geom, mat);
		this.pointMesh.name = 'star-point';
		this.mesh.add(this.pointMesh);
	}

	private buildSurfaceLOD() {
		this.uniforms = {
			time: { value: 0 },
			flareIntensity: { value: this.flareIntensity },
			haloIntensity: { value: this.haloIntensity },
			color: { value: new THREE.Color(this.getColor()) },
			size: { value: this.descriptor.size ?? 1 },
			noiseOffset: { value: Math.random() * 1000 }
		};

		const material = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: this.vertexShader(),
			fragmentShader: this.fragmentShader(),
			transparent: false,
			blending: THREE.AdditiveBlending,
			depthWrite: true,
		});

		const geom = new THREE.SphereGeometry(Math.max(0.5, this.descriptor.size ?? 1), 64, 32);
		this.surfaceMesh = new THREE.Mesh(geom, material);
		this.surfaceMesh.visible = false;
		this.surfaceMesh.name = 'star-surface';
		this.mesh.add(this.surfaceMesh);
	}

	private buildPlanets() {
		if (!this.descriptor.planets || this.descriptor.planets.length === 0) return;

		this.descriptor.planets.forEach((planet, i) => {
			const planetSize = Math.max(0.2, planet.size ?? (planet.radiusKm ? planet.radiusKm / 10000 : 0.5));
			const geom = new THREE.SphereGeometry(planetSize, 16, 12);
			const mat = new THREE.MeshStandardMaterial({
				color: new THREE.Color(planet.color || '#888888'),
				roughness: 1.0,
				metalness: 0.05,
			});
			const mesh = new THREE.Mesh(geom, mat);
			mesh.name = `planet-${planet.id || i}`;

			const phase = planet.orbitPhase ?? Math.random() * Math.PI * 2;
			const a = planet.distance ?? 50;
			const e = planet.orbitEccentricity ?? 0;
			const b = a * (1 - e);
			mesh.position.set(Math.cos(phase) * a, 0, Math.sin(phase) * b);
			const inc = planet.orbitInclination ?? 0;
			mesh.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(inc));

			this.mesh.add(mesh);
			this.planetMeshes.push(mesh);

			// draw orbit curve if showOrbits enabled
			if (this.showOrbits) {
				const orbitLine = this.createOrbitCurve(a, b, inc);
				orbitLine.name = `orbit-${planet.id || i}`;
				orbitLine.visible = false; // hidden by default
				this.mesh.add(orbitLine);
				this.orbitCurves.push(orbitLine);
			}
		});
	}

	private getColor(): string {
		const spectralMap: Record<string, string> = {
			O: '#9bb0ff', B: '#aabfff', A: '#cad7ff',
			F: '#f8f7ff', G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f'
		};
		return spectralMap[this.descriptor.spectralClass ?? 'G'] ?? '#ffffff';
	}

	private vertexShader(): string { /* same as previous, unchanged */ 
		return `
			uniform float time;
			uniform float size;
			uniform float noiseOffset;
			varying vec3 vNormal;
			varying vec3 vPosition;

			float hash(float n) { return fract(sin(n) * 43758.5453); }
			float noise(vec3 p) {
				float n = dot(p, vec3(12.9898,78.233,37.719));
				return fract(sin(n + noiseOffset) * 43758.5453);
			}

			void main() {
				vNormal = normal;
				vPosition = position;
				float n = noise(normal * 10.0);
				vec3 newPos = position + normal * n * 0.01 * size;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos,1.0);
			}
		`;
	}

	private fragmentShader(): string { /* same as previous, unchanged */
		return `
			uniform float flareIntensity;
			uniform float haloIntensity;
			uniform vec3 color;
			varying vec3 vNormal;
			varying vec3 vPosition;

			void main() {
				float ndotl = max(dot(normalize(vNormal), vec3(0.0,0.0,1.0)),0.0);
				float intensity = pow(ndotl,2.0);
				float flare = (sin(vPosition.x*1.0 + vPosition.y*0.5)) * flareIntensity * 0.02;
				float halo = pow(1.0 - length(vNormal.xy),2.0) * haloIntensity;
				vec3 col = color * (intensity + flare + halo);
				gl_FragColor = vec4(col,1.0);
			}
		`;
	}

	private createOrbitCurve(a: number, b: number, inclinationDeg: number): THREE.Line {
		const points: THREE.Vector3[] = [];
		const step = 0.06;
		for (let theta = 0; theta < Math.PI * 2 + 1e-6; theta += step) {
			const x = a * Math.cos(theta);
			const z = b * Math.sin(theta);
			points.push(new THREE.Vector3(x, 0, z));
		}
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({ color: 0x444444, opacity: 0.25, transparent: true });
		const line = new THREE.LineLoop(geometry, material);
		line.rotation.x = THREE.MathUtils.degToRad(inclinationDeg);
		return line;
	}

	updateEffects(distanceToCamera: number) {
		const shouldBeClose = distanceToCamera < this.lodDistance;
		if (shouldBeClose !== this.isCloseLOD) {
			this.isCloseLOD = shouldBeClose;
			this.surfaceMesh.visible = shouldBeClose;
			this.pointMesh.visible = !shouldBeClose;

			// toggle orbit visibility
			this.orbitCurves.forEach(o => o.visible = shouldBeClose);
		}

		const targetScale = THREE.MathUtils.clamp(this.lodDistance / (distanceToCamera + 1), 0.9, 1.1);
		this.currentScale = THREE.MathUtils.lerp(this.currentScale, targetScale, 0.08);
		const scaleVec = new THREE.Vector3(this.currentScale,this.currentScale,this.currentScale);
		if (this.surfaceMesh.visible) this.surfaceMesh.scale.copy(scaleVec);
		if (this.pointMesh.visible) this.pointMesh.scale.copy(scaleVec);
	}

	animate(elapsedSeconds: number, deltaSeconds?: number) {
		if (this.isCloseLOD) this.uniforms.time.value = elapsedSeconds;

		this.planetMeshes.forEach((mesh, i) => {
			const planet = this.descriptor.planets![i];

			const orbitSpeed = planet.orbitSpeed ?? 0.0001;
			const selfRotationSpeed = planet.selfRotationSpeed ?? Math.max(orbitSpeed * 50,0.002);
			const tiltDeg = planet.selfTilt ?? 0;
			const eccentricity = planet.orbitEccentricity ?? 0;
			const a = planet.distance ?? 50;
			const b = a * (1 - eccentricity);
			const phase = planet.orbitPhase ?? 0;
			const inclinationDeg = planet.orbitInclination ?? 0;

			const angle = phase + elapsedSeconds * orbitSpeed;
			const x = Math.cos(angle) * a;
			const z = Math.sin(angle) * b;
			let pos = new THREE.Vector3(x, 0, z);
			pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(inclinationDeg));
			mesh.position.copy(pos);

			const dt = deltaSeconds ?? 1/60;
			const tiltRad = THREE.MathUtils.degToRad(tiltDeg);
			const axis = new THREE.Vector3(Math.sin(tiltRad), Math.cos(tiltRad),0).normalize();
			mesh.rotateOnAxis(axis, selfRotationSpeed * dt);
		});
	}
}
