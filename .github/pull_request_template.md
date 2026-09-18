## Objectif
<Le besoin métier. Ex. : ajouter l'import de clients depuis un CSV.>

## Changements
- <Ex. : colonnes obligatoires, e-mails en double, erreurs par ligne, tests unitaires.>

## Comment tester
1. <Ex. : ouvrir Clients → Importer → choisir un CSV valide.>
2. Résultat attendu : <les clients sont créés.>
3. Cas négatifs : <CSV invalide → erreurs par ligne ; doublon → refusé.>

## Risques
- <Ex. : modifie le traitement des doublons.>
- Base de données / migrations : <aucune | décrire + retour arrière>
- Déploiement : <la fusion déclenche-t-elle la prod ? oui/non>

## Contrôles
- [ ] lint · [ ] typecheck · [ ] tests (<n> exécutés) · [ ] build
- [ ] aucun secret ni donnée client
- [ ] changement annulable (revert simple)
