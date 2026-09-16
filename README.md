# AI Act — Observatoire 3D

Application de démonstration : un graphe de connaissances temporel interactif sur le règlement européen sur l'IA (Règlement (UE) 2024/1689), avec registre de versions à preuve cryptographique (chaînage par hash + arbres de Merkle, modèle *transparency log*).

## Échelle de vues (une même donnée, 6 points de vue)

| Niveau | Vue | Question |
|---|---|---|
| 0 | **LISTE** | « Je cherche une donnée précise » — table, tri, recherche |
| 1 | **2D** | « Comment les données sont-elles reliées ? » |
| 2 | **3D** | « Quelle est la structure globale ? » |
| 3 | **SPIRALE** | « Quel est l'état à une date donnée ? » — hélice temporelle 2021→2030 |
| 4 | **NEURONE** | « Qu'y a-t-il dans cette donnée ? » — plongée + orbite des versions |
| 5 | **COUCHES** | « Où est la preuve ? » — cristal moléculaire des versions + carte d'historique vérifiable |

Navigation : breadcrumbs, `↑`/`↓` pour changer de niveau, `0`/`L` liste, `S` spirale, `4`/`P` neurone, `5`/`C` couches, `Échap` descend d'un niveau. Bouton **Tuto** = visite guidée auto-pilotée (10 étapes).

## Fonctionnalités

- Timeline 2021 → 2030 avec 25 jalons sourcés (EUR-Lex, Commission, Parlement) — dates post *Digital Omnibus* à jour
- Registre blockchain-like : chaque action crée une version chaînée (SHA-256, `@noble/hashes`, Merkle tree maison), fiche BLOC au clic, sabotage/réparation pédagogiques, cycle de vérification
- Recherche moléculaire : par texte ou préfixe de hash, preuves de Merkle vérifiables
- Scénario « La Bascule » : 11 événements (hallucination × intention → franchissement Art. 5(1)(a)), circuit électrique coloré par type d'événement

## Stack

React 19 · TypeScript · Vite · Tailwind · three.js (`react-force-graph-3d` / `-2d`) · d3-scale · @noble/hashes

## Développement

```bash
npm install
npm run dev      # serveur de dev
npm run build    # build de production → dist/
```
