/**
 * Recherche moléculaire — texte libre ou préfixe de hash.
 * Chaque donnée atomique (nœud/lien/toggle famille) est adressable par son
 * leafHash ; le détail affiche la preuve de Merkle rejouable en direct.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getProof,
  leafIndexInTree,
  shortHash,
  verifyProof,
  type Leaf,
  type MerkleProof,
} from '../lib/merkle'
import {
  buildLeafIndex,
  findModification,
  getVersionByIndex,
  searchByHash,
  searchByText,
  useRegistry,
  type TextHit,
} from '../lib/versionStore'

interface SearchPanelProps {
  currentLeaves: Leaf[]
  onSeekToVersion: (dateIso: string) => void
  /** « Ouvrir dans… » : sélectionne le nœud puis bascule de vue. */
  onOpenIn: (view: '2d' | '3d' | 'couches', nodeId: string) => void
}

const TYPE_LABEL: Record<string, string> = {
  node: 'Nœud',
  link: 'Lien',
  milestone: 'Jalon',
  famille: 'Famille',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).catch(() => {})
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
      className="rounded border border-white/15 bg-white/5 px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.08em] text-white/50 transition-colors hover:bg-white/15 hover:text-white/80"
      title="Copier le hash complet"
    >
      {copied ? 'copié' : 'copier'}
    </button>
  )
}

