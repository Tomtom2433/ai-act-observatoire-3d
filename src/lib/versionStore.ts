/**
 * Registre de versions — store maison (useSyncExternalStore, zéro dépendance).
 *
 * Chaque action significative (saut de timeline, clic jalon, clic nœud,
 * toggle famille) crée une « version » chaînée par hash et engagée sur un
 * arbre de Merkle des feuilles canoniques de l'état visible.
 *
 * Cap FIFO : MAX_VERSIONS ; la version 0 restante devient l'ancre
 * (son prevHash pointe vers une version élaguée, comme un checkpoint).
 */
import { useSyncExternalStore } from 'react'
import { LINKS, NODES, CATEGORIE_META, type NodeCategorie } from '../data/aiActData'
import {
  GENESIS_PREV_HASH,
  buildMerkleTree,
  computeVersionHash,
  diffVersions,
  hashLeaf,
  sha256Hex,
  verifyChain,
  type ActionKind,
  type ChainStatus,
  type Leaf,
  type Version,
  type VersionDiff,
} from './merkle'

export const MAX_VERSIONS = 200

/* ── Construction des feuilles de l'état visible ──────────────────── */

export function nodeLeaf(id: string): Leaf {
  const n = NODES.find((x) => x.id === id)!
  return hashLeaf(
    n.id,
    'node',
    { label: n.label, categorie: n.categorie, actifDepuis: n.actifDepuis },
    n.label,
    `${n.label} ${n.description} ${CATEGORIE_META[n.categorie].label}`,
  )
}

export function linkLeaf(source: string, target: string, relation: string): Leaf {
  return hashLeaf(
    `${source}->${target}:${relation}`,
    'link',
    { source, target, relation },
    `${source} → ${target}`,
    `${source} ${target} ${relation.replace(/_/g, ' ')}`,
  )
}

export function familleLeaf(cat: NodeCategorie, visible: boolean): Leaf {
  return hashLeaf(
    `famille:${cat}`,
    'famille',
    { visible },
    `Famille « ${CATEGORIE_META[cat].label} »`,
    `${CATEGORIE_META[cat].label} famille toggle ${visible ? 'visible' : 'masquee'}`,
  )
}

/** Feuilles canoniques : nœuds visibles + liens visibles + toggles famille. */
export function buildStateLeaves(
  visibleNodeIds: Set<string>,
  famillesVisibles: Set<NodeCategorie>,
): Leaf[] {
  const leaves: Leaf[] = []
  for (const n of NODES) {
    if (visibleNodeIds.has(n.id)) leaves.push(nodeLeaf(n.id))
  }
  for (const l of LINKS) {
    if (visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)) {
      leaves.push(linkLeaf(l.source, l.target, l.relation))
    }
  }
  for (const cat of Object.keys(CATEGORIE_META) as NodeCategorie[]) {
    leaves.push(familleLeaf(cat, famillesVisibles.has(cat)))
  }
  return leaves
}

/* ── Artefact dupliqué au clic nœud ───────────────────────────────── */

/** Nœud + ses liens incidents + nœuds adjacents = artefact inspectable. */
export function buildNodeArtifactLeaves(nodeId: string): Leaf[] {
  const ids = new Set<string>([nodeId])
  const links = LINKS.filter((l) => l.source === nodeId || l.target === nodeId)
  for (const l of links) {
    ids.add(l.source)
    ids.add(l.target)
  }
  const leaves: Leaf[] = []
  for (const id of ids) leaves.push(nodeLeaf(id))
  for (const l of links) leaves.push(linkLeaf(l.source, l.target, l.relation))
  return leaves
}

/* ── Store ────────────────────────────────────────────────────────── */

export interface SabotageInfo {
  versionIndex: number
  leafIndex: number
  original: Leaf
}

interface RegistryState {
  versions: Version[]
  sabotage: SabotageInfo | null
  verification: ChainStatus | null
}

let state: RegistryState = { versions: [], sabotage: null, verification: null }
const listeners = new Set<() => void>()

