/**
 * Dataset — Règlement européen sur l'IA (EU AI Act, Règlement (UE) 2024/1689)
 * Source : eu-ai-act-dataset.md (recherche vérifiée le 15 septembre 2026).
 * Dates à jour du « Digital Omnibus on AI » — Règlement (UE) 2026/1744 :
 * Annexe III → 02/12/2027, Annexe I → 02/08/2028.
 */

export type NodeCategorie =
  | 'niveau_risque'
  | 'pratique_interdite'
  | 'categorie_systeme'
  | 'instrument'
  | 'annexe'
  | 'obligation'
  | 'acteur'
  | 'sanction'
  | 'article'

export interface ActNode {
  id: string
  label: string
  categorie: NodeCategorie
  description: string
  /** Date d'activation temporelle ISO, ou null = jamais contraignant (toujours visible). */
  actifDepuis: string | null
}

export interface ActLink {
  source: string
  target: string
  relation: string
}

export type MilestoneCategorie = 'legislatif' | 'application' | 'gouvernance'

export interface Milestone {
  date: string
  titre: string
  description: string
  categorie: MilestoneCategorie
  sourceUrl: string
  sourceLabel: string
}

export const CATEGORIE_META: Record<NodeCategorie, { label: string; couleur: string }> = {
  niveau_risque: { label: 'Niveaux de risque', couleur: '#00d5e9' },
  pratique_interdite: { label: 'Pratiques interdites', couleur: '#ff5872' },
  categorie_systeme: { label: 'Modèles GPAI', couleur: '#b98cff' },
  instrument: { label: 'Instruments', couleur: '#00ffa3' },
  annexe: { label: 'Annexes', couleur: '#7feb00' },
  obligation: { label: 'Obligations', couleur: '#ffca34' },
  acteur: { label: 'Acteurs', couleur: '#ff8a3d' },
  sanction: { label: 'Sanctions', couleur: '#ff3b30' },
  article: { label: 'Articles clés', couleur: '#8ab4ff' },
}

export const MILESTONE_CATEGORIE_META: Record<MilestoneCategorie, { label: string; couleur: string }> = {
  legislatif: { label: 'Législatif', couleur: '#8ab4ff' },
  application: { label: 'Application', couleur: '#ffca34' },
  gouvernance: { label: 'Gouvernance', couleur: '#00ffa3' },
}

