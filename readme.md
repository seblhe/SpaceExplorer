# 🌌 SpaceExplorer

**SpaceExplorer** est un moteur d'exploration spatiale procédurale en 3D, développé avec **Vite**, **Three.js**, **TypeScript** et **React**. Il permet de naviguer dans un univers généré dynamiquement, composé de galaxies, étoiles, planètes, lunes et phénomènes cosmiques.

---

## 🚀 Fonctionnalités

- Génération procédurale de galaxies et systèmes stellaires
- Visualisation 3D immersive avec effets cinématiques
- Interaction avec les étoiles (zoom, sélection, déplacement)
- Affichage dynamique des orbites selon la proximité
- UI minimaliste pour zoom, rotation et informations système
- Système de LOD (Level of Detail) pour optimiser les performances

---

## 🧬 Technologies utilisées

| Technologie   | Usage principal                           |
|--------------|--------------------------------------------|
| Vite         | Bundler rapide pour développement web      |
| TypeScript   | Typage strict et sécurité du code          |
| Three.js     | Rendu 3D en WebGL                          |
| React        | Gestion de l'interface utilisateur         |

---

## 🧑‍🚀 Lancer le projet

### ▶️ Méthode 1 : Serveur local simple

```bash
python -m http.server 8080
# ou
npx http-server -p 8080
```
Puis ouvrir http://localhost:8080

### ▶️ Méthode 2 : Vite + npm

```bash
npm install
npm run dev
```
Puis ouvrir http://localhost:5173

## 🪐 Structure du projet

src/
├── cosmos/           # Générateurs d'entités spatiales (étoiles, planètes, lunes, etc.)
├── universe/         # Générateur de galaxies et gestion de l'univers
├── ui/               # Interface utilisateur
├── main.ts           # Point d'entrée principal
├── OrbitControls.ts  # Contrôles de navigation


## 📸 Aperçu visuel
(Ajoutez ici une capture d’écran ou une animation du rendu 3D)

## 🛣️ Roadmap

- [ ] Génération de structures orbitales (stations, ruines…)
- [ ] Ajout de biomes et climats planétaires
- [ ] Système de factions et civilisations
- [ ] Mode cinématique pour exploration automatique
- [ ] Export vers WebXR pour support VR

## 🤝 Contribuer

Les contributions sont les bienvenues ! Pour proposer une amélioration :

1. Fork le dépôt
2. Crée une branche (feature/ma-fonctionnalite)
3. Commit tes modifications
4. Ouvre une Pull Request

## 📄 Licence
Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus d'informations.

## ✨ Auteur

Développé par Sébastien

