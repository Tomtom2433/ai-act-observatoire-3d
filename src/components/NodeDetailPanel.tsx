import { useState } from 'react'
import { CATEGORIE_META, LINKS, NODES } from '../data/aiActData'
import type { GraphNode } from './Graph3D'
import { formatDateShort, tsOf } from '../lib/time'
import {
  buildMerkleTree,
  computeVersionHash,
  shortHash,
  type Version,
} from '../lib/merkle'
import { getNodeHistory, useRegistry } from '../lib/versionStore'

interface NodeDetailPanelProps {
  node: GraphNode | null
  /** Version (« bloc ») commitée par le clic courant. */
  version: Version | null
  currentTs: number
  onClose: () => void
  onDive: (node: GraphNode) => void
  isolationDepth: 1 | 2 | 3 | null
  onIsolate: (depth: 1 | 2 | 3) => void
  onDesisolate: () => void
  onOpenLayers: (node: GraphNode) => void
  onOpenRegistry: (index: number) => void
  onSeekDate: (iso: string) => void
}

const LABEL_BY_ID = new Map(NODES.map((n) => [n.id, n.label]))

/** Hash tronqué copiable au clic (title = hash complet). */
function CopyHash({ label, hash }: { label: string; hash: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={`${label} : ${hash}\nCliquer pour copier`}
      onClick={() => {
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

export default function NodeDetailPanel({
  node,
  version,
  currentTs,
  onClose,
  onDive,
  isolationDepth,
  onIsolate,
  onDesisolate,
  onOpenLayers,
  onOpenRegistry,
  onSeekDate,
}: NodeDetailPanelProps) {
  useRegistry() // réactivité : nouvelles versions / sabotage
  const [verified, setVerified] = useState<boolean | null>(null)
  if (!node) return null
  const meta = CATEGORIE_META[node.categorie]
  const sortants = LINKS.filter((l) => l.source === node.id)
  const entrants = LINKS.filter((l) => l.target === node.id)
  const isolated = isolationDepth !== null
  const actif = node.actifDepuis === null || tsOf(node.actifDepuis) <= currentTs
  const history = getNodeHistory(node.id)
  const first = history.length > 0 ? history[0] : null

  const verifyBlock = () => {
    if (!version) return
    const root = buildMerkleTree(version.leaves).root
    const hash = computeVersionHash({
      index: version.index,
      timestamp: version.timestamp,
      dateSimulee: version.dateSimulee,
      actionKind: version.actionKind,
      action: version.action,
      merkleRoot: version.merkleRoot,
      prevHash: version.prevHash,
    })
    setVerified(root === version.merkleRoot && hash === version.hash)
  }

  return (
    <div className="pointer-events-auto absolute bottom-[132px] right-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-black/70 p-4 backdrop-blur-md">
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
          {/* État à la date T */}
          {actif ? (
            <span className="inline-flex items-center rounded-full border border-[#ffca34]/50 bg-[#ffca34]/12 px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em] text-[#ffca34]">
              Actif
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[#8ab4ff]/45 bg-[#8ab4ff]/12 px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em] text-[#8ab4ff]">
              Futur — état brut
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le panneau de détail"
          className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <h2 className="mt-2.5 text-[15px] font-semibold leading-snug text-[#f5f5f5]">{node.label}</h2>

      <p className="tnum mt-1 text-[11px] text-white/45">
        {node.actifDepuis === null
          ? 'Toujours visible — jamais contraignant'
          : `Actif depuis le ${formatDateShort(tsOf(node.actifDepuis))}`}
      </p>

      {/* ── BLOC — version chaînée commitée par ce clic ── */}
      {version && (
        <div className="mt-3 rounded-md border border-[#ffca34]/25 bg-[#ffca34]/[0.06] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="tnum rounded border border-[#ffca34]/45 bg-[#ffca34]/12 px-2 py-[2px] font-mono text-[11px] font-semibold text-[#ffca34]">
              #v{version.index}
            </span>
            <span className="tnum text-[10px] text-white/40">
              {new Date(version.timestamp).toLocaleTimeString('fr-FR')} · T = {version.dateSimulee}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-white/60">{version.action}</p>

          {/* Chaînage prevHash → hash */}
          <div className="mt-2 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffca34" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <CopyHash label="Hash du bloc précédent" hash={version.prevHash} />
            <span className="text-[10px] text-[#ffca34]/70">→</span>
            <CopyHash label="Hash de ce bloc" hash={version.hash} />
          </div>
          <div className="tnum mt-1 flex items-center gap-2 pl-[18px] font-mono text-[10px] text-white/40">
            <span>racine</span>
            <CopyHash label="Racine de Merkle" hash={version.merkleRoot} />
            <span className="text-white/30">· {version.leaves.length} feuilles</span>
          </div>

          {/* Actions du bloc */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={verifyBlock}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/75 transition-colors hover:bg-white/15"
            >
              Vérifier
            </button>
            {verified !== null && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                  verified ? 'text-[#00ffa3]' : 'text-[#ff6b62]'
                }`}
              >
                <span
                  className={`inline-block h-[7px] w-[7px] rounded-full ${
                    verified
                      ? 'bg-[#00ffa3] shadow-[0_0_6px_rgba(0,255,163,0.7)]'
                      : 'bg-[#ff3b30] shadow-[0_0_6px_rgba(255,59,48,0.8)]'
                  }`}
                />
                {verified ? 'intègre' : 'rompu'}
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenRegistry(version.index)}
              className="ml-auto rounded-md border border-[#ffca34]/35 bg-[#ffca34]/8 px-2.5 py-1 text-[10px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/25"
            >
              Ouvrir dans le Registre
            </button>
          </div>

          {/* Historique du nœud dans le registre */}
          {first && (
            <button
              type="button"
              onClick={() => onSeekDate(first.dateSimulee)}
              title={`Ramener la timeline au ${first.dateSimulee}`}
              className="tnum mt-2 block border-t border-white/10 pt-2 text-left text-[10px] text-white/45 transition-colors hover:text-[#ffca34]"
            >
              Présent dans {history.length} version{history.length > 1 ? 's' : ''} · première #v
              {first.versionIndex} ({first.dateSimulee}) →
            </button>
          )}
        </div>
      )}

      {/* Actions d'exploration */}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onDive(node)}
          className="flex-1 rounded-md border border-[#ffca34]/45 bg-[#ffca34]/10 px-3 py-1.5 text-[11px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/30"
          title="Double-clic sur le nœud ou touche P"
        >
          Plonger
        </button>
        <button
          type="button"
          onClick={() => onOpenLayers(node)}
          className="flex-1 rounded-md border border-[#8ab4ff]/45 bg-[#8ab4ff]/10 px-3 py-1.5 text-[11px] font-medium text-[#8ab4ff] transition-colors hover:bg-[#8ab4ff]/30"
          title="Vue éclatée des versions de cette donnée + historique vérifiable"
        >
          Couches
        </button>
        {isolated ? (
          <button
            type="button"
            onClick={onDesisolate}
            className="flex-1 rounded-md border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1.5 text-[11px] font-medium text-[#00ffa3] transition-colors hover:bg-[#00ffa3]/25"
            title="Touche I ou Échap"
          >
            Isolation active ({isolationDepth} saut{isolationDepth > 1 ? 's' : ''})
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onIsolate(1)}
            className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/75 transition-colors hover:bg-white/15"
            title="Touche I — solo le nœud et son voisinage"
          >
            Isoler
          </button>
        )}
      </div>
      {isolated && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/40">Profondeur</span>
          {([1, 2, 3] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onIsolate(d)}
              aria-pressed={isolationDepth === d}
              className={`tnum h-6 w-7 rounded border text-[11px] font-medium transition-colors ${
                isolationDepth === d
                  ? 'border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34]'
                  : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/15'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 max-h-[110px] overflow-y-auto text-[12px] leading-relaxed text-white/65">
        {node.description}
      </p>

      <div className="mt-3 max-h-[150px] space-y-2 overflow-y-auto border-t border-white/10 pt-3">
        {sortants.length > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
              Liens sortants ({sortants.length})
            </div>
            <ul className="mt-1 space-y-[3px]">
              {sortants.map((l) => (
                <li key={`${l.source}-${l.target}-${l.relation}`} className="text-[11px] text-white/60">
                  <span className="text-[#ffca34]/80">{l.relation.replace(/_/g, ' ')}</span>
                  {' → '}
                  {LABEL_BY_ID.get(l.target) ?? l.target}
                </li>
              ))}
            </ul>
          </div>
        )}
        {entrants.length > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
              Liens entrants ({entrants.length})
            </div>
            <ul className="mt-1 space-y-[3px]">
              {entrants.map((l) => (
                <li key={`${l.source}-${l.target}-${l.relation}`} className="text-[11px] text-white/60">
                  {LABEL_BY_ID.get(l.source) ?? l.source}
                  {' → '}
                  <span className="text-[#ffca34]/80">{l.relation.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
