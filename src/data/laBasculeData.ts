/**
 * « LA BASCULE » — scénario d'incident EU AI Act.
 * Conversion fidèle de la-bascule/rapport_la_bascule.md (Règlement (UE) 2024/1689,
 * texte originel publié au JOUE — base juridique retenue par le rapport).
 *
 * Les 11 événements sont chaînés par hash selon la convention du rapport §5 :
 * hash = SHA256(bytes(prev_hash) ‖ bytes(canonical_json(artefact))),
 * prev_hash du premier événement = 'GENESIS'.
 */
import { computeEventHash, stableStringify, type EventChainEntry } from '../lib/merkle'

export type BasculeEventType =
  | 'prompt_user'
  | 'sortie_ia'
  | 'decision_humaine'
  | 'action_systeme'
  | 'detection'
  | 'consequence'

export const BASCULE_TYPE_META: Record<BasculeEventType, { label: string; couleur: string }> = {
  prompt_user: { label: 'Prompt utilisateur', couleur: '#b98cff' },
  sortie_ia: { label: 'Sortie IA', couleur: '#00d5e9' },
  decision_humaine: { label: 'Décision humaine', couleur: '#ff8a3d' },
  action_systeme: { label: 'Action système', couleur: '#8ab4ff' },
  detection: { label: 'Détection', couleur: '#ffca34' },
  consequence: { label: 'Conséquence', couleur: '#ff5872' },
}

export interface BasculeArtefact {
  seq: number
  date: string
  type: BasculeEventType
  acteur: Record<string, unknown>
  action: string
  contenu: Record<string, unknown>
  preuve: { piece: string; ref: string }
  article_map: string[]
  statut_juridique: string
  gravite: number
  prev_hash: string
  hash: string
}

export interface BasculeEvent {
  seq: number
  date: string
  types: BasculeEventType[]
  gravite: 1 | 2 | 3 | 4 | 5
  titre: string
  description: string
  /** Extrait éventuel (prompt, sortie IA…) cité dans le rapport. */
  citation: string | null
  articleApplicable: string
  statutJuridique: string
  /** Pastille de statut : licite / incident / zone grise / violation. */
  niveau: 'licite' | 'incident' | 'zone_grise' | 'violation' | 'sanction'
  estPointDeBascule: boolean
  artefact: BasculeArtefact
}

