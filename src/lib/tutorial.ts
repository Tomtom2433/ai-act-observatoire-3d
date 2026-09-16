/**
 * Tuto démo guidé — définition des étapes.
 *
 * Chaque étape : titre, texte FR court, zone ciblée (rectangle en % du
 * viewport — approche pragmatique, pas de sélecteurs DOM fragiles), et
 * pour les étapes clés une ACTION RÉELLE pilotée via TutoApi (l'app joue
 * elle-même : lecture de la timeline, sélection, switch de vue, sabotage…).
 *
 * `action` est exécutée à l'entrée de l'étape, `onLeave` à la sortie.
 */

export interface TutoApi {
  /** Saut de timeline à une date ISO (yyyy-mm-dd). */
  seekTo: (iso: string) => void
  /** Joue la timeline ~3 s puis se pose sur le jalon du 2025-08-02. */
  playDemo: () => void
  /** Sélectionne un nœud par id (commit de version inclus). */
  selectNodeById: (id: string) => void
  /** Change la vue de base (2D/3D) en conservant le contexte. */
  setBaseView: (view: '2d' | '3d') => void
  /** Plongée NEURONE sur le nœud sélectionné (ou art-5). */
  enterDive: () => void
  /** Vue COUCHES sur le nœud sélectionné (ou art-5). */
  enterLayers: () => void
  /** Ouvre le Registre (panneau droit). */
  openRegistry: () => void
  /** Sabotage de démo + re-vérification de la chaîne (cascade rouge). */
  sabotageDemo: () => void
  /** Répare la feuille sabotée. */
  repairDemo: () => void
  /** Lance « Tout vérifier » dans la HistoryCard. */
  verifyHistory: () => void
  /** Active le scénario La Bascule à l'événement donné (index). */
  startBascule: (index: number) => void
  /** Retour à l'état de base (vue 3D, sans scénario, sabotage réparé). */
  resetAll: () => void
}

/** Rectangle cible en % du viewport. */
export interface TutoZone {
  x: number
  y: number
  w: number
  h: number
}

export interface TutoStep {
  titre: string
  texte: string
  zone: TutoZone
  /** Côté préféré de la carte par rapport à la zone. */
  cote: 'bas' | 'haut' | 'gauche' | 'droite'
  action?: (api: TutoApi) => void
  onLeave?: (api: TutoApi) => void
}

export const TUTO_TARGET_NODE = 'art-5'

export const TUTO_STEPS: TutoStep[] = [
  {
    titre: 'Bienvenue',
    texte:
      "L'observatoire explore le règlement AI Act comme un graphe de connaissances temporel : chaque nœud est une molécule du texte, chaque lien une relation juridique. Tout ce que vous verrez est UNE même donnée sous plusieurs points de vue.",
    zone: { x: 25, y: 20, w: 50, h: 55 },
    cote: 'bas',
    action: (api) => api.resetAll(),
  },
  {
    titre: 'Voyage temporel',
    texte:
      "La timeline pilote la date T : les obligations apparaissent quand elles deviennent applicables. L'app joue toute seule pendant ~3 s, puis se pose sur le 2 août 2025 — le jalon GPAI.",
    zone: { x: 10, y: 86, w: 80, h: 13 },
    cote: 'haut',
    action: (api) => api.playDemo(),
  },
  {
    titre: 'Sélection = bloc chaîné',
    texte:
      "Cliquer un nœud duplique son artefact (nœud + liens + voisinage) dans une version chaînée par hash : #v, prevHash → hash, racine de Merkle. L'app vient de sélectionner « Article 5 — Pratiques interdites » ; la fiche BLOC est vérifiable d'un clic.",
    zone: { x: 62, y: 55, w: 37, h: 42 },
    cote: 'gauche',
    action: (api) => api.selectNodeById(TUTO_TARGET_NODE),
  },
  {
    titre: 'Point de vue 2D',
    texte:
      "Même nœud, même date, autres lunettes : la vue 2D aplatit le graphe en carte plane. La sélection et les filtres suivent d'une vue à l'autre — c'est la même information, pas une copie.",
    zone: { x: 38, y: 10, w: 24, h: 8 },
    cote: 'bas',
    action: (api) => api.setBaseView('2d'),
  },
  {
    titre: 'NEURONE — la plongée',
    texte:
      "La plongée isole le nœud comme un neurone : les versions du registre orbitent autour de lui (dorée = première apparition, rouge = modifiée, grise = inchangée). Survolez, cliquez une orbite pour sauter à sa date.",
    zone: { x: 25, y: 20, w: 50, h: 55 },
    cote: 'bas',
    action: (api) => api.enterDive(),
  },
  {
    titre: 'COUCHES — cristal moléculaire',
    texte:
      "Chaque version devient une couche d'atomes (les feuilles) reliés par des liaisons. Atome rouge = feuille modifiée, doré = nouvelle, via rouge épaisse = changement entre couches. Cliquez un atome : la preuve se centre dessus.",
    zone: { x: 25, y: 15, w: 50, h: 65 },
    cote: 'droite',
    action: (api) => api.enterLayers(),
  },
  {
    titre: 'Historique vérifiable',
    texte:
      "La carte d'historique re-hache chaque occurrence : racine de Merkle recalculée, hash de version, chaînage prevHash. L'app lance « Tout vérifier » — verdict ✓ intègre avec le temps de calcul.",
    zone: { x: 1, y: 14, w: 27, h: 72 },
    cote: 'droite',
    action: (api) => api.verifyHistory(),
  },
  {
    titre: 'Sabotage — la cascade',
    texte:
      "Une feuille d'une version passée est altérée silencieusement : la re-vérification montre l'invalidation en cascade — tout l'aval d'un engagement falsifié devient invalide. Le cycle de vérification en tête du Registre s'ouvre en rouge au maillon fautif ; « Vérifier le cycle » après Réparer le referme en vert.",
    zone: { x: 62, y: 8, w: 37, h: 84 },
    cote: 'gauche',
    action: (api) => {
      api.setBaseView('3d')
      api.openRegistry()
      api.sabotageDemo()
    },
    onLeave: (api) => api.repairDemo(),
  },
  {
    titre: 'Point de bascule',
    texte:
      "15/07/2025 : le chatbot ORELIA hallucine une couverture santé. Pas encore une violation — une intention manquante, pas une règle brisée : le circuit passe au rouge sur ce moment précis. Le scénario est lancé à l'événement 6.",
    zone: { x: 30, y: 20, w: 45, h: 50 },
    cote: 'bas',
    action: (api) => api.startBascule(5), // index 0-based de l'événement seq 6 (2025-07-15)
  },
  {
    titre: 'À vous',
    texte:
      "Vous savez tout : 2D/3D/NEURONE/COUCHES d'un clic, historique vérifiable partout, sabotage et réparation, point de bascule. Rappel : H = aide clavier, Échap = quitter le mode courant.",
    zone: { x: 0, y: 0, w: 100, h: 100 },
    cote: 'bas',
    action: (api) => api.resetAll(),
  },
]
