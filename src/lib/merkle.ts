/**
 * Registre « blockchain-like » — briques cryptographiques.
 *
 * Implémentation maison (~150 lignes) adossée à @noble/hashes@2.4.0 :
 *  - sha256 synchrone, 0 dépendance, tout en Uint8Array (aucun Buffer) ;
 *  - arbre de Merkle binaire + preuves d'inclusion O(log n) ;
 *  - chaîne de versions (hash chain) façon transparency log (RFC 6962) / git.
 *
 * Pièges évités (cf. veille-blockchain-merkle.md §8) :
 *  - import v2 : '@noble/hashes/sha2.js' (sous-chemin avec extension) ;
 *  - concaténation des hashs EN BYTES, jamais en hex ;
 *  - JSON canonique (clés triées récursivement) avant hachage ;
 *  - séparation de domaine : feuilles préfixées par type ('node:'…),
 *    nœuds internes préfixés 0x01.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'

/* ── Hash de base ─────────────────────────────────────────────────── */

export function sha256Hex(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? utf8ToBytes(input) : input
  return bytesToHex(sha256(bytes))
}

/* ── JSON canonique (clés triées récursivement, sans espaces) ────── */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/* ── Feuilles canoniques — les « molécules » ─────────────────────── */

export type LeafType = 'node' | 'link' | 'milestone' | 'famille'

export interface Leaf {
  /** Identifiant métier stable (ex. 'art-5', 'art-5->manipulation:interdit'). */
  id: string
  type: LeafType
  /** JSON déterministe préfixé par le type (séparation de domaine). */
  canonical: string
  /** sha256 hex de `canonical` — adresse de contenu de la molécule. */
  leafHash: string
  /** Charge utile lisible (pour l'UI et la recherche plein texte). */
  label: string
  text: string
}

export function hashLeaf(
  id: string,
  type: LeafType,
  payload: Record<string, unknown>,
  label: string,
  text: string,
): Leaf {
  const canonical = `${type}:${stableStringify({ id, ...payload })}`
  return { id, type, canonical, leafHash: sha256Hex(canonical), label, text }
}

/* ── Arbre de Merkle binaire ──────────────────────────────────────── */

/** Hash d'un nœud interne : sha256(0x01 ‖ bytes(gauche) ‖ bytes(droite)). */
function hashPair(leftHex: string, rightHex: string): string {
  return bytesToHex(sha256(concatBytes(Uint8Array.of(0x01), hexToBytes(leftHex), hexToBytes(rightHex))))
}

export interface MerkleTree {
  root: string
  /** levels[0] = feuilles (hex), levels[levels.length-1] = [root]. */
  levels: string[][]
}

/**
 * Construit l'arbre. Les feuilles sont triées par hash pour une racine
 * déterministe indépendante de l'ordre d'insertion. Nombre impair : le
 * dernier hash est dupliqué (convention Bitcoin).
 */
export function buildMerkleTree(leaves: Leaf[]): MerkleTree {
  const base = leaves.map((l) => l.leafHash).sort()
  if (base.length === 0) {
    const empty = sha256Hex('empty')
    return { root: empty, levels: [[empty]] }
  }
  const levels: string[][] = [base]
  let current = base
  while (current.length > 1) {
    const next: string[] = []
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = i + 1 < current.length ? current[i + 1] : left
      next.push(hashPair(left, right))
    }
    levels.push(next)
    current = next
  }
  return { root: current[0], levels }
}

/* ── Preuves d'inclusion ──────────────────────────────────────────── */

export interface ProofStep {
  /** Hash hex du frère dans la paire. */
  sibling: string
  /** Position du frère : 'left' = le frère est à gauche du nœud courant. */
  position: 'left' | 'right'
}

export interface MerkleProof {
  leafHash: string
  leafIndex: number
  steps: ProofStep[]
  root: string
}

export function getProof(levels: string[][], leafIndex: number): MerkleProof {
  const steps: ProofStep[] = []
  let idx = leafIndex
  for (let level = 0; level < levels.length - 1; level++) {
    const hashes = levels[level]
    const isRightNode = idx % 2 === 1
    const siblingIdx = isRightNode ? idx - 1 : idx + 1
    const sibling = siblingIdx < hashes.length ? hashes[siblingIdx] : hashes[idx]
    steps.push({ sibling, position: isRightNode ? 'left' : 'right' })
    idx = Math.floor(idx / 2)
  }
  return {
    leafHash: levels[0][leafIndex],
    leafIndex,
    steps,
    root: levels[levels.length - 1][0],
  }
}

export function verifyProof(proof: MerkleProof): boolean {
  let acc = proof.leafHash
  for (const step of proof.steps) {
    acc = step.position === 'left' ? hashPair(step.sibling, acc) : hashPair(acc, step.sibling)
  }
  return acc === proof.root
}

/** Index d'une feuille dans le niveau 0 trié, ou -1. */
export function leafIndexInTree(levels: string[][], leafHash: string): number {
  return levels[0].indexOf(leafHash)
}

/* ── Chaîne de versions (hash chain) ─────────────────────────────── */

export type ActionKind =
  | 'init'
  | 'timeJump'
  | 'milestoneClick'
  | 'nodeClick'
  | 'familleToggle'
  | 'basculeEvent'

