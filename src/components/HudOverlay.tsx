/**
 * HUD façon jeu vidéo — indicateur de mode courant + aide clavier togglable.
 * Esthétique : fond noir, doré #ffca34, monospace, aucun emoji.
 */

export type ExplorationMode =
  | 'EXPLORATION'
  | 'LISTE'
  | '2D'
  | '3D'
  | 'SPIRALE'
  | 'PLONGÉE'
  | 'ISOLATION'
  | 'RAMIFICATION'
  | 'COUCHES'

interface HudOverlayProps {
  mode: ExplorationMode
  helpOpen: boolean
  onToggleHelp: () => void
}

const SHORTCUTS: Array<{ touches: string; action: string }> = [
  { touches: '0 / L', action: 'Vue Liste (niveau 0)' },
  { touches: '4 / P', action: 'Plongée NEURONE (nœud sélectionné)' },
  { touches: '5 / C', action: 'Vue COUCHES (nœud sélectionné)' },
  { touches: '↑ / ↓', action: "Monter / descendre d'un niveau dans l'échelle" },
  { touches: 'Échap', action: "Descendre d'un niveau (couches/neurone → vue d'origine)" },
  { touches: 'Double-clic nœud', action: 'Plongée dans le neurone' },
  { touches: 'I', action: 'Isolation du nœud sélectionné (3D)' },
  { touches: '1 / 2 / 3', action: "Profondeur d'isolation (en isolation)" },
  { touches: 'R', action: 'Ramification (arbre radial, 3D)' },
  { touches: 'S', action: 'Vue Spirale temporelle (niveau 3)' },
  { touches: 'H ou ?', action: 'Afficher / masquer cette aide' },
]

export default function HudOverlay({ mode, helpOpen, onToggleHelp }: HudOverlayProps) {
  return (
    <>
      {/* Indicateur de mode — sous la barre d'outils */}
      <div className="pointer-events-none absolute left-4 top-[104px] z-30 flex items-center gap-2">
        <span className="tnum rounded border border-[#ffca34]/35 bg-black/70 px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#ffca34] backdrop-blur-md">
          {mode}
        </span>
        <button
          type="button"
          onClick={onToggleHelp}
          aria-label="Afficher l'aide clavier"
          className="pointer-events-auto flex h-[22px] w-[22px] items-center justify-center rounded border border-white/15 bg-black/70 font-mono text-[11px] text-white/50 backdrop-blur-md transition-colors hover:border-[#ffca34]/50 hover:text-[#ffca34]"
        >
          ?
        </button>
      </div>

      {/* Aide clavier */}
      {helpOpen && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-40 w-[380px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-black/85 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
              Raccourcis d'exploration
            </div>
            <button
              type="button"
              onClick={onToggleHelp}
              aria-label="Fermer l'aide"
              className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {SHORTCUTS.map((s) => (
              <li key={s.touches} className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-white/65">{s.action}</span>
                <kbd className="tnum shrink-0 rounded border border-[#ffca34]/30 bg-[#ffca34]/10 px-2 py-[2px] font-mono text-[10px] text-[#ffca34]">
                  {s.touches}
                </kbd>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/10 pt-2.5 text-[10px] leading-snug text-white/35">
            En plongée, les versions du registre orbitent autour du neurone : dorée = première
            apparition, rouge = modifiée, grise = inchangée. Survol pour le détail, clic pour
            sauter à la date.
          </p>
        </div>
      )}
    </>
  )
}
