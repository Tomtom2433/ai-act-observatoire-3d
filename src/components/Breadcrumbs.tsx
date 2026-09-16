/**
 * Breadcrumbs — échelle de navigation haut-centre :
 * Liste › 2D › 3D › Neurone › Couches (la Spirale s'insérera au lot 2).
 *
 * Niveau courant plein/doré, autres cliquables — la garde de sélection
 * pour Neurone/Couches est gérée par App (mini-feedback `hint` plutôt que
 * blocage silencieux). Contexte à droite : [label nœud] · [date T].
 */
import type { ViewId } from './ViewSwitcher'

const LEVELS: Array<{ id: ViewId; label: string }> = [
  { id: 'liste', label: 'Liste' },
  { id: '2d', label: '2D' },
  { id: '3d', label: '3D' },
  { id: 'spirale', label: 'Spirale' },
  { id: 'neurone', label: 'Neurone' },
  { id: 'couches', label: 'Couches' },
]

interface BreadcrumbsProps {
  view: ViewId
  /** Contexte : « label du nœud · date T » (ou « aucune donnée · date T »). */
  context: string
  /** Mini-feedback de garde (ex. « sélectionne d'abord une donnée »). */
  hint: string | null
  onNavigate: (v: ViewId) => void
}

export default function Breadcrumbs({ view, context, hint, onNavigate }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Échelle de vues"
      className="pointer-events-auto absolute left-1/2 top-[152px] z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-3 py-1 text-[11px] backdrop-blur-md"
    >
      {LEVELS.map((l, i) => {
        const active = l.id === view
        return (
          <span key={l.id} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-white/25">›</span>}
            <button
              type="button"
              onClick={() => !active && onNavigate(l.id)}
              aria-current={active ? 'page' : undefined}
              className={`crumb transition-colors ${
                active
                  ? 'crumb-active font-semibold text-[#ffca34]'
                  : 'text-white/45 hover:text-[#ffca34]'
              }`}
              data-view={l.id}
            >
              {l.label}
            </button>
          </span>
        )
      })}
      <span className="tnum ml-2 hidden border-l border-white/15 pl-2 text-[10px] text-white/40 sm:inline">
        {context}
      </span>
      {hint && (
        <span className="ml-2 border-l border-[#ffca34]/30 pl-2 text-[10px] text-[#ffca34]">
          {hint}
        </span>
      )}
    </nav>
  )
}