/* Artefacts bruts (sans hash) — conformes au rapport §5. */
const ARTEFACTS_BRUTS: Array<Omit<BasculeArtefact, 'prev_hash' | 'hash'>> = [
  {
    seq: 1,
    date: '2025-02-03',
    type: 'action_systeme',
    acteur: { role: 'deployer', entite: 'Nexa Mutuelle', agent: 'DSI' },
    action: 'mise_en_service',
    contenu: {
      systeme: 'ORELIA v1.0',
      modele_gpai: 'modele-tiers-api',
      usage_declare: 'conseil complementaire sante',
      controle_humain: 'nominal',
    },
    preuve: { piece: "PV de mise en service + fiche d'enregistrement interne", ref: 'PCS-2025-014' },
    article_map: ['art-113-a', 'art-3-1', 'art-3-4'],
    statut_juridique: 'licite',
    gravite: 1,
  },
  {
    seq: 2,
    date: '2025-03-14',
    type: 'sortie_ia',
    acteur: { role: 'systeme_ia', entite: 'ORELIA' },
    action: 'generation_sortie_inexacte',
    contenu: {
      extrait:
        "Renforce+ rembourse les implants dentaires jusqu'a 2800 EUR/an sans delai de carence",
      verite_terrain: 'plafond reel 1200 EUR, carence 6 mois',
      taux_hallucination_mesure: 0.031,
    },
    preuve: { piece: 'rapport qualite interne + log conversation (anonymise)', ref: 'QA-2025-077' },
    article_map: ['guidelines-C2025-884-s3.5.2', 'art-4'],
    statut_juridique: 'incident_sans_violation',
    gravite: 2,
  },
  {
    seq: 3,
    date: '2025-04-02',
    type: 'prompt_user',
    acteur: { role: 'deployer', entite: 'Nexa Mutuelle', agent: 'chef de produit' },
    action: 'modification_instructions_systeme',
    contenu: {
      instructions:
        "Tu es un conseiller mutualiste senior, chaleureux et rassurant. Presente toujours les plafonds de la maniere la plus favorable possible. Ne mentionne jamais les delais de carence ni les exclusions sauf si le client les cite nommement. Si tu n'es pas certain d'un chiffre, donne la fourchette haute.",
      contexte_analytique: 'conversations avec plafond hallucine : +22% conversion',
    },
    preuve: { piece: "diff git du system prompt + ticket d'approbation", ref: 'CFG-2025-041' },
    article_map: ['art-5-1-a(ii)', 'guidelines-C2025-884-s3.2.1'],
    statut_juridique: 'acte_preparatoire',
    gravite: 3,
  },
  {
    seq: 4,
    date: '2025-05-20',
    type: 'sortie_ia',
    acteur: { role: 'systeme_ia', entite: 'ORELIA v1.1 (config orientee)' },
    action: 'generation_sorties_trompeuses_en_production',
    contenu: {
      extrait:
        "vos lunettes et lentilles sont prises en charge integralement des le premier jour [...] c'est la formule que je recommande a tous mes clients de votre age",
      volume_4_semaines: { conversations: 312, contrats_signes: 41 },
    },
    preuve: { piece: 'echantillon de logs de production + CRM conversions', ref: 'PRD-2025-118' },
    article_map: ['art-5-1-a(i)(ii)(iii)'],
    statut_juridique: 'zone_grise_qualification_possible',
    gravite: 3,
  },
  {
    seq: 5,
    date: '2025-06-30',
    type: 'decision_humaine',
    acteur: {
      role: 'deployer',
      entite: 'Nexa Mutuelle',
      agent: 'directeur marketing (organe de direction)',
    },
    action: 'decision_maintien_configuration_et_suppression_alerte',
    contenu: {
      note_qualite:
        "risque de pratique trompeuse au sens de l'art. 5(1)(a) ; recommandation : retour arriere + information des 41 clients",
      decision: "maintien jusqu'a cloture de campagne",
      effacement: 'suppression de la note et des logs qualite du registre',
    },
    preuve: {
      piece: "note qualite conservee par la lanceuse d'alerte + journal d'effacement SI",
      ref: 'DIR-2025-092',
    },
    article_map: ['art-99-7-g', 'art-99-7-i'],
    statut_juridique: 'element_moral_etabli_aggravant',
    gravite: 4,
  },
  {
    seq: 6,
    date: '2025-07-15',
    type: 'decision_humaine',
    acteur: { role: 'deployer', entite: 'Nexa Mutuelle', agent: 'comite de direction' },
    action: 'lancement_campagne_silver_care',
    contenu: {
      campagne: 'Silver Care',
      cible: '65+',
      canal_principal: 'ORELIA config orientee',
      resultats_6_semaines: {
        conversations: 12400,
        contrats: 2180,
        surprime_moyenne_pct: 34,
        prejudice_estime_eur_an: 1900000,
      },
    },
    preuve: { piece: 'plan media + dashboard campagne + memo ciblage', ref: 'CMP-2025-201' },
    article_map: ['art-5-1-a(i-iv)_VIOLATION', 'art-5-1-b_subsidiaire', 'recital-29'],
    statut_juridique: 'VIOLATION_CARACTERISEE_POINT_DE_BASCULE',
    gravite: 5,
  },
  {
    seq: 7,
    date: '2025-09-10',
    type: 'consequence',
    acteur: { role: 'tiers', entite: 'association de consommateurs' },
    action: 'reclamation_groupee_et_revelation_mediatique',
    contenu: {
      temoignages: 'promesses de remboursement integral non tenues',
      reponse_nexa: 'erreurs ponctuelles du chatbot, corrigees',
    },
    preuve: { piece: 'reclamation groupee + article de presse', ref: 'EXT-2025-330' },
    article_map: ['recital-29_significant-harm', 'art-99-7-a'],
    statut_juridique: 'violation_en_cours',
    gravite: 3,
  },
  {
    seq: 8,
    date: '2026-01-20',
    type: 'detection',
    acteur: { role: 'lanceur_alerte', entite: 'ex-responsable qualite' },
    action: 'signalement_autorite_surveillance_marche',
    contenu: {
      pieces_transmises: [
        'exports registre qualite sauvegardes',
        'note supprimee',
        "instructions systeme d'avril 2025",
      ],
      suite: "ouverture d'enquete + demande d'information formelle",
    },
    preuve: { piece: "accuse de reception de l'autorite + hash des exports", ref: 'AUT-2026-011' },
    article_map: ['art-99-5_risque'],
    statut_juridique: 'violation_etablie_enquete_ouverte',
    gravite: 4,
  },
  {
    seq: 9,
    date: '2026-08-02',
    type: 'action_systeme',
    acteur: { role: 'ordre_juridique', entite: 'Reglement (UE) 2024/1689' },
    action: 'bascule_temporelle_application_generale',
    contenu: {
      nouvelles_obligations_actives: ['art-50 transparence', 'art-26 deployeurs HR'],
      constat: "ORELIA ne signale pas son caractere IA aux utilisateurs",
    },
    preuve: {
      piece: "capture de l'interface conversationnelle (absence de mention IA)",
      ref: 'CMP-2026-088',
    },
    article_map: ['art-113', 'art-50-1', 'art-99-4-g'],
    statut_juridique: 'cumul_violations',
    gravite: 3,
  },
  {
    seq: 10,
    date: '2026-11-05',
    type: 'detection',
    acteur: { role: 'autorite', entite: 'autorite nationale de surveillance du marche' },
    action: 'constat_falsification_registre_et_reponses_trompeuses',
    contenu: {
      entrees_manquantes_ou_alterees: 214,
      periode: '2025-04 -> 2025-09',
      preuve_integrite: 'rupture de chaine de hash sur le registre interne vs exports externes',
      declaration_fausse: "la configuration n'a jamais ete modifiee",
    },
    preuve: { piece: 'proces-verbal de comparaison des registres', ref: 'ENQ-2026-147' },
    article_map: ['art-99-5_VIOLATION', 'art-99-7-e', 'art-99-7-g', 'art-99-7-i'],
    statut_juridique: 'violation_procedurale_autonome',
    gravite: 4,
  },
  {
    seq: 11,
    date: '2027-03-15',
    type: 'consequence',
    acteur: { role: 'autorite', entite: 'autorite nationale de surveillance du marche' },
    action: 'decision_de_sanction',
    contenu: {
      chef_1: { fondement: 'art-99-3 (violation art. 5)', plafond: '35 000 000 EUR ou 7% CA mondial' },
      chef_2: { fondement: 'art-99-4-g (violation art. 50)', plafond: '15 000 000 EUR ou 3%' },
      chef_3: { fondement: 'art-99-5 (informations trompeuses)', plafond: '7 500 000 EUR ou 1%' },
      attenuant_PME: 'art-99-6 : pour les PME, le plus faible des deux plafonds',
      mesures: ['retrait de la configuration', 'information et indemnisation des assures'],
    },
    preuve: { piece: 'decision motivee de sanction', ref: 'SAN-2027-031' },
    article_map: ['art-99-3', 'art-99-4', 'art-99-5', 'art-99-6', 'art-99-7'],
    statut_juridique: 'sanction',
    gravite: 5,
  },
]

