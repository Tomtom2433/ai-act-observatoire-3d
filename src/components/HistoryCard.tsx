/**
 * Carte « Historique vérifiable » — historique complet d'une donnée.
 *
 * Dock gauche (mode COUCHES, réutilisable depuis NodeDetailPanel) :
 *  - en-tête : label, famille, état à T, nombre de versions, première /
 *    dernière apparition, leafHash courant copiable ;
 *  - « Tout vérifier » : pour chaque occurrence, racine Merkle recalculée
 *    + hash de version recalculé + chaînage prevHash → verdict global
 *    (✓ intègre / ✗ rompu à #vN — tient compte du sabotage éventuel)
 *    avec temps de calcul et pastille individuelle par ligne ;
 *  - table des versions : #v (clic → saut timeline), kind, heure réelle,
 *    date simulée, action, leafHash / racine / prev→hash courts copiables ;
 *  - preuve de Merkle de l'occurrence sélectionnée : étapes + positions,
 *    bouton « Vérifier la preuve ».
 */
import { useEffect, useMemo, useState } from 'react'
import { CATEGORIE_META, NODES } from '../data/aiActData'
import {
  buildMerkleTree,
  computeVersionHash,
  getProof,
  leafIndexInTree,
  shortHash,
  verifyProof,
} from '../lib/merkle'
import { tsOf } from '../lib/time'
import { getNodeHistory, useRegistry } from '../lib/versionStore'

const KIND_STYLE: Record<string, { label: string; color: string }> = {
  first: { label: 'first', color: '#ffca34' },
  modified: { label: 'modified', color: '#ff5872' },
  present: { label: 'present', color: '#8ab4ff' },
}

/** Hash tronqué copiable au clic (title = hash complet). */
function CopyHash({ label, hash }: { label: string; hash: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={`${label} : ${hash}\nCliquer pour copier`}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard?.writeText(hash)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 900)
      }}
      className="tnum font-mono text-[10px] text-white/55 transition-colors hover:text-[#ffca34]"
    >
      {copied ? 'copié ✓' : shortHash(hash)}
    </button>
  )
}

