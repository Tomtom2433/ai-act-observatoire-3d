/**
 * « Courant électrique » — code couleur sémantique des liens et halos.
 *
 * Trois états de circuit + un état d'alarme :
 *  - chemin    : cyan électrique — flux continu rapide (chemin actif) ;
 *  - brut      : bleu-gris froid — courant lent et intermittent (données
 *                présentes mais non activées / non vérifiées) ;
 *  - decision  : doré — éclairs / surcharge (impulsions rapides irrégulières)
 *                sur les liens des nœuds de décision ;
 *  - violation : rouge — clignotement d'alarme sur le tronçon fautif.
 *
 * En mode « La Bascule », chaque événement franchi électrifie son tronçon
 * dans la couleur de son type d'événement.
 */
import type { BasculeEventType } from '../data/laBasculeData'

export type CircuitKind = 'chemin' | 'brut' | 'decision' | 'violation'

export const CIRCUIT_COLORS: Record<CircuitKind, string> = {
  chemin: '#00d5e9',
  brut: '#8ab4ff',
  decision: '#ffca34',
  violation: '#ff5872',
}

/** Couleurs circuit par type d'événement du scénario (sémantique demandée). */
export const CIRCUIT_TYPE_COLORS: Record<BasculeEventType, string> = {
  prompt_user: '#00d5e9', // cyan
  sortie_ia: '#a78bfa', // violet
  decision_humaine: '#ffca34', // doré
  action_systeme: '#8ab4ff', // bleu-gris
  detection: '#f5f5f5', // blanc
  consequence: '#ff5872', // rouge
}

export const CIRCUIT_TYPE_LABELS: Record<BasculeEventType, string> = {
  prompt_user: 'Prompt utilisateur',
  sortie_ia: 'Sortie IA',
  decision_humaine: 'Décision humaine',
  action_systeme: 'Action système',
  detection: 'Détection',
  consequence: 'Conséquence / violation',
}

export interface CircuitSegment {
  /** Extrémités (ids de nœuds, non orienté pour le rendu). */
  s: string
  t: string
  color: string
  kind: CircuitKind
}

const seg = (s: string, t: string, type: BasculeEventType, kind: CircuitKind = 'chemin'): CircuitSegment => ({
  s,
  t,
  color: CIRCUIT_TYPE_COLORS[type],
  kind,
})

/**
 * Tronçons électrifiés par événement (index = seq - 1).
 * Chaque segment est un lien réel du graphe ; certains relient des nœuds
 * « futurs » à la date de l'événement — le scénario force alors leur
 * affichage (circuit alimenté avant l'activation juridique).
 */
export const BASCULE_CIRCUIT: CircuitSegment[][] = [
  // 1 — Mise en service d'ORELIA (action système, licite)
  [seg('art-113', 'risque-inacceptable', 'action_systeme'), seg('risque-inacceptable', 'art-5', 'action_systeme')],
  // 2 — Première hallucination détectée (sortie IA)
  [seg('art-113', 'gpai', 'sortie_ia'), seg('gpai', 'art-53-55', 'sortie_ia')],
  // 3 — Prompt d'orientation (prompt utilisateur)
  [seg('maitrise-ia', 'art-5', 'prompt_user'), seg('art-5', 'manipulation', 'prompt_user')],
  // 4 — Sorties orientées en production (sortie IA)
  [seg('manipulation', 'risque-inacceptable', 'sortie_ia')],
  // 5 — Décision de continuer + effacement de l'alerte (décision humaine → éclairs)
  [seg('art-99', 'sanctions-art99', 'decision_humaine', 'decision'), seg('risque-eleve', 'controle-humain', 'decision_humaine', 'decision')],
  // 6 — POINT DE BASCULE : lancement Silver Care (décision) + tronçon aval en violation
  [
    seg('art-5', 'exploitation-vulnerabilites', 'decision_humaine', 'decision'),
    seg('exploitation-vulnerabilites', 'risque-inacceptable', 'decision_humaine', 'decision'),
    seg('art-5', 'amende-35m', 'consequence', 'violation'),
  ],
  // 7 — Plainte collective (conséquence → alarme)
  [seg('autorites-nationales', 'art-5', 'consequence', 'violation')],
  // 8 — Signalement du lanceur d'alerte (détection → blanc)
  [seg('ai-office', 'autorites-nationales', 'detection'), seg('comite-ia', 'autorites-nationales', 'detection')],
  // 9 — Bascule temporelle Art. 50 (action système)
  [seg('risque-limite', 'art-50', 'action_systeme'), seg('transparence-art50', 'amende-15m', 'action_systeme')],
  // 10 — Falsification du registre révélée (détection → blanc)
  [seg('sanctions-art99', 'amende-7-5m', 'detection')],
  // 11 — Décision de sanction (conséquence → alarme)
  [seg('sanctions-art99', 'amende-35m', 'consequence', 'violation')],
]

/** Index (0-based) de l'événement « point de bascule » (Év. 6). */
export const BASCULE_PIVOT_INDEX = 5

/** Clé non orientée d'un lien. */
export function circuitKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Lookup « tronçon atteint » pour un index d'événement donné. */
export function basculeCircuitMap(eventIndex: number): Map<string, CircuitSegment> {
  const map = new Map<string, CircuitSegment>()
  for (let i = 0; i <= Math.min(eventIndex, BASCULE_CIRCUIT.length - 1); i++) {
    for (const s of BASCULE_CIRCUIT[i]) map.set(circuitKey(s.s, s.t), s)
  }
  return map
}