export default function SearchPanel({ currentLeaves, onSeekToVersion, onOpenIn }: SearchPanelProps) {
  const { versions } = useRegistry()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<TextHit | null>(null)
  const [proofCheck, setProofCheck] = useState<boolean | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  /* Le détail s'affiche sous la liste : l'amener dans le viewport. */
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const isHashQuery = /^[0-9a-fA-F]{4,}$/.test(query.trim())

  const hashHits = useMemo(
    () => (isHashQuery ? searchByHash(query) : []),
    [isHashQuery, query, versions],
  )
  const textHits = useMemo(
    () => (!isHashQuery ? searchByText(query, currentLeaves) : []),
    [isHashQuery, query, currentLeaves, versions],
  )

  /* Preuve de Merkle du résultat sélectionné (version la plus récente). */
  const proof: MerkleProof | null = useMemo(() => {
    if (!selected || selected.proofVersion === null) return null
    const v = getVersionByIndex(selected.proofVersion)
    if (!v) return null
    const idx = leafIndexInTree(v.levels, selected.leaf.leafHash)
    if (idx < 0) return null
    return getProof(v.levels, idx)
  }, [selected])

  const modification = selected ? findModification(selected.leaf.id) : null

  const openTextHit = (hit: TextHit) => {
    setSelected(hit)
    setProofCheck(null)
  }

  const openHashLeaf = (versionIndex: number, leafIndex: number, hash: string) => {
    const v = getVersionByIndex(versionIndex)
    if (!v) return
    const leaf = v.leaves[leafIndex]
    if (!leaf) return
    const index = buildLeafIndex(versions)
    const occ = index.get(hash) ?? []
    setSelected({
      leaf,
      occurrences: occ,
      firstVersion: occ.length ? occ[0].versionIndex : null,
      lastVersion: occ.length ? occ[occ.length - 1].versionIndex : null,
      proofVersion: versionIndex,
    })
    setProofCheck(null)
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-[64px] z-30 flex max-h-[calc(100vh-370px)] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-white/10 bg-black/75 backdrop-blur-md">
      <div className="border-b border-white/10 p-4 pb-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
          Recherche moléculaire
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
            setProofCheck(null)
          }}
          placeholder="Texte libre ou préfixe de hash (ex. 3f9a…)"
          aria-label="Recherche moléculaire"
          className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 font-mono text-[12px] text-[#f5f5f5] placeholder-white/30 outline-none focus:border-[#ffca34]/50"
        />
        <p className="mt-1.5 text-[10px] leading-snug text-white/35">
          Chaque molécule (nœud, lien, toggle famille) est adressable par son hash SHA-256 et
          traçable à travers les versions.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {/* ── Résultats hash ── */}
        {isHashQuery && query.trim().length >= 4 && (
          <ul className="space-y-[2px]">
            {hashHits.length === 0 && (
              <li className="px-2 py-3 text-[11px] text-white/40">
                Aucune feuille, racine ou version ne commence par « {query.trim()} ».
              </li>
            )}
            {hashHits.map((h, i) => (
              <li key={`${h.kind}-${h.versionIndex}-${h.leafIndex ?? i}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (h.kind === 'leaf' && h.leafIndex !== undefined) {
                      openHashLeaf(h.versionIndex, h.leafIndex, h.hash)
                    } else {
                      const v = getVersionByIndex(h.versionIndex)
                      if (v) onSeekToVersion(v.dateSimulee)
                    }
                  }}
                  className="w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#ffca34]/40 bg-[#ffca34]/10 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.1em] text-[#ffca34]">
                      {h.kind === 'leaf' ? 'feuille' : h.kind === 'root' ? 'racine' : 'version'}
                    </span>
                    <span className="tnum truncate font-mono text-[10px] text-white/55">
                      {shortHash(h.hash, 12, 8)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-white/65">
                    {h.label} <span className="text-white/35">· v{h.versionIndex}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Résultats texte ── */}
        {!isHashQuery && query.trim().length >= 2 && (
          <ul className="space-y-[2px]">
            {textHits.length === 0 && (
              <li className="px-2 py-3 text-[11px] text-white/40">
                Aucune molécule ne correspond à « {query.trim()} ».
              </li>
            )}
            {textHits.map((hit) => (
              <li key={hit.leaf.id}>
                <button
                  type="button"
                  onClick={() => openTextHit(hit)}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/10 ${
                    selected?.leaf.id === hit.leaf.id ? 'bg-[#ffca34]/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/20 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.1em] text-white/45">
                      {TYPE_LABEL[hit.leaf.type] ?? hit.leaf.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#f5f5f5]">
                      {hit.leaf.label}
                    </span>
                  </div>
                  <div className="tnum mt-1 flex items-center gap-2 font-mono text-[10px] text-white/40">
                    <span className="truncate">{shortHash(hit.leaf.leafHash, 10, 6)}</span>
                    <span className="shrink-0 text-white/30">
                      {hit.occurrences.length} version{hit.occurrences.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* « Ouvrir dans… » — résultats de type nœud uniquement */}
                  {hit.leaf.type === 'node' && (
                    <span className="mt-1 flex items-center gap-1 text-[9px] text-white/35">
                      ouvrir dans
                      {(['2d', '3d', 'couches'] as const).map((v) => (
                        <span
                          key={v}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenIn(v, hit.leaf.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              onOpenIn(v, hit.leaf.id)
                            }
                          }}
                          className="open-in cursor-pointer rounded border border-white/15 bg-white/5 px-1.5 py-[1px] font-mono text-[9px] text-white/60 transition-colors hover:border-[#ffca34]/50 hover:text-[#ffca34]"
                        >
                          {v === '2d' ? '2D' : v === '3d' ? '3D' : 'Couches'}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Détail : traçabilité + preuve de Merkle ── */}
        {selected && (
          <div ref={detailRef} className="mt-2 border-t border-white/10 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[12px] font-semibold text-[#f5f5f5]">{selected.leaf.label}</div>
                <div className="mt-[2px] text-[10px] uppercase tracking-[0.12em] text-white/40">
                  {TYPE_LABEL[selected.leaf.type] ?? selected.leaf.type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setProofCheck(null)
                }}
                aria-label="Fermer le détail"
                className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="tnum mt-2 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] text-[#ffca34]">
              <span className="truncate" title={selected.leaf.leafHash}>
                {selected.leaf.leafHash}
              </span>
              <CopyButton text={selected.leaf.leafHash} />
            </div>

            {/* Historique des versions */}
            <div className="mt-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                Présence dans les versions
              </div>
              {selected.occurrences.length === 0 ? (
                <p className="mt-1 text-[11px] text-white/40">
                  Absente du registre (jamais visible lors d'un commit).
                </p>
              ) : (
                <>
                  <p className="tnum mt-1 text-[11px] text-white/55">
                    Première apparition : v{selected.firstVersion} · dernière : v
                    {selected.lastVersion}
                  </p>
                  <div className="mt-1.5 flex max-h-[84px] flex-wrap gap-1 overflow-y-auto">
                    {selected.occurrences.map((occ) => (
                      <button
                        key={occ.versionIndex}
                        type="button"
                        onClick={() => onSeekToVersion(occ.dateSimulee)}
                        className="tnum rounded border border-white/15 bg-white/5 px-1.5 py-[2px] text-[10px] text-white/60 transition-colors hover:border-[#ffca34]/50 hover:text-[#ffca34]"
                        title={`${occ.action} — ramener la timeline au ${occ.dateSimulee}`}
                      >
                        v{occ.versionIndex}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {modification && (
                <p className="mt-2 rounded-md border border-[#ff8a3d]/40 bg-[#ff8a3d]/10 px-2 py-1.5 text-[11px] text-[#ffb27d]">
                  Modifiée entre v{modification.from} et v{modification.to} —{' '}
                  {modification.diff.added.length} ajoutée(s), {modification.diff.removed.length}{' '}
                  supprimée(s), {modification.diff.changed.length} changée(s) dans ce diff.
                </p>
              )}
            </div>

            {/* Preuve de Merkle */}
            {proof && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                    Preuve de Merkle — v{selected.proofVersion}
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofCheck(verifyProof(proof))}
                    className="rounded-md border border-[#ffca34]/40 bg-[#ffca34]/10 px-2 py-1 text-[10px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/25"
                  >
                    Vérifier la preuve
                  </button>
                </div>
                <ol className="tnum mt-2 space-y-1 font-mono text-[10px]">
                  <li className="flex items-center gap-2 text-[#ffca34]">
                    <span className="w-14 shrink-0 text-white/35">feuille</span>
                    <span className="truncate">{shortHash(proof.leafHash, 10, 6)}</span>
                  </li>
                  {proof.steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-white/50">
                      <span className="w-14 shrink-0 text-white/35">
                        {s.position === 'left' ? '← gauche' : 'droite →'}
                      </span>
                      <span className="truncate" title={s.sibling}>
                        {shortHash(s.sibling, 10, 6)}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 border-t border-white/10 pt-1 text-white/70">
                    <span className="w-14 shrink-0 text-white/35">racine</span>
                    <span className="truncate">{shortHash(proof.root, 10, 6)}</span>
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
                    {proofCheck
                      ? '✓ Preuve valide — la racine recalculée concorde avec la racine ancrée.'
                      : '✗ Preuve invalide — la racine recalculée diffère (donnée altérée ?).'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