/** Pastille de verdict. */
function Chip({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${
        ok
          ? 'bg-[#00ffa3] shadow-[0_0_6px_rgba(0,255,163,0.7)]'
          : 'bg-[#ff3b30] shadow-[0_0_6px_rgba(255,59,48,0.8)]'
      }`}
      title={ok ? 'Version intègre' : 'Version rompue'}
    />
  )
}

interface VerifyAllResult {
  per: Map<number, boolean>
  ok: boolean
  brokenAt: number | null
  ms: number
}

interface HistoryCardProps {
  nodeId: string
  currentTs: number
  selectedVersionIndex: number | null
  /** Feuille précise sélectionnée (clic atome) — la preuve la cible. */
  selectedLeafId: string | null
  /** Quand ce compteur change, « Tout vérifier » est lancé (tuto démo). */
  autoVerifySignal?: number
  onSelectVersion: (i: number) => void
  onSeekDate: (iso: string) => void
  onClose: () => void
}

export default function HistoryCard({
  nodeId,
  currentTs,
  selectedVersionIndex,
  selectedLeafId,
  autoVerifySignal,
  onSelectVersion,
  onSeekDate,
  onClose,
}: HistoryCardProps) {
  const registry = useRegistry()
  const history = getNodeHistory(nodeId)
  const node = NODES.find((n) => n.id === nodeId)
  const [verify, setVerify] = useState<VerifyAllResult | null>(null)
  const [proofOk, setProofOk] = useState<boolean | null>(null)

  // Réinitialise les verdicts si le registre, le nœud ou la feuille change.
  useEffect(() => {
    setVerify(null)
    setProofOk(null)
  }, [nodeId, selectedLeafId, registry.versions])

  const selectedEntry =
    history.find((h) => h.versionIndex === selectedVersionIndex) ??
    history[history.length - 1] ??
    null

  /* Preuve de Merkle de l'occurrence sélectionnée — ciblée sur la feuille
     cliquée (atome), sinon sur la donnée elle-même. */
  const proof = useMemo(() => {
    if (!selectedEntry) return null
    const v = registry.versions.find((x) => x.index === selectedEntry.versionIndex)
    if (!v) return null
    const leafId = selectedLeafId ?? nodeId
    const leaf =
      v.leaves.find((l) => l.id === leafId) ?? v.leaves.find((l) => l.id === nodeId) ?? null
    if (!leaf) return null
    const idx = leafIndexInTree(v.levels, leaf.leafHash)
    if (idx < 0) return null
    return {
      versionIndex: v.index,
      merkleRoot: v.merkleRoot,
      leafLabel: leaf.label,
      proof: getProof(v.levels, idx),
    }
  }, [selectedEntry, selectedLeafId, nodeId, registry.versions])

  if (!node) return null
  const meta = CATEGORIE_META[node.categorie]
  const actif = node.actifDepuis === null || tsOf(node.actifDepuis) <= currentTs
  const first = history[0] ?? null
  const last = history[history.length - 1] ?? null

  /* Re-vérification de chaque occurrence : racine + hash + chaînage. */
  const runVerifyAll = () => {
    const t0 = performance.now()
    const versions = registry.versions
    const per = new Map<number, boolean>()
    let brokenAt: number | null = null
    const seen = new Set<number>()
    for (const entry of history) {
      if (seen.has(entry.versionIndex)) continue
      seen.add(entry.versionIndex)
      const pos = versions.findIndex((v) => v.index === entry.versionIndex)
      let ok = false
      if (pos >= 0) {
        const v = versions[pos]
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
        // L'ancre (position 0) n'a pas de chaînage vérifiable (cap FIFO).
        const linkOk = pos === 0 ? true : v.prevHash === versions[pos - 1].hash
        ok = rootOk && hashOk && linkOk
      }
      per.set(entry.versionIndex, ok)
      if (!ok && brokenAt === null) brokenAt = entry.versionIndex
    }
    setVerify({ per, ok: brokenAt === null, brokenAt, ms: performance.now() - t0 })
  }

  /* Signal externe (tuto démo) : lance « Tout vérifier » à sa place. */
  useEffect(() => {
    if (autoVerifySignal && autoVerifySignal > 0) runVerifyAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoVerifySignal])

  const verifyProofNow = () => {
    if (!proof) return
    setProofOk(verifyProof(proof.proof) && proof.proof.root === proof.merkleRoot)
  }

  /* Mini-cycle « état → re-hash → état ? » de la version sélectionnée :
     re-hachage RÉEL de l'en-tête comparé au hash ancré (spec §4). */
  const miniCycle = useMemo(() => {
    if (!selectedEntry) return null
    const v = registry.versions.find((x) => x.index === selectedEntry.versionIndex)
    if (!v) return null
    const recomputed = computeVersionHash({
      index: v.index,
      timestamp: v.timestamp,
      dateSimulee: v.dateSimulee,
      actionKind: v.actionKind,
      action: v.action,
      merkleRoot: v.merkleRoot,
      prevHash: v.prevHash,
    })
    return { versionIndex: v.index, ok: recomputed === v.hash }
  }, [selectedEntry, registry.versions])

  return (
    <div className="pointer-events-auto absolute bottom-[148px] left-4 top-[140px] z-30 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-[#ffca34]/20 bg-black/85 backdrop-blur-md">
      {/* ── En-tête ── */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-full border px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{
                color: meta.couleur,
                borderColor: `${meta.couleur}55`,
                backgroundColor: `${meta.couleur}14`,
              }}
            >
              {meta.label}
            </span>
            {actif ? (
              <span className="inline-flex items-center rounded-full border border-[#ffca34]/50 bg-[#ffca34]/12 px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em] text-[#ffca34]">
                Actif
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[#8ab4ff]/45 bg-[#8ab4ff]/12 px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em] text-[#8ab4ff]">
                Futur
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la carte d'historique"
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <h2 className="mt-2 text-[14px] font-semibold leading-snug text-[#f5f5f5]">
          {node.label}
        </h2>
        <p className="tnum mt-1 text-[10px] text-white/45">
          {history.length} version{history.length > 1 ? 's' : ''}
          {first && last && (
            <>
              {' · première #v'}
              {first.versionIndex} ({first.dateSimulee}) · dernière #v{last.versionIndex} (
              {last.dateSimulee})
            </>
          )}
        </p>
        {last && (
          <div className="tnum mt-1.5 flex items-center gap-2 font-mono text-[10px] text-white/40">
            <span>leafHash courant</span>
            <CopyHash label="leafHash courant" hash={last.leafHash} />
          </div>
        )}

        {/* Tout vérifier */}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={runVerifyAll}
            className="rounded-md border border-[#ffca34]/45 bg-[#ffca34]/10 px-3 py-1.5 text-[11px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/30"
          >
            Tout vérifier
          </button>
          {verify && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                verify.ok ? 'text-[#00ffa3]' : 'text-[#ff6b62]'
              }`}
            >
              <Chip ok={verify.ok} />
              {verify.ok ? '✓ intègre' : `✗ rompu à #v${verify.brokenAt}`}
              <span className="tnum font-mono text-[10px] text-white/35">
                · {verify.ms.toFixed(1)} ms
              </span>
            </span>
          )}
        </div>
      </div>

      {/* ── Contenu scrollable ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Table des versions */}
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
          Versions ({history.length})
        </div>
        <div className="mt-1.5 space-y-1.5">
          {history.map((entry) => {
            const ks = KIND_STYLE[entry.kind]
            const isSel = entry.versionIndex === selectedVersionIndex
            const verdict = verify?.per.get(entry.versionIndex)
            return (
              <div
                key={entry.versionIndex}
                onClick={() => onSelectVersion(entry.versionIndex)}
                className={`cursor-pointer rounded-md border p-2 transition-colors ${
                  isSel
                    ? 'border-[#ffca34]/50 bg-[#ffca34]/[0.08]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSeekDate(entry.dateSimulee)
                    }}
                    title={`Saut timeline au ${entry.dateSimulee}`}
                    className="tnum rounded border border-[#ffca34]/40 bg-[#ffca34]/10 px-1.5 py-[1px] font-mono text-[10px] font-semibold text-[#ffca34] transition-colors hover:bg-[#ffca34]/30"
                  >
                    #v{entry.versionIndex}
                  </button>
                  <span
                    className="rounded border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.08em]"
                    style={{
                      color: ks.color,
                      borderColor: `${ks.color}55`,
                      backgroundColor: `${ks.color}14`,
                    }}
                  >
                    {ks.label}
                  </span>
                  <span className="tnum ml-auto font-mono text-[9px] text-white/40">
                    {new Date(entry.timestamp).toLocaleTimeString('fr-FR')} · {entry.dateSimulee}
                  </span>
                  {verdict !== undefined && <Chip ok={verdict} />}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-white/55">{entry.action}</p>
                <div className="tnum mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] text-white/40">
                  <span>leaf</span>
                  <CopyHash label="leafHash" hash={entry.leafHash} />
                  <RootHashes versionIndex={entry.versionIndex} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Mini-cycle de la version sélectionnée : état → re-hash → état ? */}
        {miniCycle && (
          <div
            className="mini-cycle mt-4 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3"
            data-state={miniCycle.ok ? 'ok' : 'broken'}
          >
            <svg viewBox="0 0 120 120" className="h-[76px] w-[76px] shrink-0">
              {([0, 1, 2] as const).map((i) => {
                const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.28
                const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 3 - 0.28
                const [x0, y0] = [60 + 40 * Math.cos(a0), 60 + 40 * Math.sin(a0)]
                const [x1, y1] = [60 + 40 * Math.cos(a1), 60 + 40 * Math.sin(a1)]
                const last = i === 2
                const color = last
                  ? miniCycle.ok
                    ? '#00ffa3'
                    : '#ff3b30'
                  : 'rgba(255,255,255,0.3)'
                return (
                  <path
                    key={i}
                    d={`M ${x0.toFixed(1)} ${y0.toFixed(1)} A 40 40 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={last ? 2.2 : 1.2}
                    strokeDasharray={last && !miniCycle.ok ? '4 3' : undefined}
                  />
                )
              })}
              {(['état', 're-hash', 'état ?'] as const).map((label, i) => {
                const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3
                const [x, y] = [60 + 40 * Math.cos(a), 60 + 40 * Math.sin(a)]
                const isFinal = i === 2
                const color = isFinal
                  ? miniCycle.ok
                    ? '#00ffa3'
                    : '#ff3b30'
                  : 'rgba(255,255,255,0.5)'
                return (
                  <g key={label}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isFinal ? 7 : 5.5}
                      fill={isFinal ? (miniCycle.ok ? 'rgba(0,255,163,0.2)' : 'rgba(255,59,48,0.2)') : 'rgba(255,255,255,0.08)'}
                      stroke={color}
                      strokeWidth={isFinal ? 1.6 : 1}
                    />
                    <text
                      x={x}
                      y={y + (i === 0 ? -12 : 16)}
                      textAnchor="middle"
                      fontSize="7.5"
                      fontFamily="ui-monospace, monospace"
                      fill={color}
                    >
                      {label}
                    </text>
                  </g>
                )
              })}
            </svg>
            <div className="min-w-0">
              <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
                Cycle — version #v{miniCycle.versionIndex}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-white/55">
                L'en-tête ancré est re-haché et comparé au hash de la version.
              </p>
              <p
                className={`mt-1 text-[10px] font-medium ${
                  miniCycle.ok ? 'text-[#00ffa3]' : 'text-[#ff6b62]'
                }`}
              >
                {miniCycle.ok
                  ? '✓ cycle fermé — hash identique'
                  : '✗ cycle ouvert — le re-hash diffère (donnée altérée ?)'}
              </p>
            </div>
          </div>
        )}

        {/* Preuve de Merkle de l'occurrence sélectionnée */}
        {proof && (
          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                Preuve de Merkle — {proof.leafLabel.length > 28 ? proof.leafLabel.slice(0, 27) + '…' : proof.leafLabel} · #v{proof.versionIndex}
              </span>
              {proofOk !== null && <Chip ok={proofOk} />}
            </div>
            <div className="tnum mt-1.5 space-y-[3px] font-mono text-[9px] text-white/45">
              {proof.proof.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-white/30">étape {i + 1}</span>
                  <span
                    className={`rounded border px-1 py-[1px] text-[8px] uppercase ${
                      s.position === 'left'
                        ? 'border-[#8ab4ff]/40 text-[#8ab4ff]'
                        : 'border-[#ffca34]/40 text-[#ffca34]'
                    }`}
                  >
                    {s.position === 'left' ? 'gauche' : 'droite'}
                  </span>
                  <CopyHash label={`Frère étape ${i + 1}`} hash={s.sibling} />
                </div>
              ))}
              <div className="flex items-center gap-1.5 border-t border-white/10 pt-1.5">
                <span className="w-12 shrink-0 text-white/30">racine</span>
                <CopyHash label="Racine de Merkle" hash={proof.merkleRoot} />
              </div>
            </div>
            <button
              type="button"
              onClick={verifyProofNow}
              className="mt-2 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/75 transition-colors hover:bg-white/15"
            >
              Vérifier la preuve
            </button>
            {proofOk !== null && (
              <span
                className={`ml-2 text-[10px] font-medium ${
                  proofOk ? 'text-[#00ffa3]' : 'text-[#ff6b62]'
                }`}
              >
                {proofOk ? 'preuve valide' : 'preuve invalide'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Racine courte + chaînage prev→hash d'une version (lecture store). */
function RootHashes({ versionIndex }: { versionIndex: number }) {
  const registry = useRegistry()
  const v = registry.versions.find((x) => x.index === versionIndex)
  if (!v) return null
  return (
    <>
      <span>racine</span>
      <CopyHash label="Racine de Merkle" hash={v.merkleRoot} />
      <span>prev→hash</span>
      <CopyHash label="Hash du bloc précédent" hash={v.prevHash} />
      <span className="text-white/30">→</span>
      <CopyHash label="Hash de ce bloc" hash={v.hash} />
    </>
  )
}
