// src/cosmos/StarVisualizerCinematic.ts
import * as THREE from 'three';
import type { SolarEvent, SolarEventVisual, StarDescriptor } from './types';
import { mulberry32, seedFromId } from './prng';

interface StarVisualizerOptions {
	lodDistance?: number;
}

export class StarVisualizerCinematic {
	public mesh: THREE.Object3D;
	private surfaceMesh!: THREE.Mesh;
	private activeEvents: SolarEvent[] = [];
	private uniforms!: {
		time: { value: number };
		color: { value: THREE.Color };
		size: { value: number };
		noiseOffset: { value: number };
	};

	private readonly lodDistance: number;
	private isCloseLOD = false;
	private currentScale = 1;
	private eventCooldown = 0;

	constructor(public descriptor: StarDescriptor, opts: StarVisualizerOptions = {}) {
		//console.log("StarVisualizerCinematic constructor")
		this.lodDistance = opts.lodDistance ?? 600;

		this.mesh = new THREE.Object3D();
		this.mesh.name = `star-${descriptor.id}`;

		this.descriptor = {
			...descriptor,
			seed: descriptor.seed ?? seedFromId(descriptor.id),
			index: descriptor.index ?? 0,
			rng: descriptor.rng ?? mulberry32(descriptor.seed ?? seedFromId(descriptor.id))
		};

		this.buildSurfaceLOD();
	}

	// ==================== SURFACE ====================
	private createTextTexture(text: string, options?: {
		font?: string;
		fontSize?: number;
		color?: string;
		background?: string;
		padding?: number;
	}): THREE.Texture {
		const {
			font = 'Arial',
			fontSize = 48,
			color = '#ffffff',
			background = 'transparent',
			padding = 20
		} = options ?? {};

		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d')!;
		context.font = `${fontSize}px ${font}`;

		// Mesure du texte
		const textWidth = context.measureText(text).width;
		canvas.width = textWidth + padding * 2;
		canvas.height = fontSize + padding * 2;

		// Redessiner avec dimensions correctes
		context.font = `${fontSize}px ${font}`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';

		if (background !== 'transparent') {
			context.fillStyle = background;
			context.fillRect(0, 0, canvas.width, canvas.height);
		}

		context.fillStyle = color;
		context.fillText(text, canvas.width / 2, canvas.height / 2);

		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;

		return texture;
	}

	public updateLabelOrientation(camera: THREE.Camera) {
		const label = this.mesh.children.find(obj => obj instanceof THREE.Sprite) as THREE.Sprite;
		if (label) {
			label.quaternion.copy(camera.quaternion);
		}
	}

