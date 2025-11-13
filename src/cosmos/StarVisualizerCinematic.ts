// src/cosmos/StarVisualizerCinematic.ts
import * as THREE from 'three';
import type { StarDescriptor } from './types';

interface StarEvent {
    id: number;
    type: 'bright' | 'dim' | 'jet' | 'storm';
    longitude: number;
    latitude: number;
    intensity: number;
    duration: number;
    age: number;
}

interface StarVisualizerOptions {
    lodDistance?: number;
    filamentCount?: number;
}

export class StarVisualizerCinematic {
    public mesh: THREE.Object3D;
    private surfaceMesh!: THREE.Mesh;
    private uniforms!: {
        time: { value: number };
        baseColor: { value: THREE.Color };
        contrastColor: { value: THREE.Color };
        events: { value: THREE.Vector4[] };
        numEvents: { value: number };
    };

    private events: StarEvent[] = [];
    private eventTimer = 0;
    private readonly maxEvents = 16;
    private readonly lodDistance: number;
    private elapsed = 0;

    constructor(public descriptor: StarDescriptor, opts: StarVisualizerOptions = {}) {
        this.lodDistance = opts.lodDistance ?? 2000;
        this.mesh = new THREE.Object3D();
        this.mesh.name = `star-${descriptor.id}`;
        this.buildSurface();
    }

    // --- Construction du soleil ---
    private buildSurface() {
        const size = this.descriptor.size ?? 10;
        const baseColor = new THREE.Color(this.getColor());
        const contrastColor = this.computeContrastColor(baseColor);

        this.uniforms = {
            time: { value: 0 },
            baseColor: { value: baseColor },
            contrastColor: { value: contrastColor },
            events: { value: Array.from({ length: this.maxEvents }, () => new THREE.Vector4(0, 0, 0, 0)) },
            numEvents: { value: 0 },
        };

        const geom = new THREE.SphereGeometry(size, 64, 64);
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader(),
            fragmentShader: this.fragmentShader(),
            blending: THREE.AdditiveBlending,
            transparent: false,
            depthWrite: true,
        });

        this.surfaceMesh = new THREE.Mesh(geom, mat);
        this.surfaceMesh.name = 'star-surface';
        this.mesh.add(this.surfaceMesh);
    }

    // --- Génération des couleurs ---
    private getColor(): string {
        const spectralMap: Record<string, string> = {
            O: '#9bb0ff',
            B: '#aabfff',
            A: '#cad7ff',
            F: '#f8f7ff',
            G: '#fff4ea',
            K: '#ffd2a1',
            M: '#ffcc6f',
        };
        return spectralMap[this.descriptor.spectralClass ?? 'G'] ?? '#ffffff';
    }

    private computeContrastColor(base: THREE.Color): THREE.Color {
        // Contraste automatique pour les effets
        const luminance = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b;
        if (luminance > 0.6) {
            return new THREE.Color(0.1, 0.1, 0.1); // sombre pour étoiles claires
        } else {
            return new THREE.Color(1.5, 1.2, 0.9); // clair pour étoiles rouges/jaunes
        }
    }

    // --- Génération d’un nouvel événement ---
    private spawnEvent() {
        if (this.events.length >= this.maxEvents) return;
        const types: StarEvent['type'][] = ['bright', 'dim', 'jet', 'storm'];
        const type = types[Math.floor(Math.random() * types.length)];

        this.events.push({
            id: Math.random(),
            type,
            longitude: Math.random() * Math.PI * 2,
            latitude: (Math.random() - 0.5) * Math.PI,
            intensity: 0.5 + Math.random() * 0.8,
            duration: 2 + Math.random() * 6,
            age: 0,
        });
    }

    // --- Mise à jour à chaque frame ---
    public animate(dt: number) {
        this.elapsed += dt;
        this.eventTimer += dt;

        // Ajouter un événement toutes les 1.5 à 3 secondes
        if (this.eventTimer > 1.5 + Math.random() * 1.5) {
            this.eventTimer = 0;
            this.spawnEvent();
        }

        // Met à jour la durée de vie et enlève les événements expirés
        this.events.forEach(e => (e.age += dt));
        this.events = this.events.filter(e => e.age < e.duration);

        // Met à jour les uniforms pour le shader
        const vecs = this.events.map(e => {
            const phase = e.age / e.duration;
            const intensity = e.intensity * (1 - Math.abs(phase - 0.5) * 2); // fade in/out
            return new THREE.Vector4(e.longitude, e.latitude, intensity, this.mapEventType(e.type));
        });

        for (let i = 0; i < this.maxEvents; i++) {
            this.uniforms.events.value[i] = vecs[i] ?? new THREE.Vector4(0, 0, 0, 0);
        }
        this.uniforms.numEvents.value = vecs.length;
        this.uniforms.time.value = this.elapsed;
    }

    private mapEventType(type: StarEvent['type']): number {
        switch (type) {
            case 'bright': return 1;
            case 'dim': return 2;
            case 'jet': return 3;
            case 'storm': return 4;
        }
    }

    // --- SHADERS ---

    private vertexShader(): string {
        return `
            varying vec3 vNormal;
            varying vec3 vPos;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPos = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    private fragmentShader(): string {
        return `
            uniform vec3 baseColor;
            uniform vec3 contrastColor;
            uniform vec4 events[16];
            uniform int numEvents;
            varying vec3 vNormal;
            varying vec3 vPos;

            // Conversion sphérique
            vec2 sphericalCoords(vec3 n) {
                float lon = atan(n.z, n.x);
                float lat = asin(n.y);
                return vec2(lon, lat);
            }

            void main() {
                vec2 coord = sphericalCoords(vNormal);
                vec3 col = baseColor;

                for (int i = 0; i < 16; i++) {
                    if (i >= numEvents) break;
                    vec4 ev = events[i];
                    float dLon = abs(coord.x - ev.x);
                    float dLat = abs(coord.y - ev.y);
                    float dist = sqrt(dLon*dLon + dLat*dLat);
                    float influence = exp(-dist * 25.0) * ev.z;

                    if (ev.w == 1.0) col += contrastColor * influence; // bright
                    if (ev.w == 2.0) col -= contrastColor * influence; // dim
                    if (ev.w == 3.0) col += contrastColor * influence * 1.5; // jet
                    if (ev.w == 4.0) col += vec3(1.0, 0.2, 0.05) * influence; // storm
                }

                gl_FragColor = vec4(col, 1.0);
            }
        `;
    }
}