export interface Version {
  index: number
  /** Horodatage réel (ms epoch). */
  timestamp: number
  /** Date simulée T de la timeline (ISO yyyy-mm-dd). */
  dateSimulee: string
  actionKind: ActionKind
  /** Libellé FR de l'action. */
  action: string
  leaves: Leaf[]
  merkleRoot: string
  prevHash: string
  hash: string
  /** Niveaux de l'arbre (conservés pour générer les preuves sans recalcul). */
  levels: string[][]
}

export const GENESIS_PREV_HASH = '0'.repeat(64)

/** Hash d'une version : sha256 du JSON canonique de son en-tête. */
export function computeVersionHash(v: {
  index: number
  timestamp: number
  dateSimulee: string
  actionKind: ActionKind
  action: string
  merkleRoot: string
  prevHash: string
}): string {
  return sha256Hex(
    `version:${stableStringify({
      index: v.index,
      timestamp: v.timestamp,
      dateSimulee: v.dateSimulee,
      actionKind: v.actionKind,
      action: v.action,
      merkleRoot: v.merkleRoot,
      prevHash: v.prevHash,
    })}`,
  )
}

export interface ChainStatus {
  /** Par version : intègre ou non (racine recalculée + chaînage). */
  statuses: boolean[]
  ok: boolean
  /** Index de la première version invalide, ou null. */
  brokenAt: number | null
}

/**
 * Re-hache toute la chaîne : racine de Merkle recalculée à partir des
 * feuilles stockées, hash de version recalculé, continuité prevHash.
 * La version 0 est l'ancre (son prevHash n'est pas vérifié : l'historique
 * antérieur peut avoir été élagué par le cap FIFO).
 * Invalidation en cascade : dès qu'une version est rompue, toutes les
 * versions aval sont marquées invalides — elles chaînent sur un engagement
 * falsifié, la confiance ne peut pas être rétablie sans réécriture.
 */
export function verifyChain(versions: Version[]): ChainStatus {
  const statuses: boolean[] = []
  let brokenAt: number | null = null
  let upstreamOk = true
  for (let i = 0; i < versions.length; i++) {
    const v = versions[i]
    const rootOk = buildMerkleTree(v.leaves).root === v.merkleRoot
    const hashOk =
      computeVersionHash({
        index: v.index,
        timestamp: v.timestamp,
        dateSimulee: v.dateSimulee,
        actionKind: v.actionKind,
        action: v.action,
        merkleRoot: v.merkleRoot,
        prevHash: v.prevHash,
      }) === v.hash
    const linkOk = i === 0 ? true : v.prevHash === versions[i - 1].hash
    const ownOk = rootOk && hashOk && linkOk
    if (!ownOk && brokenAt === null) brokenAt = i
    const ok: boolean = ownOk && upstreamOk
    statuses.push(ok)
    upstreamOk = ok
  }
  return { statuses, ok: brokenAt === null, brokenAt }
}

/* ── Diff entre versions ──────────────────────────────────────────── */

export interface VersionDiff {
  added: Leaf[]
  removed: Leaf[]
  /** Même id, hash différent. */
  changed: Array<{ id: string; before: Leaf; after: Leaf }>
}

export function diffVersions(a: Version, b: Version): VersionDiff {
  const mapA = new Map(a.leaves.map((l) => [l.id, l]))
  const mapB = new Map(b.leaves.map((l) => [l.id, l]))
  const added: Leaf[] = []
  const removed: Leaf[] = []
  const changed: Array<{ id: string; before: Leaf; after: Leaf }> = []
  for (const [id, lb] of mapB) {
    const la = mapA.get(id)
    if (!la) added.push(lb)
    else if (la.leafHash !== lb.leafHash) changed.push({ id, before: la, after: lb })
  }
  for (const [id, la] of mapA) {
    if (!mapB.has(id)) removed.push(la)
  }
  return { added, removed, changed }
}

/* ── Chaîne d'événements (registre d'incident, chaîne parallèle) ─── */

export interface EventChainEntry {
  seq: number
  /** Date de l'événement (ISO). */
  date: string
  kind: string
  /** JSON canonique de l'artefact. */
  canonical: string
  prevEventHash: string
  hash: string
}

/**
 * Convention du rapport « La Bascule » :
 * hash = SHA256(bytes(prev_hash) ‖ bytes(canonical_json(evt))).
 * Le prev_hash du premier événement est la chaîne littérale 'GENESIS'.
 */
export function computeEventHash(prevEventHash: string, canonical: string): string {
  const prevBytes = /^[0-9a-f]{64}$/.test(prevEventHash)
    ? hexToBytes(prevEventHash)
    : utf8ToBytes(prevEventHash)
  return bytesToHex(sha256(concatBytes(prevBytes, utf8ToBytes(canonical))))
}

export function verifyEventChain(entries: EventChainEntry[]): boolean {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (computeEventHash(e.prevEventHash, e.canonical) !== e.hash) return false
    if (i > 0 && e.prevEventHash !== entries[i - 1].hash) return false
  }
  return true
}

/* ── Divers ───────────────────────────────────────────────────────── */

export function shortHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}