/** Chaînage SHA-256 des artefacts — calculé au chargement (déterministe). */
export const BASCULE_ARTEFACTS: BasculeArtefact[] = (() => {
  let prev = 'GENESIS'
  return ARTEFACTS_BRUTS.map((brut) => {
    const canonical = stableStringify(brut)
    const hash = computeEventHash(prev, canonical)
    const artefact: BasculeArtefact = { ...brut, prev_hash: prev, hash }
    prev = hash
    return artefact
  })
})()

/** Chaîne d'événements vérifiable (registre d'incident). */
export const BASCULE_EVENT_CHAIN: EventChainEntry[] = BASCULE_ARTEFACTS.map((a) => ({
  seq: a.seq,
  date: a.date,
  kind: a.type,
  canonical: stableStringify(ARTEFACTS_BRUTS[a.seq - 1]),
  prevEventHash: a.prev_hash,
  hash: a.hash,
}))

export const BASCULE_EVENTS: BasculeEvent[] = [
  {
    seq: 1,
    date: '2025-02-03',
    types: ['action_systeme'],
    gravite: 1,
    titre: "Mise en service d'ORELIA",
    description:
      "Nexa Mutuelle met en service, pour usage propre, le chatbot ORELIA sur son espace client : conseil en complémentaire santé, sous contrôle humain nominal. Le système repose sur un modèle GPAI tiers fourni via API. À cette date, seuls les Chapitres I-II du règlement sont applicables ; la mise en service elle-même est licite.",
    citation: null,
    articleApplicable:
      "Art. 113(a) (champ temporel) ; Art. 3(1) (définition du système d'IA) ; Art. 3(4) (Nexa = « deployer » : « a natural or legal person […] using an AI system under its authority »).",
    statutJuridique: 'Licite.',
    niveau: 'licite',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[0],
  },
  {
    seq: 2,
    date: '2025-03-14',
    types: ['sortie_ia', 'detection'],
    gravite: 2,
    titre: 'Première hallucination détectée — le « plafond Renforcé+ »',
    description:
      "ORELIA affirme à une adhérente que le contrat « Renforcé+ » rembourse les implants dentaires « jusqu'à 2 800 € par an sans délai de carence » — prestation inexistante (plafond réel : 1 200 €, carence 6 mois). La cellule qualité interne consigne l'écart dans le registre d'incidents : taux d'hallucination mesuré 3,1 % sur les réponses chiffrées.",
    citation: null,
    articleApplicable:
      "Aucune violation — l'hallucination seule n'est pas une pratique interdite. Les lignes directrices de la Commission excluent expressément du champ de l'Art. 5(1)(a) les systèmes trompeurs non susceptibles de causer un dommage significatif (§3.5.2, C(2025) 884). L'Art. 4 (maîtrise de l'IA du personnel, applicable depuis le 2 fév. 2025) impose toutefois déjà à Nexa de prendre des mesures de formation — obligation d'ores et déjà méconnue.",
    statutJuridique: 'Incident technique, pas de violation caractérisée.',
    niveau: 'incident',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[1],
  },
  {
    seq: 3,
    date: '2025-04-02',
    types: ['prompt_user'],
    gravite: 3,
    titre: "Le prompt d'orientation — la naissance de l'intention",
    description:
      "Le chef de produit constate dans les analytics que les conversations contenant le « plafond Renforcé+ » convertissent +22 %. Il rédige une bibliothèque d'instructions système. Ces instructions ne demandent pas explicitement de mentir — elles amplifient statistiquement la propension du modèle à halluciner dans le sens commercial. C'est l'acte de conception « purposefully » trompeur.",
    citation:
      "« Tu es un conseiller mutualiste senior, chaleureux et rassurant. Présente toujours les plafonds de la manière la plus favorable possible. Ne mentionne jamais les délais de carence ni les exclusions sauf si le client les cite nommément. Si tu n'es pas certain d'un chiffre, donne la fourchette haute. »",
    articleApplicable:
      "Prépare les éléments de l'Art. 5(1)(a) — « purposefully manipulative or deceptive techniques » (techniques conçues ou visant objectivement à influencer le comportement, cf. lignes directrices §3.2.1). Aucun consommateur n'est encore exposé à la configuration modifiée : pas encore d'« usage » prohibé.",
    statutJuridique: "Acte préparatoire — l'élément moral se constitue, l'élément matériel manque.",
    niveau: 'incident',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[2],
  },
  {
    seq: 4,
    date: '2025-05-20',
    types: ['sortie_ia'],
    gravite: 3,
    titre: 'Sorties orientées en production — premiers clients induits en erreur',
    description:
      "La configuration modifiée passe en production sans revue. Sur les 4 premières semaines, 312 conversations contiennent des garanties surévaluées ou des carences occultées ; 41 contrats sont signés dans la foulée. Toutes ces affirmations sont fausses ou substantiellement tronquées.",
    citation:
      "« Avec Renforcé+, vos lunettes et lentilles sont prises en charge intégralement dès le premier jour, et l'hospitalisation est couverte à 100 % en chambre particulière — c'est la formule que je recommande à tous mes clients de votre âge. »",
    articleApplicable:
      "Art. 5(1)(a) — les conditions (i) usage, (ii) technique délibérément trompeuse, (iii) objectif/effet de distortion matérielle du comportement sont réunies ; la condition (iv) — dommage significatif causé ou raisonnablement probable — reste discutable à cette échelle (41 contrats, montants individuels modiques).",
    statutJuridique:
      "Zone grise — qualification possible mais non certaine ; c'est le dernier moment où une mesure corrective (retour arrière, information des clients) éteint le risque.",
    niveau: 'zone_grise',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[3],
  },
  {
    seq: 5,
    date: '2025-06-30',
    types: ['decision_humaine'],
    gravite: 4,
    titre: "La décision de continuer — et d'effacer l'alerte",
    description:
      "La responsable qualité adresse au comité de direction une note formelle : « risque de pratique trompeuse au sens de l'Art. 5(1)(a) AI Act ; recommandation : rétablissement de la configuration nominale et information des 41 clients ». Le directeur marketing décide de maintenir la configuration jusqu'à la clôture de la campagne d'été, et fait supprimer la note et les logs qualité du registre interne.",
    citation: null,
    articleApplicable:
      "Consolide l'élément subjectif au niveau de l'organe de direction (imputabilité à la personne morale) ; la destruction de logs anticipe la violation de l'Art. 99(5) (informations trompeuses aux autorités) et constitue une circonstance aggravante au sens de l'Art. 99(7)(g) et (i) (« the intentional or negligent character of the infringement »).",
    statutJuridique:
      "L'intention est désormais établie et documentée (par son effacement même, reconstituable via le registre hashé).",
    niveau: 'violation',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[4],
  },
  {
    seq: 6,
    date: '2025-07-15',
    types: ['decision_humaine', 'consequence'],
    gravite: 5,
    titre: 'Lancement de « Silver Care » — le franchissement',
    description:
      "Nexa lance la campagne « Silver Care » : ORELIA, en configuration orientée, est le canal principal de vente auprès des 65+ (ciblage publicitaire dédié). En 6 semaines : 12 400 conversations, 2 180 contrats signés, primes moyennes +34 % pour des garanties effectives inférieures au contrat standard. Le préjudice financier agrégé des assurés est estimé a posteriori à 1,9 M€/an de surprimes.",
    citation: null,
    articleApplicable:
      "Art. 5(1)(a) — « the placing on the market, the putting into service or the use of an AI system that deploys […] purposefully manipulative or deceptive techniques, with the objective, or the effect of materially distorting the behaviour of a person or a group of persons by appreciably impairing their ability to make an informed decision, thereby causing them to take a decision that they would not have otherwise taken in a manner that causes or is reasonably likely to cause that person, another person or group of persons significant harm ». À titre subsidiaire : Art. 5(1)(b) (exploitation d'une vulnérabilité liée à l'âge).",
    statutJuridique: 'Violation caractérisée — point de bascule (analyse détaillée §3 du rapport).',
    niveau: 'violation',
    estPointDeBascule: true,
    artefact: BASCULE_ARTEFACTS[5],
  },
  {
    seq: 7,
    date: '2025-09-10',
    types: ['consequence'],
    gravite: 3,
    titre: 'Plainte collective des assurés',
    description:
      "Une association de défense des consommateurs dépose une réclamation groupée après témoignages convergents de seniors (« on m'a promis un remboursement intégral »). La presse régionale révèle l'affaire ; Nexa minimise publiquement (« erreurs ponctuelles du chatbot, corrigées ») — communication qui fige la stratégie du déni.",
    citation: null,
    articleApplicable:
      "Aucun nouveau fait constitutif ; alimente l'appréciation du « significant harm » (préjudice financier des personnes, cf. considérant 29 : « adverse impacts on […] financial interests ») et le nombre de personnes affectées (Art. 99(7)(a)).",
    statutJuridique: 'Violation en cours (usage continu).',
    niveau: 'violation',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[6],
  },
  {
    seq: 8,
    date: '2026-01-20',
    types: ['detection'],
    gravite: 4,
    titre: "Signalement à l'autorité de surveillance du marché",
    description:
      "Un lanceur d'alerte interne (la responsable qualité, licenciée entre-temps) transmet à l'autorité nationale de surveillance du marché compétente les exports du registre qualité qu'elle avait sauvegardés — y compris la note supprimée et les instructions système d'avril 2025. L'autorité ouvre une enquête et adresse une demande d'information formelle à Nexa.",
    citation: null,
    articleApplicable:
      "Art. 99(5) se profile : « The supply of incorrect, incomplete or misleading information to […] national competent authorities in reply to a request shall be subject to administrative fines of up to EUR 7 500 000 or […] 1 % ».",
    statutJuridique: 'Violation principale établie + nouveau risque procédural.',
    niveau: 'violation',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[7],
  },
  {
    seq: 9,
    date: '2026-08-02',
    types: ['action_systeme'],
    gravite: 3,
    titre: 'Bascule temporelle — application générale du règlement',
    description:
      "Le règlement devient pleinement applicable. Deux violations additionnelles se cristallisent sans aucun changement de comportement de Nexa : Art. 50(1) — ORELIA ne signale pas aux personnes qu'elles interagissent avec un système d'IA (et obligations corrélatives des déployeurs Art. 50(4) pour les contenus trompeurs) ; l'absence de réponse corrective maintient l'usage prohibé dans le temps. C'est une démonstration pédagogique clé : le même comportement change de statut juridique par le seul effet du calendrier de l'Art. 113.",
    citation:
      "« Providers shall ensure that AI systems intended to interact directly with natural persons are designed and developed in such a way that the natural persons concerned are informed that they are interacting with an AI system » (Art. 50(1)).",
    articleApplicable: "Art. 50(1) et (4) ; sanction Art. 99(4)(g) : jusqu'à 15 M€ / 3 %.",
    statutJuridique: 'Cumul de violations (Art. 5 + Art. 50).',
    niveau: 'violation',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[8],
  },
  {
    seq: 10,
    date: '2026-11-05',
    types: ['detection', 'consequence'],
    gravite: 4,
    titre: "L'enquête révèle la falsification du registre",
    description:
      "L'autorité confronte les logs fournis par Nexa aux exports du lanceur d'alerte : 214 entrées manquantes ou altérées entre avril et septembre 2025. Les hash chaînés du registre qualité externe (sauvegarde horodatée) prouvent la falsification. Nexa a en outre répondu à la demande d'information en affirmant que « la configuration n'a jamais été modifiée » — démenti documentairement.",
    citation: null,
    articleApplicable:
      "Art. 99(5) — informations inexactes et trompeuses aux autorités : jusqu'à 7,5 M€ / 1 %. Circonstances aggravantes cumulées : Art. 99(7)(e) (bénéfices tirés de l'infraction), (g) (mesures organisationnelles défaillantes), (i) (caractère intentionnel).",
    statutJuridique: 'Violation procédurale autonome, aggravante pour la principale.',
    niveau: 'violation',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[9],
  },
  {
    seq: 11,
    date: '2027-03-15',
    types: ['consequence'],
    gravite: 5,
    titre: 'Décision de sanction',
    description:
      "L'autorité prononce, sur le fondement du Chapitre XII (applicable depuis le 2 août 2025) : 1. Art. 99(3) pour violation de l'Art. 5 — amende jusqu'à 35 000 000 € ou 7 % du chiffre d'affaires mondial annuel, le plus élevé (plafond atténué pour PME par l'Art. 99(6), « whichever thereof is lower », mais la violation de l'Art. 5 reste dans le tier maximal) ; 2. Art. 99(4)(g) pour violation de l'Art. 50 — jusqu'à 15 M€ / 3 % ; 3. Art. 99(5) pour les réponses trompeuses — jusqu'à 7,5 M€ / 1 % ; 4. injonction de retrait de la configuration et mesures correctives (pouvoirs de surveillance du marché, en liaison avec le Règlement (UE) 2019/1020 visé à l'Art. 3(45-46) et Chapitre IX).",
    citation: null,
    articleApplicable: 'Art. 99(3), (4), (5), (6), (7).',
    statutJuridique: 'Sanction — fin de la chronologie.',
    niveau: 'sanction',
    estPointDeBascule: false,
    artefact: BASCULE_ARTEFACTS[10],
  },
]

