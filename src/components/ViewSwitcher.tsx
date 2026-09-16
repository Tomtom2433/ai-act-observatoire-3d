/**
 * ViewSwitcher — contrôle segmenté unifié : 2D · 3D · NEURONE · COUCHES.
 *
 * Un clic change de point de vue en CONSERVANT le contexte (même nœud
 * sélectionné, même date T, mêmes filtres de famille). NEURONE/COUCHES
 * exigent une sélection : désactivés sinon (infobulle explicative).
 * Quitter NEURONE/COUCHES (Échap/Retour) ramène à la vue de base (2D/3D)
 * en gardant la sélection — ce composant ne fait que refléter/piloter
 * l'état dérivé fourni par App.
 */

export type ViewId = 'liste' | '2d' | '3d' | 'spirale' | 'neurone' | 'couches'

interface ViewSwitcherProps {
  /** Vue actuellement affichée (dérivée de diveNodeId / layersNodeId / baseView). */
  view: ViewId
  /** Un nœud est-il sélectionné ? (requis pour NEURONE / COUCHES). */
  hasSelection: boolean
  onSwitch: (view: ViewId) => void
}

const VIEWS: Array<{ id: ViewId; label: string; hint: string }> = [
  { id: 'liste', label: 'LISTE', hint: 'Table des 50 données — recherche, tri, sélection' },
  { id: '2d', label: '2D', hint: 'Carte plane du graphe — même donnée, autre point de vue' },
  { id: '3d', label: '3D', hint: 'Graphe spatial 3D' },
  { id: 'spirale', label: 'SPIRALE', hint: 'Hélice temporelle — état à une date donnée (touche S)' },
  { id: 'neurone', label: 'NEURONE', hint: 'Plongée dans le nœud sélectionné (versions en orbite)' },
  { id: 'couches', label: 'COUCHES', hint: 'Cristal moléculaire des versions du nœud sélectionné' },
]

export default function ViewSwitcher({ view, hasSelection, onSwitch }: ViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Points de vue"
      className="pointer-events-auto absolute left-1/2 top-[118px] z-30 flex -translate-x-1/2 overflow-hidden rounded-md border border-white/15 bg-black/75 backdrop-blur-md"
    >
      {VIEWS.map((v) => {
        const needsSelection = v.id === 'neurone' || v.id === 'couches'
        const disabled = needsSelection && !hasSelection
        const active = view === v.id
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled}
            disabled={disabled}
            title={disabled ? "Sélectionne d'abord un nœud" : v.hint}
            onClick={() => !disabled && onSwitch(v.id)}
            className={`tnum border-r border-white/10 px-3.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] transition-colors last:border-r-0 ${
              active
                ? 'bg-[#ffca34]/20 text-[#ffca34] shadow-[inset_0_0_12px_rgba(255,202,52,0.15)]'
                : disabled
                  ? 'cursor-not-allowed text-white/25'
                  : 'text-white/60 hover:bg-white/10 hover:text-white/90'
            }`}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