export const NODES: ActNode[] = [
  // ── Niveaux de risque ──────────────────────────────────────────────
  {
    id: 'risque-inacceptable',
    label: 'Risque inacceptable',
    categorie: 'niveau_risque',
    description:
      "Pratiques d'IA interdites car contraires aux valeurs de l'UE et aux droits fondamentaux (Art. 5).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'risque-eleve',
    label: 'Haut risque',
    categorie: 'niveau_risque',
    description:
      'Systèmes soumis à des exigences strictes (gestion des risques, données, documentation, contrôle humain…) avant mise sur le marché (Art. 6 + Annexes I & III). Application : 2 déc. 2027 (Annexe III) et 2 août 2028 (Annexe I), dates modifiées par le Digital Omnibus.',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'risque-limite',
    label: 'Risque limité (transparence)',
    categorie: 'niveau_risque',
    description:
      "Systèmes soumis à des obligations de transparence : informer l'utilisateur qu'il interagit avec une IA, étiqueter les contenus synthétiques et deepfakes (Art. 50).",
    actifDepuis: '2026-08-02',
  },
  {
    id: 'risque-minimal',
    label: 'Risque minimal',
    categorie: 'niveau_risque',
    description:
      "La grande majorité des systèmes d'IA (filtres anti-spam, jeux vidéo…) : aucune obligation nouvelle, codes de conduite volontaires possibles (Art. 95). Jamais contraignant.",
    actifDepuis: null,
  },

  // ── Pratiques interdites (Art. 5) — toutes actives depuis le 02/02/2025 ──
  {
    id: 'manipulation',
    label: 'Manipulation subliminale',
    categorie: 'pratique_interdite',
    description:
      'Techniques subliminales, manipulatrices ou trompeuses altérant substantiellement le comportement et causant un préjudice significatif (Art. 5(1)(a)).',
    actifDepuis: '2025-02-02',
  },
  {
    id: 'exploitation-vulnerabilites',
    label: 'Exploitation des vulnérabilités',
    categorie: 'pratique_interdite',
    description:
      "Exploitation des vulnérabilités liées à l'âge, au handicap ou à une situation sociale (Art. 5(1)(b)).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'notation-sociale',
    label: 'Notation sociale (« social scoring »)',
    categorie: 'pratique_interdite',
    description:
      "Évaluation/classification de personnes sur la base de leur comportement social entraînant un traitement défavorable injustifié (Art. 5(1)(c)).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'police-predictive',
    label: 'Prédiction des infractions pénales',
    categorie: 'pratique_interdite',
    description:
      "Évaluation du risque de commission d'infractions fondée uniquement sur le profilage ou les traits de personnalité (Art. 5(1)(d)).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'moissonnage-facial',
    label: "Moissonnage d'images faciales",
    categorie: 'pratique_interdite',
    description:
      "Constitution de bases de données de reconnaissance faciale par moissonnage non ciblé d'images issues d'internet ou de vidéosurveillance (Art. 5(1)(e)).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'reconnaissance-emotions',
    label: 'Reconnaissance des émotions (travail/école)',
    categorie: 'pratique_interdite',
    description:
      "Systèmes de reconnaissance des émotions sur le lieu de travail et dans l'enseignement, sauf raisons médicales ou de sécurité (Art. 5(1)(f)).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'categorisation-biometrique',
    label: 'Catégorisation biométrique sensible',
    categorie: 'pratique_interdite',
    description:
      'Catégorisation biométrique inférant des données sensibles (race, opinions politiques, orientation sexuelle…) (Art. 5(1)(g)).',
    actifDepuis: '2025-02-02',
  },
  {
    id: 'identification-biometrique-temps-reel',
    label: 'Identification biométrique en temps réel',
    categorie: 'pratique_interdite',
    description:
      'Identification biométrique à distance en temps réel dans les espaces publics à des fins répressives, sauf exceptions strictement encadrées (Art. 5(1)(h)).',
    actifDepuis: '2025-02-02',
  },

  // ── Modèles GPAI ───────────────────────────────────────────────────
  {
    id: 'gpai',
    label: "Modèles d'IA à usage général (GPAI)",
    categorie: 'categorie_systeme',
    description:
      'Modèles polyvalents (type GPT, Gemini, Llama, Mistral) soumis à des obligations de transparence, documentation technique et respect du droit d\'auteur (Art. 53).',
    actifDepuis: '2025-08-02',
  },
  {
    id: 'gpai-risque-systemique',
    label: 'GPAI à risque systémique',
    categorie: 'categorie_systeme',
    description:
      "GPAI dont la capacité cumulée d'entraînement dépasse 10^25 FLOP (ou désignés par la Commission) : évaluation des risques systémiques, tests adverses, notification d'incidents graves (Art. 51, 55).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'code-pratique-gpai',
    label: 'Code de bonnes pratiques GPAI',
    categorie: 'instrument',
    description:
      'Outil volontaire (Art. 56) : transparence, droit d\'auteur, sûreté & sécurité. Publié le 10 juillet 2025, déclaré adéquat le 1er août 2025 ; la signature donne une présomption de conformité.',
    actifDepuis: '2025-08-01',
  },

  // ── Annexes ────────────────────────────────────────────────────────
  {
    id: 'annexe-iii',
    label: 'Annexe III — domaines haut risque',
    categorie: 'annexe',
    description:
      '8 domaines : biométrie ; infrastructures critiques ; éducation/formation ; emploi/gestion des travailleurs ; services essentiels privés et publics (crédit, assurance) ; répression des infractions ; migration/asile/frontières ; justice et processus démocratiques.',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'annexe-i',
    label: 'Annexe I — produits réglementés',
    categorie: 'annexe',
    description:
      "Systèmes d'IA intégrés comme composants de sécurité dans des produits couverts par la législation d'harmonisation de l'UE (machines, dispositifs médicaux, jouets, aviation, véhicules…).",
    actifDepuis: '2028-08-02',
  },

  // ── Obligations haut risque et conformité ──────────────────────────
  {
    id: 'gestion-risques',
    label: 'Système de gestion des risques',
    categorie: 'obligation',
    description:
      "Processus itératif continu d'identification, d'analyse et d'atténuation des risques tout au long du cycle de vie (Art. 9).",
    actifDepuis: '2027-12-02',
  },
  {
    id: 'exigences-techniques',
    label: 'Exigences techniques (Art. 10-15)',
    categorie: 'obligation',
    description:
      'Gouvernance des données (Art. 10), documentation technique (Art. 11), journaux (Art. 12), transparence et information (Art. 13), contrôle humain (Art. 14), exactitude/robustesse/cybersécurité (Art. 15).',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'controle-humain',
    label: 'Contrôle humain',
    categorie: 'obligation',
    description:
      "Les systèmes haut risque doivent pouvoir être supervisés efficacement par des humains, y compris la possibilité d'ignorer ou d'interrompre le système (Art. 14).",
    actifDepuis: '2027-12-02',
  },
  {
    id: 'evaluation-conformite',
    label: 'Évaluation de la conformité',
    categorie: 'obligation',
    description:
      "Procédure d'évaluation de la conformité avant mise sur le marché — contrôle interne ou intervention d'un organisme notifié (Art. 43, Annexe VI/VII).",
    actifDepuis: '2027-12-02',
  },
  {
    id: 'marquage-ce',
    label: 'Marquage CE',
    categorie: 'obligation',
    description:
      'Les systèmes haut risque conformes portent le marquage CE, signe de conformité aux exigences du règlement (Art. 48).',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'enregistrement-base-ue',
    label: 'Enregistrement — base de données UE',
    categorie: 'obligation',
    description:
      "Les fournisseurs enregistrent leurs systèmes haut risque dans la base de données de l'UE avant mise sur le marché (Art. 49, 71). Non reporté par le Digital Omnibus.",
    actifDepuis: '2026-08-02',
  },
  {
    id: 'obligations-fournisseurs',
    label: 'Obligations des fournisseurs',
    categorie: 'obligation',
    description:
      'Système de gestion de la qualité, documentation, conformité, enregistrement, déclaration UE de conformité, marquage CE, signalement des incidents graves (Art. 16-25, 73).',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'obligations-deployeurs',
    label: 'Obligations des déployeurs',
    categorie: 'obligation',
    description:
      'Utiliser le système conformément aux instructions, assurer la surveillance humaine, surveiller le fonctionnement, conserver les journaux, informer les personnes exposées (Art. 26).',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'analyse-impact-droits',
    label: 'Analyse d\'impact sur les droits fondamentaux',
    categorie: 'obligation',
    description:
      'Requise avant le déploiement pour certains déployeurs (organismes publics, crédit, assurance) (Art. 27).',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'transparence-art50',
    label: 'Obligations de transparence',
    categorie: 'obligation',
    description:
      "Informer lorsqu'on interagit avec une IA ; marquage lisible par machine des contenus synthétiques ; étiquetage des deepfakes ; information pour la reconnaissance des émotions et la catégorisation biométrique (Art. 50).",
    actifDepuis: '2026-08-02',
  },
  {
    id: 'maitrise-ia',
    label: 'Maîtrise de l\'IA (« AI literacy »)',
    categorie: 'obligation',
    description:
      'Les fournisseurs et déployeurs doivent garantir un niveau suffisant de maîtrise de l\'IA de leur personnel (Art. 4).',
    actifDepuis: '2025-02-02',
  },
  {
    id: 'bacs-a-sable',
    label: 'Bacs à sable réglementaires',
    categorie: 'instrument',
    description:
      'Chaque État membre doit mettre en place au moins un bac à sable pour tester des systèmes innovants sous supervision (Art. 57). Échéance reportée au 2 août 2027 par le Digital Omnibus.',
    actifDepuis: '2027-08-02',
  },

  // ── Acteurs ────────────────────────────────────────────────────────
  {
    id: 'ai-office',
    label: "AI Office (Bureau européen de l'IA)",
    categorie: 'acteur',
    description:
      'Organe au sein de la Commission (créé par la décision C(2024) 390 du 24 janv. 2024, opérationnel le 21 fév. 2024 ; Art. 64 du règlement). Supervise et sanctionne exclusivement les modèles GPAI (Art. 88-94). Pouvoirs d\'exécution à partir du 2 août 2026.',
    actifDepuis: '2024-02-21',
  },
  {
    id: 'comite-ia',
    label: 'Comité IA (AI Board)',
    categorie: 'acteur',
    description:
      "Un représentant par État membre ; conseille et coordonne l'application cohérente du règlement (Art. 65-66).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'autorites-nationales',
    label: 'Autorités nationales compétentes',
    categorie: 'acteur',
    description:
      'Autorités de surveillance du marché et organismes notificateurs désignés par chaque État membre (Art. 70) — date limite de désignation : 2 août 2025.',
    actifDepuis: '2025-08-02',
  },
  {
    id: 'panel-scientifique',
    label: 'Panel scientifique',
    categorie: 'acteur',
    description:
      "Panel d'experts indépendants qui alerte sur les risques systémiques des GPAI et assiste l'AI Office (Art. 68).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'forum-consultatif',
    label: 'Forum consultatif',
    categorie: 'acteur',
    description:
      'Parties prenantes (industrie, PME, société civile, monde académique) conseillant le comité IA et la Commission (Art. 67).',
    actifDepuis: '2025-08-02',
  },
  {
    id: 'fournisseurs',
    label: 'Fournisseurs (providers)',
    categorie: 'acteur',
    description:
      "Développent un système/modèle d'IA et le mettent sur le marché sous leur nom ; portent l'essentiel des obligations (Art. 16). Actifs dès le 2 août 2025 (GPAI), puis 2 déc. 2027 (haut risque).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'deployeurs',
    label: 'Déployeurs (deployers)',
    categorie: 'acteur',
    description:
      "Entités utilisant un système d'IA sous leur propre autorité dans un cadre professionnel (ex. employeurs, banques) ; obligations de l'Art. 26.",
    actifDepuis: '2027-12-02',
  },
  {
    id: 'organismes-notifies',
    label: 'Organismes notifiés',
    categorie: 'acteur',
    description:
      "Organismes tiers d'évaluation de la conformité pour certains systèmes haut risque (Art. 43 ; chap. III section 4).",
    actifDepuis: '2025-08-02',
  },

  // ── Sanctions ──────────────────────────────────────────────────────
  {
    id: 'sanctions-art99',
    label: 'Sanctions (Art. 99)',
    categorie: 'sanction',
    description:
      "Trois niveaux d'amendes administratives, calculés sur le chiffre d'affaires mondial annuel du groupe. Pour les PME/startups, c'est le montant le plus faible qui s'applique (Art. 99(6)).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'amende-35m',
    label: 'Amende max. 35 M€ / 7 %',
    categorie: 'sanction',
    description:
      "Violation des pratiques interdites (Art. 5) : jusqu'à 35 M€ ou 7 % du CA mondial annuel, le montant le plus élevé étant retenu (Art. 99(3)).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'amende-15m',
    label: 'Amende max. 15 M€ / 3 %',
    categorie: 'sanction',
    description:
      "Non-respect des autres obligations (haut risque, transparence Art. 50, GPAI…) : jusqu'à 15 M€ ou 3 % du CA mondial (Art. 99(4)).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'amende-7-5m',
    label: 'Amende max. 7,5 M€ / 1 %',
    categorie: 'sanction',
    description:
      "Fourniture d'informations incorrectes, incomplètes ou trompeuses aux autorités ou organismes notifiés : jusqu'à 7,5 M€ ou 1 % du CA mondial (Art. 99(5)).",
    actifDepuis: '2025-08-02',
  },
  {
    id: 'sanctions-gpai-art101',
    label: 'Sanctions GPAI (Art. 101)',
    categorie: 'sanction',
    description:
      "Pour les fournisseurs de GPAI, seule la Commission (via l'AI Office) peut infliger jusqu'à 15 M€ ou 3 % du CA mondial.",
    actifDepuis: '2026-08-02',
  },

  // ── Articles clés ──────────────────────────────────────────────────
  {
    id: 'art-5',
    label: 'Article 5 — Pratiques interdites',
    categorie: 'article',
    description: "Liste des pratiques d'IA interdites (risque inacceptable).",
    actifDepuis: '2025-02-02',
  },
  {
    id: 'art-6',
    label: 'Article 6 — Classification haut risque',
    categorie: 'article',
    description:
      'Deux voies de classification : Art. 6(1) + Annexe I (produits réglementés) et Art. 6(2) + Annexe III (domaines listés). Application : 2 déc. 2027 / 2 août 2028.',
    actifDepuis: '2027-12-02',
  },
  {
    id: 'art-26-27',
    label: 'Articles 26-27 — Déployeurs',
    categorie: 'article',
    description:
      "Obligations des déployeurs (26) et analyse d'impact sur les droits fondamentaux (27).",
    actifDepuis: '2027-12-02',
  },
  {
    id: 'art-50',
    label: 'Article 50 — Transparence',
    categorie: 'article',
    description:
      'Obligations de transparence pour les systèmes interagissant avec des humains, générant des contenus synthétiques, deepfakes, reconnaissance des émotions.',
    actifDepuis: '2026-08-02',
  },
  {
    id: 'art-53-55',
    label: 'Articles 53-55 — GPAI',
    categorie: 'article',
    description:
      'Obligations des fournisseurs de GPAI (53), représentants (54), obligations supplémentaires risque systémique (55).',
    actifDepuis: '2025-08-02',
  },
  {
    id: 'art-99',
    label: 'Article 99 — Sanctions',
    categorie: 'article',
    description: 'Régime de sanctions administratives à trois niveaux.',
    actifDepuis: '2025-08-02',
  },
  {
    id: 'art-113',
    label: 'Article 113 — Entrée en vigueur et application',
    categorie: 'article',
    description:
      "Définit l'entrée en vigueur (1er août 2024) et le calendrier d'application échelonné, modifié par le Règlement (UE) 2026/1744.",
    actifDepuis: '2024-08-01',
  },
  {
    id: 'digital-omnibus',
    label: 'Digital Omnibus on AI — Règlement (UE) 2026/1744',
    categorie: 'instrument',
    description:
      "Premier acte modificatif de l'AI Act (adopté le 8 juillet 2026, en vigueur le 27 juillet 2026) : report des échéances haut risque (Annexe III → 2 déc. 2027, Annexe I → 2 août 2028, bacs à sable → 2 août 2027), création de la catégorie « small mid-cap », ajustements Art. 4, 50 et 111.",
    actifDepuis: '2026-07-27',
  },
]