	private buildSurfaceLOD() {
		const size = this.descriptor.size ?? 10;
		const sunColor = new THREE.Color(this.getColor());
		const glowColor = new THREE.Color(1 - sunColor.r, 1 - sunColor.g, 1 - sunColor.b);

		this.uniforms = {
			time: { value: 0 },
			color: { value: glowColor },
			size: { value: size },
			noiseOffset: { value: Math.random() * 1000 }
		};

		const material = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: this.vertexShader(),
			fragmentShader: this.fragmentShader(),
			transparent: false,
			blending: THREE.AdditiveBlending,
			depthWrite: true
		});

		const geom = new THREE.SphereGeometry(1, 64, 32);
		this.surfaceMesh = new THREE.Mesh(geom, material);
		const baseSize = (this.descriptor.size ?? 1) * 100;
		this.surfaceMesh.scale.setScalar(baseSize);
		this.mesh.add(this.surfaceMesh);

		/*const glowGeom = new THREE.SphereGeometry(baseSize * 1.5, 64, 32);
		const glowMat = new THREE.MeshBasicMaterial({
			color: new THREE.Color(this.getColor()),
			transparent: true,
			opacity: 0.3,
			side: THREE.BackSide
		});
		const glowMesh = new THREE.Mesh(glowGeom, glowMat);
		this.mesh.add(glowMesh);*/
		/*const labelTexture = this.createTextTexture(this.descriptor.id ?? 'Soleil', {
			fontSize: 64,
			color: '#ffff88',
			background: 'rgba(0,0,0,0.3)'
		});

		const labelMaterial = new THREE.SpriteMaterial({
			map: labelTexture,
			transparent: true,
			depthWrite: false
		});

		const label = new THREE.Sprite(labelMaterial);
		label.scale.set(300, 100, 1); // adapte à ta scène
		label.position.set(0, baseSize * 1.2, 0);
		this.mesh.add(label);*/
	}

	// ==================== ÉVÉNEMENTS SOLAIRES ====================
	private particleTexture: THREE.Texture | null = null;
	private initTextures(): void {
		if (!this.particleTexture) {
			const loader = new THREE.TextureLoader();
			this.particleTexture = loader.load('textures/particle.png');
		}
	}
	private createSolarEvent(): SolarEvent {
		const spectralSizes: Record<string, number> = {
			M: 0.2,
			K: 0.7,
			G: 1,
			F: 1.3,
			A: 2,
			B: 5,
			O: 10
		};

		const spectralClass = (this.descriptor.spectralClass ?? 'G').toUpperCase();
		//const baseSize = spectralSizes[spectralClass] ?? 1;
		const baseSize = this.descriptor.size ?? 1;
		const scaleFactor = THREE.MathUtils.clamp(baseSize / 4, 0.5, 1.5);
		const radius = baseSize * 1.2; // ou autre facteur d’échelle
		const type = this.weightedEventType();

		let geom: THREE.BufferGeometry;
		let mesh: SolarEventVisual;
		//let color = type === 'loop' ? 0xffcc66 : type === 'jet' ? 0xff3300 : 0x66ccff;
		const baseColor = new THREE.Color(this.getColor());
		const hsl = { h: 0, s: 0, l: 0 };
		baseColor.getHSL(hsl);
		const color = new THREE.Color().setHSL(
			hsl.h,
			Math.min(1, hsl.s + Math.random() * 0.2),
			Math.max(0, hsl.l - Math.random() * 0.3)
		);

		switch (type) {
			case 'loop': {
				//console.log("🌀 Loop solar event")
				const curve = new THREE.QuadraticBezierCurve3(
					new THREE.Vector3(0, 0, 0),
					new THREE.Vector3(0, 1.5 * scaleFactor, 0),
					new THREE.Vector3(1.5 * scaleFactor, 0, 0)
				);
				const points = curve.getPoints(64);
				geom = new THREE.BufferGeometry().setFromPoints(points);
				const mat = new THREE.LineBasicMaterial({
					color,
					transparent: true,
					opacity: 0.9,
					linewidth: 2
				});
				mesh = new THREE.Line(geom, mat) as unknown as THREE.Mesh;
				mesh.rotation.y = Math.random() * Math.PI * 2;
				mesh.rotation.z = Math.random() * Math.PI;

				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);

				mesh.position.set(
					radius * Math.sin(phi) * Math.cos(theta),
					radius * Math.sin(phi) * Math.sin(theta),
					radius * Math.cos(phi)
				);
				break;
			}
			case 'jet': {
				//console.log("💨 Jet solar event");

				const particleCount = 100;
				const coneAngle = Math.PI / 16; // ✅ cône plus étroit (~11°)
				const maxDistance = 1.5 * scaleFactor;         // ✅ hauteur réduite
				const speedMin = 0.01 * scaleFactor;
				const speedMax = 0.03 * scaleFactor;

				const radius = (this.descriptor.size ?? 10) * 1.2;

				// Position d’origine sur la sphère
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);
				const origin = new THREE.Vector3(
					radius * Math.sin(phi) * Math.cos(theta),
					radius * Math.sin(phi) * Math.sin(theta),
					radius * Math.cos(phi)
				);

				// Orientation du cône selon la normale locale
				const normal = origin.clone().normalize();
				const axis = new THREE.Vector3(0, 1, 0);
				const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, normal);

				const positions = new Float32Array(particleCount * 3);
				const velocities: THREE.Vector3[] = [];

				for (let i = 0; i < particleCount; i++) {
					// Direction locale dans un cône étroit
					const angle = coneAngle * Math.random();
					const azimuth = Math.random() * Math.PI * 2;

					const x = Math.sin(angle) * Math.cos(azimuth);
					const y = Math.cos(angle);
					const z = Math.sin(angle) * Math.sin(azimuth);

					const localDir = new THREE.Vector3(x, y, z).normalize();
					const globalDir = localDir.applyQuaternion(quaternion);

					const distance = Math.random() * maxDistance;
					const pos = origin.clone().add(globalDir.clone().multiplyScalar(distance));
					positions[i * 3 + 0] = pos.x;
					positions[i * 3 + 1] = pos.y;
					positions[i * 3 + 2] = pos.z;

					velocities.push(globalDir.multiplyScalar(speedMin + Math.random() * (speedMax - speedMin)));
				}

				const geom = new THREE.BufferGeometry();
				geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
				geom.userData = { velocities };

				const mat = new THREE.PointsMaterial({
					map: this.particleTexture,
					color: 0xff5500,
					size: 0.2,
					transparent: true,
					opacity: 1,
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					alphaTest: 0.01
				});

				mesh = new THREE.Points(geom, mat);
				mesh.position.set(0, 0, 0); // les particules sont déjà positionnées
				mesh.scale.setScalar(1);
				break;
			}
			case 'shockwave': {
				//console.log("💥 Shockwave solar event");
				// 1. Géométrie : calotte sphérique centrée sur la base
				const geom = new THREE.SphereGeometry(0.5 * scaleFactor, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3);
				geom.translate(0, -0.5 * scaleFactor, 0); // ✅ décale la calotte vers l’origine

				// 2. Matériau : onde lumineuse et transparente
				const mat = new THREE.MeshBasicMaterial({
					color,
					transparent: false,
					opacity: 1,
					side: THREE.FrontSide,
					blending: THREE.AdditiveBlending,
					depthWrite: true
				});

				// 3. Mesh
				mesh = new THREE.Mesh(geom, mat);

				// 4. Position aléatoire sur la sphère solaire
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);
				const radius = (this.descriptor.size ?? 10) * 1.2;
				const position = new THREE.Vector3(
					radius * Math.sin(phi) * Math.cos(theta),
					radius * Math.sin(phi) * Math.sin(theta),
					radius * Math.cos(phi)
				);

				// 5. Orientation selon la normale locale
				const normal = position.clone().normalize();
				const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
				mesh.setRotationFromQuaternion(quaternion);

				// 6. Placement
				mesh.position.copy(position);
				mesh.scale.setScalar(0.5); // ✅ départ plus petit
				break;
			}
		}

		mesh.scale.setScalar(1);
		this.mesh.add(mesh);

		return {
			type,
			mesh,
			duration: 5 + Math.random() * 5,
			elapsed: 0,
			position: mesh.position.clone(),
			scale: 1
		};
	}


	private weightedEventType(): SolarEvent['type'] {
		const s = (this.descriptor.spectralClass ?? 'G').toUpperCase();

		// Probabilités par classe spectrale
		const weightsByClass: Record<string, [number, number, number]> = {
			M: [0.2, 0.7, 0.1], // loop, jet, shockwave
			K: [0.3, 0.6, 0.1],
			G: [0.4, 0.4, 0.2],
			F: [0.5, 0.3, 0.2],
			A: [0.5, 0.2, 0.3],
			B: [0.6, 0.1, 0.3],
			O: [0.5, 0.1, 0.4]
		};

		const weights = weightsByClass[s] ?? [0.4, 0.4, 0.2]; // fallback

		const r = Math.random();
		if (r < weights[0]) return 'loop';
		if (r < weights[0] + weights[1]) return 'jet';
		return 'shockwave';
	}

	// ==================== ANIMATION ====================
	updateEffects(distanceToCamera: number) {
		//console.log('🌀 updateEffects called, distanceToCamera =', distanceToCamera);
		const shouldAnimate = distanceToCamera < this.lodDistance;
		//console.log('🔍 shouldAnimate =', shouldAnimate, '| isCloseLOD =', this.isCloseLOD);
		//console.log('shouldAnimate:', shouldAnimate, 'distance:', distanceToCamera);

		if (shouldAnimate !== this.isCloseLOD) {
			this.isCloseLOD = shouldAnimate;
			this.surfaceMesh.visible = true;
			//console.log('shouldAnimate:', shouldAnimate, 'distance:', distanceToCamera);
		}

		const baseSize = this.descriptor.size ?? 10;
		const targetScale = baseSize * THREE.MathUtils.clamp(this.lodDistance / (distanceToCamera + 1), 0.9, 1.1);
		this.currentScale = THREE.MathUtils.lerp(this.currentScale, targetScale, 0.08);
		this.surfaceMesh.scale.setScalar(this.currentScale);

		// Création d'événements solaires selon un cooldown
		if (shouldAnimate) {
			//console.log('Animation --> shouldAnimate:', shouldAnimate, 'distance:', distanceToCamera);
			this.eventCooldown -= 0.016;
			if (this.eventCooldown <= 0) {
				this.activeEvents.push(this.createSolarEvent());
				this.eventCooldown = 1 + Math.random() * 2; // prochaine éruption dans 1-3s
			}
			/*this.eventCooldown = 1;
			this.activeEvents.push(this.createSolarEvent());
			this.eventCooldown = 1 + Math.random() * 2; // prochaine éruption dans 1-3s
			*/
		}

		// Animation et suppression
		this.activeEvents.forEach(ev => {
			ev.elapsed += 0.016;
			const progress = ev.elapsed / ev.duration;

			ev.mesh.scale.setScalar(1 + progress * 2);

			const mat = ev.mesh.material as THREE.MeshBasicMaterial;
			if (mat) mat.opacity = 0.8 * (1 - progress);

			if (ev.elapsed >= ev.duration) {
				this.mesh.remove(ev.mesh);
			}

			if (ev.type === 'shockwave' && ev.mesh instanceof THREE.Mesh) {
				// Expansion linéaire ou exponentielle
				const baseSize = this.descriptor.size ?? 1;
				const expansion = baseSize * (0.5 + (ev.elapsed / ev.duration) * 1.5);
				ev.mesh.scale.setScalar(expansion);

				// Atténuation progressive de l’opacité
				const mat = ev.mesh.material as THREE.MeshBasicMaterial;
				if (mat) {
					mat.opacity = 0.4 * (1 - ev.elapsed / ev.duration);
					// ❌ Supprimer la variation de teinte
				}
				if (ev.elapsed >= ev.duration) {
					ev.mesh.visible = false;
				}
			}
			else if (ev.type === 'jet' && ev.mesh instanceof THREE.Points) {
				const geom = ev.mesh.geometry as THREE.BufferGeometry;
				const pos = geom.getAttribute('position') as THREE.BufferAttribute;
				const velocities = geom.userData.velocities as THREE.Vector3[];

				for (let i = 0; i < pos.count; i++) {
					const v = velocities[i];
					const x = pos.getX(i) + v.x;
					const y = pos.getY(i) + v.y;
					const z = pos.getZ(i) + v.z;
					pos.setXYZ(i, x, y, z);
				}

				pos.needsUpdate = true;

				const mat = ev.mesh.material as THREE.PointsMaterial;
				if (mat) mat.opacity = 1 - ev.elapsed / ev.duration;
			}

		});
		this.activeEvents = this.activeEvents.filter(ev => ev.elapsed < ev.duration);
	}

	animate(elapsedSeconds: number) {
		//this.uniforms.time.value = elapsedSeconds;
		this.uniforms.time.value += elapsedSeconds * 0.05; // ✅ ralentit le temps 5x
	}

	private getColor(): string {
		const spectralMap: Record<string, string> = {
			O: '#9bb0ff',
			B: '#aabfff',
			A: '#cad7ff',
			F: '#f8f7ff',
			G: '#fff4ea',
			K: '#ffd2a1',
			M: '#ffcc6f'
		};
		return spectralMap[this.descriptor.spectralClass ?? 'G'] ?? '#ffffff';
	}

	private vertexShader(): string {
		return `
        uniform float time;
        uniform float size;
        uniform float noiseOffset;
        varying vec3 vNormal;
        varying vec3 vPosition;

        float hash(float n) {
            return fract(sin(n) * 43758.5453);
        }

        float noise(vec3 p) {
            float n = dot(p, vec3(12.9898, 78.233, 37.719));
            return fract(sin(n + noiseOffset) * 43758.5453);
        }

        void main() {
            vNormal = normal;
            vPosition = position;

            // Bruit plus doux et plus lent
            float n = noise(normal * 4.0 + time * 0.05); // ✅ moins de fréquence et vitesse

            // Amplitude réduite et indépendante de la taille
            float displacement = n * 0.02; // ✅ plus subtil
            vec3 newPos = position + normal * displacement;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
    `;
	}

	private fragmentShader(): string {
		return `
			uniform vec3 color;
			varying vec3 vNormal;
			varying vec3 vPosition;
			void main(){
				vec3 col = color;
				gl_FragColor = vec4(col, 1.0);
			}
		`;
	}
}
