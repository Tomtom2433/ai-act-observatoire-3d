import { CATEGORIE_META, type NodeCategorie } from '../data/aiActData'
import { CIRCUIT_COLORS } from '../lib/circuit'

interface LegendPanelProps {
  famillesVisibles: Set<NodeCategorie>
  onToggleFamille: (c: NodeCategorie) => void
  nbNoeuds: number
  nbLiens: number
  onResetCamera: () => void
  ramified: boolean
  onToggleRamified: () => void
  currentOn: boolean
  onToggleCurrent: () => void
}

const CIRCUIT_STATES: Array<{ label: string; desc: string; couleur: string }> = [
  { label: 'Chemin actif', desc: 'flux continu rapide', couleur: CIRCUIT_COLORS.chemin },
  { label: 'État brut', desc: 'courant lent, intermittent', couleur: CIRCUIT_COLORS.brut },
  { label: 'Décision', desc: 'éclairs / surcharge', couleur: CIRCUIT_COLORS.decision },
  { label: 'Violation', desc: 'clignotement alarme', couleur: CIRCUIT_COLORS.violation },
]

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function LegendPanel({
  famillesVisibles,
  onToggleFamille,
  nbNoeuds,
  nbLiens,
  onResetCamera,
  ramified,
  onToggleRamified,
  currentOn,
  onToggleCurrent,
}: LegendPanelProps) {
  const categories = Object.entries(CATEGORIE_META) as [NodeCategorie, { label: string; couleur: string }][]
  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-20 max-h-[54vh] w-[240px] overflow-y-auto rounded-lg border border-white/10 bg-black/70 p-4 backdrop-blur-md">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
        Familles de nœuds
      </div>
      <ul className="mt-3 max-h-[168px] space-y-1 overflow-y-auto">
        {categories.map(([key, meta]) => {
          const active = famillesVisibles.has(key)
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onToggleFamille(key)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-white/10 ${
                  active ? 'text-[#f5f5f5]' : 'text-white/35'
                }`}
              >
                <span
                  className="h-[9px] w-[9px] shrink-0 rounded-full transition-opacity"
                  style={{
                    backgroundColor: meta.couleur,
                    boxShadow: active ? `0 0 8px ${meta.couleur}` : 'none',
                    opacity: active ? 1 : 0.3,
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                <span className="text-white/40">
                  <IconEye off={!active} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Circuit
          </div>
          <button
            type="button"
            onClick={onToggleCurrent}
            aria-pressed={currentOn}
            title="Couper le courant (accessibilité / performances)"
            className={`rounded-md border px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              currentOn
                ? 'border-[#00d5e9]/50 bg-[#00d5e9]/10 text-[#00d5e9]'
                : 'border-white/15 bg-white/5 text-white/40 hover:bg-white/15'
            }`}
          >
            {currentOn ? 'Courant ON' : 'Courant OFF'}
          </button>
        </div>
        <ul className={`mt-1.5 space-y-1 text-[11px] transition-opacity ${currentOn ? 'text-white/55' : 'text-white/25'}`}>
          {CIRCUIT_STATES.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ backgroundColor: s.couleur, boxShadow: currentOn ? `0 0 6px ${s.couleur}` : 'none' }}
              />
              <span className="text-white/75">{s.label}</span>
              <span className="ml-auto text-right text-[10px] text-white/35">{s.desc}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
          Types de liens
        </div>
        <ul className="mt-1.5 space-y-1 text-[11px] text-white/55">
          <li className="flex items-center gap-2">
            <span className="relative h-px w-7 bg-[#ffca34]/70">
              <span className="absolute -top-[2px] left-3 h-[5px] w-[5px] rounded-full bg-[#ffca34]" />
            </span>
            Action (animé) — interdit, impose, supervise…
          </li>
          <li className="flex items-center gap-2">
            <span className="h-px w-7 bg-white/30" />
            Appartenance (fin) — est_un, inclut…
          </li>
        </ul>
      </div>
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="tnum text-[11px] text-white/55">
          <span className="font-medium text-[#ffca34]">{nbNoeuds}</span> nœuds ·{' '}
          <span className="font-medium text-[#ffca34]">{nbLiens}</span> liens visibles
        </div>
        <button
          type="button"
          onClick={onToggleRamified}
          aria-pressed={ramified}
          className={`mt-3 w-full rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
            ramified
              ? 'border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34]'
              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/15'
          }`}
          title="Touche R — déplier le graphe en arbre radial"
        >
          {ramified ? 'Ramification active (R)' : 'Ramification (R)'}
        </button>
        <button
          type="button"
          onClick={onResetCamera}
          className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/15"
        >
          Réinitialiser la caméra
        </button>
      </div>
    </div>
  )
}