function setState(next: Partial<RegistryState>) {
  state = { ...state, ...next }
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getState(): RegistryState {
  return state
}

export function useRegistry(): RegistryState {
  return useSyncExternalStore(subscribe, getState)
}

/* ── API ──────────────────────────────────────────────────────────── */

export function commitVersion(
  actionKind: ActionKind,
  action: string,
  leaves: Leaf[],
  dateSimulee: string,
): Version {
  const prev = state.versions[state.versions.length - 1]
  const index = prev ? prev.index + 1 : 0
  const tree = buildMerkleTree(leaves)
  const header = {
    index,
    timestamp: Date.now(),
    dateSimulee,
    actionKind,
    action,
    merkleRoot: tree.root,
    prevHash: prev ? prev.hash : GENESIS_PREV_HASH,
  }
  const version: Version = {
    ...header,
    leaves,
    levels: tree.levels,
    hash: computeVersionHash(header),
  }
  let versions = [...state.versions, version]
  if (versions.length > MAX_VERSIONS) versions = versions.slice(versions.length - MAX_VERSIONS)
  setState({ versions, verification: null })
  return version
}

export function initGenesis(leaves: Leaf[], dateSimulee: string): void {
  if (state.versions.length > 0) return
  commitVersion('init', "Genèse — chargement de l'observatoire", leaves, dateSimulee)
}

/** Re-hachage complet de la chaîne (bouton « Vérifier la chaîne »). */
export function runVerification(): ChainStatus {
  const verification = verifyChain(state.versions)
  setState({ verification })
  return verification
}

/**
 * Sabotage de démonstration : altère silencieusement une feuille d'une
 * version passée (sans recalculer la racine) → la re-vérification montre
 * l'invalidation en cascade à partir de cette version.
 */
export function sabotage(): SabotageInfo | null {
  if (state.sabotage) return state.sabotage
  const versions = state.versions
  // Cible : une version intermédiaire avec des feuilles (la cascade doit être visible).
  const pool = versions.filter((v, i) => i > 0 && i < versions.length - 2 && v.leaves.length > 2)
  if (pool.length === 0) return null
  const target = pool[Math.floor(pool.length / 2)]
  const leafIndex = Math.floor(target.leaves.length / 2)
  const original = target.leaves[leafIndex]
  const forged: Leaf = {
    ...original,
    canonical: original.canonical.replace(':', ':SABOTE_'),
    leafHash: sha256Hex(original.canonical + '#sabote'),
    label: original.label + ' (altérée)',
  }
  const nextVersions = versions.map((v) =>
    v.index === target.index
      ? { ...v, leaves: v.leaves.map((l, i) => (i === leafIndex ? forged : l)) }
      : v,
  )
  const sabotageInfo: SabotageInfo = { versionIndex: target.index, leafIndex, original }
  setState({ versions: nextVersions, sabotage: sabotageInfo, verification: null })
  return sabotageInfo
}

/** Réparation : restaure la feuille d'origine. */
export function repair(): void {
  const s = state.sabotage
  if (!s) return
  const nextVersions = state.versions.map((v) =>
    v.index === s.versionIndex
      ? { ...v, leaves: v.leaves.map((l, i) => (i === s.leafIndex ? s.original : l)) }
      : v,
  )
  setState({ versions: nextVersions, sabotage: null, verification: null })
}

/* ── Recherche moléculaire ────────────────────────────────────────── */

export interface LeafOccurrence {
  versionIndex: number
  leafIndex: number
  action: string
  timestamp: number
  dateSimulee: string
}

/** Index inverse leafHash → occurrences, reconstruit à la demande. */
export function buildLeafIndex(versions: Version[]): Map<string, LeafOccurrence[]> {
  const index = new Map<string, LeafOccurrence[]>()
  for (const v of versions) {
    v.leaves.forEach((leaf, leafIndex) => {
      const occ = {
        versionIndex: v.index,
        leafIndex,
        action: v.action,
        timestamp: v.timestamp,
        dateSimulee: v.dateSimulee,
      }
      const arr = index.get(leaf.leafHash)
      if (arr) arr.push(occ)
      else index.set(leaf.leafHash, [occ])
    })
  }
  return index
}

export interface TextHit {
  leaf: Leaf
  occurrences: LeafOccurrence[]
  firstVersion: number | null
  lastVersion: number | null
  /** Version la plus récente contenant la feuille (pour la preuve). */
  proofVersion: number | null
}

/** Recherche plein texte sur les feuilles de l'état courant + historique récent. */
export function searchByText(fragment: string, currentLeaves: Leaf[]): TextHit[] {
  const q = fragment.trim().toLowerCase()
  if (q.length < 2) return []
  const index = buildLeafIndex(state.versions)
  const hits: TextHit[] = []
  const seen = new Set<string>()
  const pools: Leaf[][] = [currentLeaves, ...state.versions.slice(-3).map((v) => v.leaves)]
  for (const pool of pools) {
    for (const leaf of pool) {
      if (seen.has(leaf.id) || !leaf.text.toLowerCase().includes(q)) continue
      seen.add(leaf.id)
      const occ = index.get(leaf.leafHash) ?? []
      hits.push({
        leaf,
        occurrences: occ,
        firstVersion: occ.length ? occ[0].versionIndex : null,
        lastVersion: occ.length ? occ[occ.length - 1].versionIndex : null,
        proofVersion: occ.length ? occ[occ.length - 1].versionIndex : null,
      })
      if (hits.length >= 12) return hits
    }
  }
  return hits
}

export type HashHitKind = 'leaf' | 'root' | 'version'

export interface HashHit {
  kind: HashHitKind
  versionIndex: number
  leafIndex?: number
  hash: string
  label: string
}

/** Recherche par préfixe de hash : feuille, racine Merkle ou hash de version. */
export function searchByHash(prefix: string): HashHit[] {
  const p = prefix.trim().toLowerCase()
  if (p.length < 4) return []
  const hits: HashHit[] = []
  for (const v of state.versions) {
    if (v.hash.startsWith(p)) {
      hits.push({ kind: 'version', versionIndex: v.index, hash: v.hash, label: v.action })
    }
    if (v.merkleRoot.startsWith(p)) {
      hits.push({
        kind: 'root',
        versionIndex: v.index,
        hash: v.merkleRoot,
        label: `Racine Merkle de v${v.index}`,
      })
    }
    v.leaves.forEach((leaf, leafIndex) => {
      if (leaf.leafHash.startsWith(p)) {
        hits.push({
          kind: 'leaf',
          versionIndex: v.index,
          leafIndex,
          hash: leaf.leafHash,
          label: leaf.label,
        })
      }
    })
    if (hits.length >= 20) return hits
  }
  return hits
}

/** Statut « modifiée entre vX et vY » pour une molécule (même id). */
export function findModification(
  leafId: string,
): { from: number; to: number; diff: VersionDiff } | null {
  const versions = state.versions
  for (let i = 0; i < versions.length - 1; i++) {
    const a = versions[i]
    const b = versions[i + 1]
    const la = a.leaves.find((l) => l.id === leafId)
    const lb = b.leaves.find((l) => l.id === leafId)
    if (la && lb && la.leafHash !== lb.leafHash) {
      return { from: a.index, to: b.index, diff: diffVersions(a, b) }
    }
  }
  return null
}

export function getVersionByIndex(index: number): Version | null {
  return state.versions.find((v) => v.index === index) ?? null
}

/* ── Historique orbital d'un nœud (mode Plongée) ──────────────────── */

export interface NodeHistoryEntry {
  versionIndex: number
  leafHash: string
  action: string
  timestamp: number
  dateSimulee: string
  /** 'first' = première apparition, 'modified' = hash différent de la
      précédente apparition, 'present' = inchangée. */
  kind: 'first' | 'modified' | 'present'
}

/** Toutes les apparitions d'une molécule (par id métier) dans le registre. */
export function getNodeHistory(nodeId: string): NodeHistoryEntry[] {
  const out: NodeHistoryEntry[] = []
  let prevHash: string | null = null
  for (const v of state.versions) {
    const leaf = v.leaves.find((l) => l.id === nodeId)
    if (!leaf) continue
    const kind: NodeHistoryEntry['kind'] =
      prevHash === null ? 'first' : leaf.leafHash !== prevHash ? 'modified' : 'present'
    out.push({
      versionIndex: v.index,
      leafHash: leaf.leafHash,
      action: v.action,
      timestamp: v.timestamp,
      dateSimulee: v.dateSimulee,
      kind,
    })
    prevHash = leaf.leafHash
  }
  return out
}

/** Nombre de versions du registre (hook léger pour les panneaux). */
export function getVersionCount(): number {
  return state.versions.length
}
