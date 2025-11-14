import * as THREE from 'three';
import type { PlanetDescriptor } from './types';

export interface PlanetVisualizerOptions {
    showOrbits?: boolean;
    starPosition?: THREE.Vector3;
}

export class PlanetVisualizer {
    public group: THREE.Group;
    private planets: {
        mesh: THREE.Mesh;
        descriptor: PlanetDescriptor;
        orbitLine: THREE.Line;
        moons: THREE.Mesh[];
    }[] = [];

    constructor(planetsData: PlanetDescriptor[], scene: THREE.Scene, opts: PlanetVisualizerOptions = {}) {
        this.group = new THREE.Group();
        scene.add(this.group);

        const starPos = opts.starPosition ?? new THREE.Vector3(0, 0, 0);

        planetsData.forEach((p) => {
            const planet = this.createPlanetMesh(p, starPos);
            this.group.add(planet.mesh);
            this.group.add(planet.orbitLine);
            planet.moons.forEach(m => this.group.add(m));

            this.planets.push(planet);
        });
    }

    private createPlanetMesh(p: PlanetDescriptor, starPos: THREE.Vector3) {
		console.log("createPlanetMesh")
        const radiusScale = p.size * 200;
        const geom = new THREE.SphereGeometry(radiusScale, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color), roughness: 0.8, metalness: 0.05 });
        const mesh = new THREE.Mesh(geom, mat);

        const distance = p.distance * 100 + radiusScale + 1000;
        const angle = p.orbitPhase ?? 0;
        const ex = p.orbitEccentricity ?? 0;
        const incl = p.orbitInclination ?? 0;

        const x = Math.cos(angle) * distance * (1 + ex * Math.sin(angle));
        const z = Math.sin(angle) * distance;
        const y = Math.sin(incl) * distance * 0.1;
        mesh.position.set(x, y, z);

        // ligne d'orbite
        const orbitCurve = new THREE.EllipseCurve(0, 0, distance, distance * (1 - ex));
        const orbitPoints = orbitCurve.getPoints(120).map(pt => new THREE.Vector3(pt.x, 0, pt.y));
        const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({ color: 0x444444, opacity: 0.25, transparent: true });
        const orbitLine = new THREE.LineLoop(orbitGeom, orbitMat);
        orbitLine.visible = false;

        // lunes
        const moons: THREE.Mesh[] = [];
        (p.moons ?? []).forEach((moon) => {
            const mGeom = new THREE.SphereGeometry(moon.size * 50, 16, 16);
            const mMat = new THREE.MeshStandardMaterial({ color: moon.color ?? 0x999999, roughness: 0.9 });
            const mMesh = new THREE.Mesh(mGeom, mMat);

            const mDistance = moon.distance ?? (radiusScale * 2 + 100);
            const mAngle = moon.orbitPhase ?? 0;
            const mx = mesh.position.x + Math.cos(mAngle) * mDistance;
            const mz = mesh.position.z + Math.sin(mAngle) * mDistance;
            mMesh.position.set(mx, mesh.position.y, mz);

            moons.push(mMesh);
        });

        return { mesh, descriptor: p, orbitLine, moons };
    }

    public update(elapsedTime: number, starPos: THREE.Vector3) {
        this.planets.forEach((planetObj) => {
            const p = planetObj.descriptor;
            const distance = p.distance * 100 + (p.size * 200) + 1000;
            const ex = p.orbitEccentricity ?? 0;
            const incl = p.orbitInclination ?? 0;
            const angle = (elapsedTime * (p.orbitSpeed ?? 0.0001)) + (p.orbitPhase ?? 0);

            const x = Math.cos(angle) * distance * (1 + ex * Math.sin(angle));
            const z = Math.sin(angle) * distance;
            const y = Math.sin(incl) * distance * 0.1;
            planetObj.mesh.position.set(x, y, z);

            // rotation
            if (p.selfRotationSpeed) planetObj.mesh.rotation.y += p.selfRotationSpeed;

            // face éclairée
            planetObj.mesh.lookAt(starPos);

            // mises à jour lunes
            (p.moons ?? []).forEach((moon, mi) => {
                const mMesh = planetObj.moons[mi];
                const mDistance = moon.distance ?? (p.size * 200 * 2 + 100);
                const mAngle = (elapsedTime * (moon.orbitSpeed ?? 0.001)) + (moon.orbitPhase ?? 0);
                const mx = planetObj.mesh.position.x + Math.cos(mAngle) * mDistance;
                const mz = planetObj.mesh.position.z + Math.sin(mAngle) * mDistance;
                mMesh.position.set(mx, planetObj.mesh.position.y, mz);
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
