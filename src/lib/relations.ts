/**
 * Classification des relations du graphe en deux familles visuelles :
 *  - « action » : verbes à effet (interdit, impose, supervise…) — lien animé
 *    avec particules directionnelles dorées ;
 *  - « structure » : appartenance / classification (est_un, inclut…) — lien
 *    statique fin et discret.
 */

export const ACTION_RELATIONS = new Set([
  'interdit',
  'interdit_par',
  'impose',
  'doivent',
  'incombe_a',
  'sanctionne',
  'sanctionne_par',
  'surveillent',
  'supervise',
  'font_respecter',
  'encadres_par',
  'alerte_sur',
  'ordonne_le_calendrier_de',
  's_applique_a',
  'regi_par',
  'aboutit_a',
  'modifie',
  'reporte',
  'conseille',
  'coordonne',
  'definit',
  'classifie_par',
  'facilite',
  'peut_impliquer',
  'peut_demontrer_conformite_via',
  'activee_en_meme_temps_que',
])

export type RelationKind = 'action' | 'structure'

export function relationKind(relation: string): RelationKind {
  return ACTION_RELATIONS.has(relation) ? 'action' : 'structure'
}
