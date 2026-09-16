/**
 * Vue LISTE (niveau 0 de l'échelle de vues) — « je cherche une donnée ».
 *
 * Table des 50 nœuds filtrée par famillesVisibles :
 *  - colonnes Label / Famille / État à T / Actif depuis / Nb versions,
 *    en-têtes cliquables (tri, re-clic = inversion) ;
 *  - recherche instantanée insensible aux accents sur label + description,
 *    lien « recherche par empreinte/hash → » (ouvre SearchPanel) ;
 *  - ligne sélectionnée surlignée ; clic ligne → sélection (fiche BLOC
 *    existante, gérée par App) ; Entrée = sélectionne la 1re ligne visible ;
 *  - boutons par ligne « 2D » et « Couches » : sélectionnent puis basculent.
 */
import { useEffect, useMemo, useState } from 'react'
import { CATEGORIE_META, NODES, type NodeCategorie } from '../data/aiActData'
import { formatDateShort, tsOf } from '../lib/time'
import { getNodeHistory, useRegistry } from '../lib/versionStore'
import type { GraphNode } from './Graph3D'

type SortKey = 'label' | 'famille' | 'etat' | 'depuis' | 'versions'

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'label', label: 'Label' },
  { key: 'famille', label: 'Famille' },
  { key: 'etat', label: 'État à T' },
  { key: 'depuis', label: 'Actif depuis' },
  { key: 'versions', label: 'Nb versions' },
]

/** Insensible aux accents et à la casse. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
interface ListViewProps {
  currentTs: number
  famillesVisibles: Set<NodeCategorie>
  selectedNodeId: string | null
  /** Espace (px) réservé à droite pour le panneau flottant éventuel. */
  rightReserved?: number
  onSelectNode: (node: GraphNode | null) => void
  onOpenIn: (view: '2d' | 'couches', nodeId: string) => void
  onOpenSearch: () => void
}