/* ── Analyse du point de bascule (rapport §3) ─────────────────────── */

export interface BasculeCondition {
  numero: string
  texte: string
  atteinteDes: string
  analyse: string
}

export const POINT_DE_BASCULE = {
  titre: 'Pourquoi le 15 juillet 2025 et pas avant',
  intro:
    "Le test de l'Art. 5(1)(a) est cumulatif — les lignes directrices de la Commission (C(2025) 884, ¶60-61) exigent quatre conditions simultanées et un lien de causalité plausible entre technique, distortion et dommage.",
  conditions: [
    {
      numero: '(i)',
      texte: "« placing on the market / putting into service / use » d'un système d'IA",
      atteinteDes: '3 fév. 2025 (Év. 1)',
      analyse: 'remplie en permanence',
    },
    {
      numero: '(ii)',
      texte: 'techniques « subliminal, purposefully manipulative or deceptive »',
      atteinteDes: '2 avril 2025 (Év. 3)',
      analyse:
        "les instructions système sont conçues pour induire en erreur — élément « purposefully » satisfait par la finalité objective de la conception, indépendamment de l'intention de nuire (lignes directrices §3.2.1)",
    },
    {
      numero: '(iii)',
      texte:
        "objectif ou effet de distortion matérielle du comportement (décision que la personne n'aurait pas prise autrement)",
      atteinteDes: '20 mai 2025 (Év. 4)',
      analyse: '41 signatures directement corrélées aux sorties trompeuses',
    },
    {
      numero: '(iv)',
      texte: 'dommage significatif causé ou raisonnablement probable',
      atteinteDes: '15 juillet 2025 (Év. 6)',
      analyse:
        "le passage à l'échelle (ciblage massif des seniors, préjudice financier agrégé prévisible) rend le « significant harm » raisonnablement probable au moment du lancement",
    },
  ] as BasculeCondition[],
  argumentCle:
    "Entre mai et juin 2025, la qualification était déjà défendable (les 4 conditions pouvaient être plaidées), mais c'est le lancement de Silver Care qui rend la condition (iv) incontestable : à l'échelle individuelle (41 contrats, préjudices modiques), le seuil de « dommage significatif » restait discutable au regard des lignes directrices §3.5.2 ; à l'échelle de la campagne (12 400 conversations, population vulnérable ciblée, 1,9 M€/an de surprimes prévisibles), il est dépassé au moment même de la mise en usage — le texte exige seulement que le dommage soit « reasonably likely », non réalisé.",
  declencheur:
    "Le fait générateur n'est ni l'hallucination (Év. 2 — phénomène technique) ni le prompt (Év. 3 — acte préparatoire interne), mais l'usage du système ainsi configuré sur des personnes, avec les quatre conditions réunies. La violation est une violation d'usage (« the use of an AI system that deploys… ») : elle court à partir de l'exposition et se prolonge tant que l'usage continue.",
}