export const LINKS: ActLink[] = [
  // ── Structure des risques ──
  { source: 'risque-inacceptable', target: 'art-5', relation: 'interdit_par' },
  { source: 'risque-eleve', target: 'art-6', relation: 'classifie_par' },
  { source: 'risque-eleve', target: 'annexe-iii', relation: 'inclut' },
  { source: 'risque-eleve', target: 'annexe-i', relation: 'inclut' },
  { source: 'risque-limite', target: 'art-50', relation: 'regi_par' },
  { source: 'risque-minimal', target: 'risque-eleve', relation: 'hors_champ_obligations' },

  // ── Pratiques interdites ──
  { source: 'art-5', target: 'manipulation', relation: 'interdit' },
  { source: 'art-5', target: 'exploitation-vulnerabilites', relation: 'interdit' },
  { source: 'art-5', target: 'notation-sociale', relation: 'interdit' },
  { source: 'art-5', target: 'police-predictive', relation: 'interdit' },
  { source: 'art-5', target: 'moissonnage-facial', relation: 'interdit' },
  { source: 'art-5', target: 'reconnaissance-emotions', relation: 'interdit' },
  { source: 'art-5', target: 'categorisation-biometrique', relation: 'interdit' },
  { source: 'art-5', target: 'identification-biometrique-temps-reel', relation: 'interdit' },
  { source: 'manipulation', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'exploitation-vulnerabilites', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'notation-sociale', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'police-predictive', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'moissonnage-facial', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'reconnaissance-emotions', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'categorisation-biometrique', target: 'risque-inacceptable', relation: 'est_un' },
  { source: 'identification-biometrique-temps-reel', target: 'risque-inacceptable', relation: 'est_un' },

  // ── Obligations haut risque ──
  { source: 'risque-eleve', target: 'gestion-risques', relation: 'impose' },
  { source: 'risque-eleve', target: 'exigences-techniques', relation: 'impose' },
  { source: 'risque-eleve', target: 'controle-humain', relation: 'impose' },
  { source: 'risque-eleve', target: 'evaluation-conformite', relation: 'impose' },
  { source: 'risque-eleve', target: 'marquage-ce', relation: 'impose' },
  { source: 'risque-eleve', target: 'enregistrement-base-ue', relation: 'impose' },
  { source: 'exigences-techniques', target: 'controle-humain', relation: 'comprend' },
  { source: 'evaluation-conformite', target: 'marquage-ce', relation: 'aboutit_a' },
  { source: 'evaluation-conformite', target: 'organismes-notifies', relation: 'peut_impliquer' },
  { source: 'art-26-27', target: 'deployeurs', relation: 's_applique_a' },
  { source: 'obligations-fournisseurs', target: 'fournisseurs', relation: 's_applique_a' },
  { source: 'analyse-impact-droits', target: 'deployeurs', relation: 'incombe_a' },

  // ── GPAI ──
  { source: 'gpai', target: 'art-53-55', relation: 'regi_par' },
  { source: 'gpai-risque-systemique', target: 'gpai', relation: 'est_sous_categorie_de' },
  { source: 'gpai', target: 'code-pratique-gpai', relation: 'peut_demontrer_conformite_via' },
  { source: 'code-pratique-gpai', target: 'art-53-55', relation: 'facilite' },
  { source: 'ai-office', target: 'gpai', relation: 'supervise' },
  { source: 'ai-office', target: 'sanctions-gpai-art101', relation: 'sanctionne' },
  { source: 'panel-scientifique', target: 'gpai-risque-systemique', relation: 'alerte_sur' },

  // ── Gouvernance et acteurs ──
  { source: 'ai-office', target: 'autorites-nationales', relation: 'coordonne' },
  { source: 'comite-ia', target: 'autorites-nationales', relation: 'regroupe' },
  { source: 'comite-ia', target: 'ai-office', relation: 'conseille' },
  { source: 'forum-consultatif', target: 'comite-ia', relation: 'conseille' },
  { source: 'autorites-nationales', target: 'risque-eleve', relation: 'surveillent' },
  { source: 'autorites-nationales', target: 'art-5', relation: 'font_respecter' },
  { source: 'fournisseurs', target: 'obligations-fournisseurs', relation: 'doivent' },
  { source: 'deployeurs', target: 'obligations-deployeurs', relation: 'doivent' },
  { source: 'bacs-a-sable', target: 'autorites-nationales', relation: 'encadres_par' },

  // ── Sanctions ──
  { source: 'art-5', target: 'amende-35m', relation: 'sanctionne_par' },
  { source: 'risque-eleve', target: 'amende-15m', relation: 'sanctionne_par' },
  { source: 'transparence-art50', target: 'amende-15m', relation: 'sanctionne_par' },
  { source: 'sanctions-art99', target: 'amende-35m', relation: 'comprend' },
  { source: 'sanctions-art99', target: 'amende-15m', relation: 'comprend' },
  { source: 'sanctions-art99', target: 'amende-7-5m', relation: 'comprend' },
  { source: 'art-99', target: 'sanctions-art99', relation: 'definit' },

  // ── Dimension temporelle / évolution ──
  { source: 'art-113', target: 'risque-inacceptable', relation: 'ordonne_le_calendrier_de' },
  { source: 'art-113', target: 'gpai', relation: 'ordonne_le_calendrier_de' },
  { source: 'art-113', target: 'risque-eleve', relation: 'ordonne_le_calendrier_de' },
  { source: 'digital-omnibus', target: 'art-113', relation: 'modifie' },
  { source: 'digital-omnibus', target: 'annexe-iii', relation: 'reporte' },
  { source: 'digital-omnibus', target: 'annexe-i', relation: 'reporte' },
  { source: 'digital-omnibus', target: 'bacs-a-sable', relation: 'reporte' },
  { source: 'maitrise-ia', target: 'art-5', relation: 'activee_en_meme_temps_que' },
]

