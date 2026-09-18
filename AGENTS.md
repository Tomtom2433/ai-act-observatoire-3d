# Règles Git pour les agents (Codex, Claude, autres) — miroir de ~/.claude/rules/git-collab.md

À placer à la racine du dépôt (Codex lit AGENTS.md ; Claude Code lit CLAUDE.md — importer ce fichier avec `@AGENTS.md`).

- Une tâche = une branche (`feature/ fix/ hotfix/ refactor/ docs/ test/ chore/` + kebab-case) = un dossier distinct (`git worktree add --no-track -b <branche> ../<projet>-<tache> origin/main`) = une Pull Request vers `main`.
- Lire `git status` avant toute modification. Jamais de commit ni de push direct sur `main`.
- Mettre à jour main avec `git pull --ff-only`. Mettre à jour sa branche : `git fetch origin && git rebase origin/main` (branche perso, dossier propre).
- Préserver le travail existant ; nommer les fichiers à ajouter (pas de `git add .`) ; relire `git diff --staged`.
- Aucun secret, `.env`, export client ou donnée de production dans Git (`.env.example` sans valeurs uniquement).
- Commits : `type(zone): description` (feat fix refactor test docs chore ci build perf), message via `git commit -F <fichier hors dépôt>`.
- Avant de proposer la fusion : lint, typecheck, tests, build verts ; indiquer le nombre de tests exécutés.
- Commit, push, force push (`--force-with-lease` seulement, jamais `--force`, jamais sur main), merge et déploiement : uniquement sur demande explicite.
- Avant toute action qui déclenche la production : s'arrêter et présenter version, cible, contrôles, risques et retour arrière ; attendre l'accord.
- Interdits sans accord explicite : `reset --hard`, `clean -fd`, `restore .`, `checkout -- .`, `branch -D`, `push --force`, réécriture d'historique partagé.
- En cas de doute ou d'état Git inattendu : s'arrêter et décrire l'état.
- Intégration : Squash and merge ; supprimer la branche après fusion (`git branch -d`, un refus après squash n'autorise pas `-D`).