export default function ListView({
  currentTs,
  famillesVisibles,
  selectedNodeId,
  rightReserved = 32,
  onSelectNode,
  onOpenIn,
  onOpenSearch,
}: ListViewProps) {
  useRegistry() // réactivité : Nb versions suit le registre
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('label')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const rows = useMemo(() => {
    const q = norm(query.trim())
    const list = NODES.filter((n) => famillesVisibles.has(n.categorie))
      .filter((n) => !q || norm(n.label).includes(q) || norm(n.description).includes(q))
      .map((n) => ({
        node: n,
        actif: n.actifDepuis === null || tsOf(n.actifDepuis) <= currentTs,
        versions: getNodeHistory(n.id).length,
      }))
    list.sort((a, b) => {
      switch (sortKey) {
        case 'label':
          return sortDir * a.node.label.localeCompare(b.node.label, 'fr')
        case 'famille':
          return (
            sortDir *
            CATEGORIE_META[a.node.categorie].label.localeCompare(
              CATEGORIE_META[b.node.categorie].label,
              'fr',
            )
          )
        case 'etat':
          // Actif d'abord (dir = 1), Futur d'abord si inversé.
          return sortDir * (Number(b.actif) - Number(a.actif))
        case 'depuis': {
          const ta =
            a.node.actifDepuis === null ? Number.NEGATIVE_INFINITY : tsOf(a.node.actifDepuis)
          const tb =
            b.node.actifDepuis === null ? Number.NEGATIVE_INFINITY : tsOf(b.node.actifDepuis)
          return sortDir * (ta - tb)
        }
        case 'versions':
          return sortDir * (a.versions - b.versions)
      }
    })
    return list
  }, [query, famillesVisibles, currentTs, sortKey, sortDir])

  /* Entrée = sélectionne la première ligne visible (sauf si un bouton est
     focalisé — il garde son propre comportement). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const t = e.target as HTMLElement | null
      if (t && t.tagName === 'BUTTON') return
      if (t && t.tagName === 'INPUT' && t.getAttribute('aria-label') !== 'Recherche dans la liste')
        return
      if (rows.length > 0) onSelectNode(rows[0].node as GraphNode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, onSelectNode])

  const clickHeader = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setSortDir(key === 'versions' ? -1 : 1)
    }
  }

  return (
    <div className="absolute inset-0 z-10 overflow-hidden bg-black">
      <div
        className="flex h-full flex-col pb-[134px] pl-8 pr-8 pt-[188px]"
        style={{ paddingRight: rightReserved }}
      >
        {/* Barre de recherche */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une donnée (label, description)…"
            aria-label="Recherche dans la liste"
            className="w-[340px] max-w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-[#f5f5f5] placeholder-white/30 outline-none focus:border-[#ffca34]/50"
          />
          <button
            type="button"
            onClick={onOpenSearch}
            className="text-[11px] text-white/45 transition-colors hover:text-[#ffca34]"
            title="Recherche moléculaire par texte libre ou préfixe de hash"
          >
            recherche par empreinte/hash →
          </button>
          <span className="tnum ml-auto font-mono text-[10px] text-white/40">
            {rows.length} / {NODES.length} données · Entrée = sélectionner la 1re ligne
          </span>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/60">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-black">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="border-b border-white/15 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => clickHeader(c.key)}
                      className={`sort-header flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors ${
                        sortKey === c.key ? 'text-[#ffca34]' : 'text-white/40 hover:text-white/80'
                      }`}
                      data-sort={c.key}
                    >
                      {c.label}
                      {sortKey === c.key && (
                        <span className="font-mono text-[9px]">{sortDir === 1 ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                ))}
                <th className="border-b border-white/15 px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                  Ouvrir dans
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, actif, versions }) => {
                const meta = CATEGORIE_META[node.categorie]
                const isSel = node.id === selectedNodeId
                return (
                  <tr
                    key={node.id}
                    data-id={node.id}
                    onClick={() => onSelectNode(node as GraphNode)}
                    className={`list-row cursor-pointer border-t border-white/5 transition-colors ${
                      isSel ? 'bg-[#ffca34]/[0.09]' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <td className="px-3 py-[7px]">
                      <span className={`text-[12px] ${isSel ? 'font-medium text-[#ffca34]' : 'text-[#f5f5f5]'}`}>
                        {node.label}
                      </span>
                    </td>
                    <td className="px-3 py-[7px]">
                      <span
                        className="inline-flex items-center rounded-full border px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.1em]"
                        style={{
                          color: meta.couleur,
                          borderColor: `${meta.couleur}55`,
                          backgroundColor: `${meta.couleur}14`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-[7px]">
                      {actif ? (
                        <span className="text-[11px] text-[#ffca34]">Actif</span>
                      ) : (
                        <span className="tnum text-[11px] text-[#8ab4ff]">
                          Futur ({formatDateShort(tsOf(node.actifDepuis!))})
                        </span>
                      )}
                    </td>
                    <td className="tnum px-3 py-[7px] text-[11px] text-white/50">
                      {node.actifDepuis === null ? '—' : formatDateShort(tsOf(node.actifDepuis))}
                    </td>
                    <td className="tnum px-3 py-[7px] font-mono text-[11px] text-white/60">
                      {versions}
                    </td>
                    <td className="px-3 py-[7px] text-right">
                      <span className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenIn('2d', node.id)
                          }}
                          className="rounded border border-white/15 bg-white/5 px-2 py-[3px] font-mono text-[10px] text-white/65 transition-colors hover:border-[#ffca34]/50 hover:text-[#ffca34]"
                          title="Sélectionner et monter en vue 2D"
                        >
                          2D
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenIn('couches', node.id)
                          }}
                          className="rounded border border-white/15 bg-white/5 px-2 py-[3px] font-mono text-[10px] text-white/65 transition-colors hover:border-[#ffca34]/50 hover:text-[#ffca34]"
                          title="Sélectionner et ouvrir le cristal moléculaire des versions"
                        >
                          Couches
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-white/40">
                    Aucune donnée ne correspond à « {query.trim()} » (familles visibles :{' '}
                    {famillesVisibles.size}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