export const MILESTONES: Milestone[] = [
  {
    date: '2021-04-21',
    titre: 'Proposition de la Commission',
    description:
      "La Commission européenne publie la proposition de règlement établissant des règles harmonisées sur l'IA (COM(2021) 206), premier cadre juridique complet au monde sur l'IA, fondé sur une approche par les risques.",
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-regulation-on-artificial-intelligence',
    sourceLabel: 'European Parliament — Legislative Train',
  },
  {
    date: '2022-12-06',
    titre: 'Approche générale du Conseil',
    description:
      "Le Conseil de l'UE adopte sa position commune (« general approach ») : définition de l'IA resserrée, interdiction de la notation sociale étendue aux acteurs privés, premières dispositions sur l'IA à usage général.",
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-regulation-on-artificial-intelligence',
    sourceLabel: 'European Parliament — Legislative Train',
  },
  {
    date: '2023-06-14',
    titre: 'Position du Parlement européen',
    description:
      "Le Parlement adopte sa position de négociation en plénière (499 voix pour, 28 contre, 93 abstentions) : liste des pratiques interdites élargie, régulation des modèles de fondation, création d'un AI Office.",
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-regulation-on-artificial-intelligence',
    sourceLabel: 'European Parliament — Legislative Train',
  },
  {
    date: '2023-06-15',
    titre: 'Trilogues',
    description:
      "Négociations interinstitutionnelles Parlement / Conseil / Commission (sessions en juin, juillet, septembre, octobre et décembre 2023). La régulation des modèles de fondation est le point le plus controversé (opposition FR/DE/IT à une régulation stricte).",
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-regulation-on-artificial-intelligence',
    sourceLabel: 'European Parliament — Legislative Train',
  },
  {
    date: '2023-12-09',
    titre: 'Accord politique provisoire',
    description:
      "Après un marathon de négociation de ~36 heures, la présidence du Conseil et les négociateurs du Parlement concluent un accord politique provisoire sur l'AI Act.",
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-regulation-on-artificial-intelligence',
    sourceLabel: 'European Parliament — Legislative Train',
  },
  {
    date: '2024-01-24',
    titre: "Création de l'AI Office",
    description:
      "Décision de la Commission C(2024) 390 du 24 janvier 2024 ; l'office devient opérationnel le 21 février 2024 au sein de la DG CNECT.",
    categorie: 'gouvernance',
    sourceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/ai-office',
    sourceLabel: 'Commission européenne',
  },
  {
    date: '2024-02-13',
    titre: 'Vote en commissions IMCO/LIBE',
    description:
      "Les commissions du marché intérieur (IMCO) et des libertés civiles (LIBE) du Parlement approuvent le texte de compromis issu des trilogues (approbation des États membres au Coreper le 2 février 2024).",
    categorie: 'legislatif',
    sourceUrl: 'https://www.degruyter.com/document/doi/10.1515/ijdlg-2024-0008/html',
    sourceLabel: 'De Gruyter — IJDLG',
  },
  {
    date: '2024-03-13',
    titre: 'Adoption par le Parlement',
    description:
      "Le Parlement européen adopte formellement l'AI Act en plénière : 523 voix pour, 46 contre, 49 abstentions.",
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-regulation-on-artificial-intelligence',
    sourceLabel: 'European Parliament — Legislative Train',
  },
  {
    date: '2024-05-21',
    titre: 'Adoption par le Conseil',
    description:
      "Le Conseil de l'UE adopte formellement le règlement — dernière étape de la procédure législative ordinaire.",
    categorie: 'legislatif',
    sourceUrl: 'https://policyreview.info/articles/analysis/general-purpose-ai-regulation-and-ai-act',
    sourceLabel: 'Internet Policy Review',
  },
  {
    date: '2024-06-13',
    titre: 'Signature du règlement',
    description:
      'Le Règlement (UE) 2024/1689 est signé par les co-législateurs (Parlement et Conseil).',
    categorie: 'legislatif',
    sourceUrl:
      'https://www.europeansources.info/record/proposal-for-a-regulation-laying-down-harmonised-rules-on-artificial-intelligence-artificial-intelligence-act-and-amending-certain-union-legislative-acts/',
    sourceLabel: 'European Sources Online',
  },
  {
    date: '2024-07-12',
    titre: 'Publication au JOUE',
    description:
      "Publication au Journal officiel de l'Union européenne (JO L, 2024/1689, 12.7.2024 ; ELI : http://data.europa.eu/eli/reg/2024/1689/oj).",
    categorie: 'legislatif',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN-FR/TXT/?uri=CELEX%3A32024R1689',
    sourceLabel: 'EUR-Lex',
  },
  {
    date: '2024-08-01',
    titre: 'Entrée en vigueur',
    description:
      "L'AI Act entre en vigueur (20 jours après publication, Art. 113). Aucune obligation n'est encore applicable : l'application est échelonnée.",
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2024-07-12/eng',
    sourceLabel: 'EUR-Lex — Art. 113',
  },
  {
    date: '2024-11-02',
    titre: 'Autorités de protection des droits fondamentaux',
    description:
      'Date limite pour que les États membres identifient les autorités de protection des droits fondamentaux.',
    categorie: 'gouvernance',
    sourceUrl: 'https://artificialintelligenceact.eu/implementation-timeline/',
    sourceLabel: 'Implementation Timeline',
  },
  {
    date: '2025-02-02',
    titre: "Interdictions + maîtrise de l'IA",
    description:
      "Application des chapitres I et II : interdictions des pratiques à risque inacceptable (Art. 5) et obligation de maîtrise de l'IA (« AI literacy », Art. 4). Exception : les interdictions sur les images intimes non consenties et le CSAM (Art. 5(1) points (ba)/(bb), 5(1a)/(1b)) s'appliqueront le 2 déc. 2026.",
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 113',
  },
  {
    date: '2025-07-10',
    titre: 'Code de bonnes pratiques GPAI publié',
    description:
      "L'AI Office publie la version finale du Code de bonnes pratiques pour les modèles d'IA à usage général (chapitres Transparence, Droits d'auteur, Sûreté & Sécurité), outil volontaire pour démontrer la conformité aux Art. 53 et 55.",
    categorie: 'gouvernance',
    sourceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai',
    sourceLabel: 'Commission européenne',
  },
  {
    date: '2025-08-01',
    titre: 'Code GPAI déclaré adéquat',
    description:
      "La Commission et le comité IA (AI Board) confirment que le Code de bonnes pratiques GPAI est un outil volontaire adéquat pour démontrer la conformité à l'AI Act.",
    categorie: 'gouvernance',
    sourceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai',
    sourceLabel: 'Commission européenne',
  },
  {
    date: '2025-08-02',
    titre: 'Obligations GPAI + gouvernance + sanctions',
    description:
      'Application du chap. III section 4 (organismes notifiés), chap. V (modèles GPAI, Art. 51-56), chap. VII (gouvernance), chap. XII (sanctions, sauf Art. 101) et Art. 78. Les États membres doivent désigner leurs autorités nationales compétentes et établir leurs règles de sanctions.',
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 113',
  },
  {
    date: '2026-02-02',
    titre: "Lignes directrices sur l'Art. 6",
    description:
      'Date limite pour les lignes directrices de la Commission sur la mise en œuvre pratique de l\'Art. 6.',
    categorie: 'gouvernance',
    sourceUrl: 'https://artificialintelligenceact.eu/implementation-timeline/',
    sourceLabel: 'Implementation Timeline',
  },
  {
    date: '2026-07-27',
    titre: 'Digital Omnibus on AI en vigueur',
    description:
      'Le Règlement (UE) 2026/1744 (publié au JOUE le 24 juillet 2026, adopté le 8 juillet 2026) entre en vigueur et modifie le calendrier : obligations haut risque Annexe III reportées au 2 déc. 2027, Annexe I au 2 août 2028, bacs à sable (Art. 57) au 2 août 2027. Dates inconditionnelles (le mécanisme conditionnel lié aux normes harmonisées a été abandonné).',
    categorie: 'legislatif',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — texte consolidé 2026-07-27',
  },
  {
    date: '2026-08-02',
    titre: 'Application générale du règlement',
    description:
      "Date d'application générale (Art. 113, par. 2) : obligations de transparence (Art. 50), enregistrement en base UE (Art. 49, hors report), pouvoirs de surveillance et d'exécution de l'AI Office sur les GPAI, amendes GPAI (Art. 101).",
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 113',
  },
  {
    date: '2026-12-02',
    titre: 'Interdictions CSAM + fin période de grâce transparence',
    description:
      'Application des interdictions sur les systèmes générant des images intimes non consenties et du matériel pédopornographique (CSAM). Fin du délai de grâce pour les systèmes génératifs mis sur le marché avant le 2 août 2026 (conformité Art. 50(2) — marquage lisible par machine).',
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 113',
  },
  {
    date: '2027-08-02',
    titre: 'Conformité GPAI préexistants + bacs à sable',
    description:
      'Les fournisseurs de modèles GPAI mis sur le marché avant le 2 août 2025 doivent être conformes (Art. 111(3)). Les États membres doivent avoir établi au moins un bac à sable réglementaire national (Art. 57, date modifiée par le Digital Omnibus).',
    categorie: 'application',
    sourceUrl: 'https://artificialintelligenceact.eu/implementation-timeline/',
    sourceLabel: 'Implementation Timeline',
  },
  {
    date: '2027-12-02',
    titre: 'Obligations haut risque — Annexe III',
    description:
      'Application des chap. III sections 1-3 (exigences Art. 8-15, obligations fournisseurs/déployeurs Art. 16-27) pour les systèmes haut risque au sens de l\'Art. 6(2) et de l\'Annexe III (biométrie, infrastructures critiques, éducation, emploi, services essentiels, répression, migration, justice). Date modifiée par le Digital Omnibus (initialement 2 août 2026).',
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 113 consolidé',
  },
  {
    date: '2028-08-02',
    titre: 'Obligations haut risque — Annexe I',
    description:
      "Application du régime haut risque pour les systèmes intégrés comme composants de sécurité de produits réglementés (Annexe I : machines, dispositifs médicaux, aviation, véhicules…) au sens de l'Art. 6(1). Date modifiée par le Digital Omnibus (initialement 2 août 2027).",
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 113 consolidé',
  },
  {
    date: '2030-08-02',
    titre: 'Systèmes des autorités publiques préexistants',
    description:
      'Les fournisseurs et déployeurs de systèmes haut risque destinés aux autorités publiques, mis sur le marché avant les dates d\'application, doivent être conformes au plus tard à cette date (Art. 111(2), tel que modifié).',
    categorie: 'application',
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng',
    sourceLabel: 'EUR-Lex — Art. 111 consolidé',
  },
]

/** Début de la plage temporelle de l'observatoire. */
export const RANGE_START = '2021-04-21'
/** Fin de la plage temporelle de l'observatoire. */
export const RANGE_END = '2030-12-31'

/** Timestamp d'activation d'un nœud (null → toujours actif). */
export function activationTs(node: ActNode): number {
  return node.actifDepuis ? new Date(node.actifDepuis + 'T00:00:00Z').getTime() : Number.NEGATIVE_INFINITY
}
