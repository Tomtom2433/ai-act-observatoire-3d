/**
 * Panneau « Neurone » — affiché pendant la plongée.
 * Identité du nœud, historique des versions (première/dernière apparition,
 * modifications), état courant et preuve de Merkle rejouable.
 */
import { useMemo, useState } from 'react'
import { CATEGORIE_META, NODES } from '../data/aiActData'
import { formatDateShort, tsOf } from '../lib/time'
import { getProof, leafIndexInTree, shortHash, verifyProof } from '../lib/merkle'
import { getNodeHistory, getVersionByIndex, useRegistry } from '../lib/versionStore'

interface NeuronPanelProps {
  nodeId: string
  currentTs: number
  onSurface: () => void
  onSeekVersion: (iso: string) => void
}

const KIND_LABEL: Record<string, { label: string; couleur: string }> = {
  first: { label: '1ʳᵉ apparition', couleur: '#ffca34' },
  modified: { label: 'modifiée', couleur: '#ff5872' },
  present: { label: 'inchangée', couleur: '#9a9aad' },
}

export default function NeuronPanel({ nodeId, currentTs, onSurface, onSeekVersion }: NeuronPanelProps) {
  const { versions } = useRegistry()
  const [proofCheck, setProofCheck] = useState<boolean | null>(null)

  const node = NODES.find((n) => n.id === nodeId)
  const history = useMemo(() => getNodeHistory(nodeId), [nodeId, versions])

  const proof = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const v = getVersionByIndex(history[i].versionIndex)
      if (!v) continue
      const idx = leafIndexInTree(v.levels, history[i].leafHash)
      if (idx >= 0) return { proof: getProof(v.levels, idx), versionIndex: v.index }
    }
    return null
  }, [history])

  if (!node) return null
  const meta = CATEGORIE_META[node.categorie]
  const actif = node.actifDepuis === null || tsOf(node.actifDepuis) <= currentTs
  const nbModified = history.filter((h) => h.kind === 'modified').length

  return (
    <div className="pointer-events-auto absolute bottom-[150px] left-4 z-30 flex max-h-[calc(100vh-330px)] w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[#ffca34]/40 bg-black/80 backdrop-blur-md shadow-[0_0_30px_rgba(255,202,52,0.12)]">
      <div className="border-b border-white/10 p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#ffca34]">
            Plongée — Neurone
          </div>
          <button
            type="button"
            onClick={onSurface}
            className="rounded-md border border-[#ffca34]/40 bg-[#ffca34]/10 px-2.5 py-1 text-[10px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/25"
            title="Échap ou double-clic dans le vide"
          >
            Refaire surface ↑
          </button>
        </div>
        <h2 className="mt-2 text-[15px] font-semibold leading-snug text-[#f5f5f5]">{node.label}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full border px-2 py-[2px] text-[9px] font-medium uppercase tracking-[0.12em]"
            style={{
              color: meta.couleur,
              borderColor: `${meta.couleur}55`,
              backgroundColor: `${meta.couleur}14`,
            }}
          >
            {meta.label}
          </span>
          <span
            className={`rounded-full border px-2 py-[2px] text-[9px] font-medium uppercase tracking-[0.12em] ${
              actif
                ? 'border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]'
                : 'border-white/25 bg-white/5 text-white/45'
            }`}
          >
            {actif ? 'actif à T' : 'futur (fantôme)'}
          </span>
        </div>
        <p className="tnum mt-1.5 text-[11px] text-white/45">
          {node.actifDepuis === null
            ? 'Toujours visible — jamais contraignant'
            : `Actif depuis le ${formatDateShort(tsOf(node.actifDepuis))}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        {/* Historique */}
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Historique — {history.length} version{history.length > 1 ? 's' : ''}
          </div>
          {nbModified > 0 && (
            <span className="text-[10px] text-[#ff8ba0]">{nbModified} modification{nbModified > 1 ? 's' : ''}</span>
          )}
        </div>
        {history.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-white/40">
            Aucune version du registre ne contient encore cette molécule.
          </p>
        ) : (
          <>
            <p className="tnum mt-1 text-[11px] text-white/55">
              Première apparition : v{history[0].versionIndex} · dernière : v
              {history[history.length - 1].versionIndex}
            </p>
            <ul className="mt-2 space-y-[3px]">
              {history.map((h) => {
                const k = KIND_LABEL[h.kind]
                return (
                  <li key={`${h.versionIndex}-${h.leafHash.slice(0, 8)}`}>
                    <button
                      type="button"
                      onClick={() => onSeekVersion(h.dateSimulee)}
                      className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors hover:border-[#ffca34]/40 hover:bg-[#ffca34]/10"
                      title={`Ramener la timeline au ${h.dateSimulee}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: k.couleur }} />
                        <span className="tnum text-[11px] font-semibold text-[#ffca34]">v{h.versionIndex}</span>
                        <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: k.couleur }}>
                          {k.label}
                        </span>
                        <span className="tnum ml-auto font-mono text-[9px] text-white/30">
                          {shortHash(h.leafHash, 6, 4)}
                        </span>
                      </div>
                      <div className="mt-[2px] truncate pl-[15px] text-[10px] text-white/50">{h.action}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* Preuve de Merkle */}
        {proof && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                Preuve de Merkle — v{proof.versionIndex}
              </div>
              <button
                type="button"
                onClick={() => setProofCheck(verifyProof(proof.proof))}
                className="rounded-md border border-[#ffca34]/40 bg-[#ffca34]/10 px-2 py-1 text-[10px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/25"
              >
                Vérifier
              </button>
            </div>
            <ol className="tnum mt-2 space-y-1 font-mono text-[10px]">
              <li className="flex items-center gap-2 text-[#ffca34]">
                <span className="w-14 shrink-0 text-white/35">feuille</span>
                <span className="truncate">{shortHash(proof.proof.leafHash, 10, 6)}</span>
              </li>
              {proof.proof.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-white/50">
                  <span className="w-14 shrink-0 text-white/35">
                    {s.position === 'left' ? '← gauche' : 'droite →'}
                  </span>
                  <span className="truncate">{shortHash(s.sibling, 10, 6)}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 border-t border-white/10 pt-1 text-white/70">
                <span className="w-14 shrink-0 text-white/35">racine</span>
                <span className="truncate">{shortHash(proof.proof.root, 10, 6)}</span>
              </li>
            </ol>
            {proofCheck !== null && (
              <p
                className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
                  proofCheck
                    ? 'border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]'
                    : 'border-[#ff3b30]/40 bg-[#ff3b30]/10 text-[#ff6b62]'
                }`}
              >
                {proofCheck ? '✓ Preuve valide.' : '✗ Preuve invalide.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
