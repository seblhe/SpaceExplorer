# Space Explorer

**Space Explorer** est un jeu d'exploration spatiale en 3D développé avec **Vite.js** et **Three.js**.  
L’univers est **procédural et infini**, avec des galaxies, étoiles, planètes, lunes, phénomènes cosmiques et structures artificielles.

---

## 🚀 Caractéristiques principales

- **Univers procédural infini**
  - Les galaxies sont générées à la volée selon la position de la caméra.
  - Chaque galaxie a son type, taille, âge et composition en étoiles, planètes, lunes et phénomènes.

- **Multi-galaxies et LOD dynamique**
  - Les galaxies et étoiles lointaines sont affichées en **Points** pour optimiser les performances.
  - Les étoiles proches utilisent **StarVisualizer** avec rendu réaliste :
    - Surface granuleuse
    - Éruptions solaires animées
    - Couleur et taille adaptées à leur classe spectrale
  - LOD (Level of Detail) dynamique basé sur la distance caméra → galaxie/étoile.

- **Exploration interactive**
  - Contrôle orbital avec **OrbitControls**.
  - Zoom avant/arrière.
  - Rotation des galaxies activable/désactivable.
  - Affichage du seed et du nom des galaxies.

- **Structures et phénomènes**
  - Phénomènes spéciaux : nébuleuses, trous noirs, etc.
  - Structures artificielles : stations, ruines, avant-postes miniers ou de recherche.

---

## 🌌 Architecture du code

Universe
│
├── Galaxies (multi-cellules, générées procéduralement)
│ └── GalaxyDescriptor
│ - id, type, size, age
│ - stars[], phenomena[], structures[]
│ └── GalaxyLOD
│ - Group (THREE.Group)
│ - PointCloud (THREE.Points) → rendu lointain
│ - StarVisualizers[] → rendu proche
│
├── StarDescriptor
│ - id, spectralClass (O,B,A,F,G,K,M)
│ - mass, luminosity
│ - position (x,y,z)
│ - planets[]
│
├── StarVisualizer
│ - mesh (THREE.Mesh avec shader de surface granuleuse)
│ - éruptions solaires animées
│ - animate(time), update(dt)
│
├── Phenomena
│ - nébuleuses, trous noirs, autres effets cosmiques
│
└── Structures
- stations, ruines, outposts

### LOD dynamique
[Camera] ---> Distance à Galaxy / Etoile

Si distance galaxie > galaxyDistanceThreshold :
- Afficher uniquement le PointCloud de la galaxie
- StarVisualizers invisibles

Si distance galaxie < galaxyDistanceThreshold :
Pour chaque étoile :
Si distance étoile < starDistanceThreshold :
- Afficher StarVisualizer complet
Sinon :
- Étoile invisible (PointCloud présent)
- LOD permet un **équilibre entre performance et rendu réaliste**.
- La distance seuil peut être ajustée pour performance / effet cinéma.

---

### Animation et rendu

```text
Animation Loop:
    -> clock.getDelta() / clock.getElapsedTime()
    -> controls.update()
    -> Pour chaque GalaxyLOD:
         - update(camera) → visibilité étoiles
         - animate(time) → animations surfaces et éruptions
    -> renderer.render(scene, camera)