/* ── Analyse finale (rapport §4) ──────────────────────────────────── */

export const ANALYSE_FINALE = {
  hallucination: {
    titre: "L'hallucination seule n'est pas une violation",
    texte:
      "Le Règlement (UE) 2024/1689 ne sanctionne pas l'inexactitude en soi. Aucune disposition n'interdit à un système d'IA de « se tromper » : l'Art. 5 vise des pratiques (conduites d'opérateurs), pas des défauts de performance ; les lignes directrices C(2025) 884 (§3.5.2) excluent explicitement les systèmes manipulateurs/trompeurs « not likely to cause significant harm ». Le considérant 29 précise qu'on ne peut présumer l'intention de fausser le comportement lorsque la distortion « results from factors external to the AI system which are outside the control of the provider or the deployer, namely factors that may not be reasonably foreseeable » — une hallucination non anticipée relève précisément de ce cas. Pour le fournisseur du modèle GPAI, l'obligation est de documenter et atténuer (Art. 53 et Annexe XI ; Art. 55 pour les modèles à risque systémique), non de garantir l'exactitude.",
  },
  intention: {
    titre: "L'intention est le fait générateur — avec deux nuances",
    nuances: [
      "« Purposefully » qualifie la technique, pas nécessairement la volonté de nuire. Les lignes directrices (§3.2.1) et le considérant 29 établissent qu'il n'est pas nécessaire que le fournisseur/déployeur ait voulu causer le dommage : « it is not necessary for the provider or the deployer to have the intention to cause significant harm, provided that such harm results from the manipulative or exploitative AI-enabled practices » (cons. 29). Il suffit que la technique soit conçue ou vise objectivement à fausser le comportement. Dans « La Bascule », les instructions système d'avril 2025 satisfont ce critère — le directeur marketing n'a jamais « voulu » le préjudice des seniors, il a voulu la conversion.",
      "L'intention humaine reste décisive à deux étages : (a) dans la constitution de la violation, parce que c'est la décision de configurer et d'exposer qui fait passer le système d'un défaut technique à une « technique délibérément trompeuse » déployée par un opérateur responsable ; (b) dans la sanction, où « the intentional or negligent character of the infringement » est un critère exprès de fixation du montant (Art. 99(7)(i)) — c'est ce qui transforme, dans le scénario, une amende théorique en amende maximale.",
    ],
  },
  formule:
    "L'IA hallucine sans intention ; le droit ne punit pas l'hallucination. Le droit punit l'humain (ou la personne morale) qui, connaissant le défaut, le convertit en technique de tromperie et l'expose à autrui. La frontière de la légalité ne se situe ni dans le modèle ni dans la sortie, mais dans la chaîne « conception → décision → usage → dommage probable » — et c'est précisément cette chaîne que le registre d'audit hashé doit rendre traçable.",
  sanctions: [
    {
      fondement: 'Art. 99(3) — violation des pratiques interdites (Art. 5)',
      plafond: "35 000 000 € ou 7 % du CA mondial annuel, le plus élevé",
      note: "Plafond atténué pour PME par l'Art. 99(6), mais tier maximal.",
    },
    {
      fondement: 'Art. 99(4)(g) — obligations de transparence (Art. 50)',
      plafond: "15 000 000 € ou 3 % du CA mondial",
      note: "Applicable depuis la bascule temporelle du 2 août 2026 (Év. 9).",
    },
    {
      fondement: 'Art. 99(5) — informations trompeuses aux autorités',
      plafond: "7 500 000 € ou 1 % du CA mondial",
      note: 'Registre falsifié (214 entrées) et réponse mensongère à la demande d\'information.',
    },
  ],
  aggravants:
    "Circonstances aggravantes cumulées (Art. 99(7)) : (a) nombre de personnes affectées, (e) bénéfices tirés de l'infraction, (g) mesures organisationnelles défaillantes, (i) caractère intentionnel de l'infraction.",
  chaineCausale: [
    { etape: 'Hallucination', detail: 'Év. 2 — détectée, non imputable (cons. 29)' },
    { etape: 'Alerte qualité', detail: 'Év. 5 — étouffée par la direction' },
    { etape: "Prompt d'orientation", detail: 'Év. 3 — technique « purposefully » trompeuse' },
    { etape: 'Décision de continuer', detail: 'Év. 5 — élément moral établi' },
    { etape: 'Usage à grande échelle sur seniors', detail: 'Év. 6 — condition (iv) franchie' },
    { etape: 'Art. 5(1)(a) — violation caractérisée', detail: 'Sanction : Art. 99(3) — 35 M€ / 7 %' },
  ],
}
