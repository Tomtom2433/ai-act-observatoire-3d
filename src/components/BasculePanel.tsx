/**
 * Mode « La Bascule » — lecture scénarisée de l'incident Nexa Mutuelle / ORELIA.
 * Registre d'incident chaîné par hash (chaîne parallèle au registre de versions),
 * carte détail par événement, point de bascule mis en valeur, analyse finale.
 */
import { useMemo, useState } from 'react'
import { shortHash, verifyEventChain } from '../lib/merkle'
import { CIRCUIT_TYPE_COLORS, CIRCUIT_TYPE_LABELS } from '../lib/circuit'
import type { BasculeEventType } from '../data/laBasculeData'
import {
  ANALYSE_FINALE,
  BASCULE_ARTEFACTS,
  BASCULE_EVENTS,
  BASCULE_EVENT_CHAIN,
  BASCULE_TYPE_META,
  POINT_DE_BASCULE,
} from '../data/laBasculeData'

interface BasculePanelProps {
  currentEventIndex: number
  playing: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSelectEvent: (index: number) => void
  onClose: () => void
}

const NIVEAU_STYLE: Record<string, { label: string; classes: string }> = {
  licite: { label: 'Licite', classes: 'border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]' },
  incident: { label: 'Incident', classes: 'border-[#ffca34]/40 bg-[#ffca34]/10 text-[#ffca34]' },
  zone_grise: { label: 'Zone grise', classes: 'border-[#ff8a3d]/40 bg-[#ff8a3d]/10 text-[#ffb27d]' },
  violation: { label: 'Violation', classes: 'border-[#ff3b30]/40 bg-[#ff3b30]/10 text-[#ff6b62]' },
  sanction: { label: 'Sanction', classes: 'border-[#ff5872]/50 bg-[#ff5872]/15 text-[#ff8ba0]' },
}

function IconPlay() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14Z" />
    </svg>
  )
}
function IconPause() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

export default function BasculePanel({
  currentEventIndex,
  playing,
  onPlayPause,
  onPrev,
  onNext,
  onSelectEvent,
  onClose,
}: BasculePanelProps) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showArtefact, setShowArtefact] = useState(false)
  const event = BASCULE_EVENTS[currentEventIndex]
  const chainOk = useMemo(() => verifyEventChain(BASCULE_EVENT_CHAIN), [])
  const niveau = NIVEAU_STYLE[event.niveau]

  return (
    <div
      className={`pointer-events-auto absolute bottom-[150px] right-4 top-4 z-30 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border backdrop-blur-md ${
        event.estPointDeBascule
          ? 'border-[#ffca34]/60 bg-black/80 shadow-[0_0_40px_rgba(255,202,52,0.15)]'
          : 'border-white/10 bg-black/75'
      }`}
    >
      {/* En-tête + contrôles */}
      <div className="border-b border-white/10 p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#ffca34]">
            Scénario : La Bascule
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Quitter le scénario"
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          Nexa Mutuelle déploie ORELIA, un chatbot conseil. Une hallucination devient technique de
          tromperie : chronique d'une violation de l'Art. 5(1)(a). Registre d'incident chaîné par
          hash —{' '}
          <span className={chainOk ? 'text-[#00ffa3]' : 'text-[#ff6b62]'}>
            {chainOk ? 'chaîne intègre' : 'chaîne rompue'}
          </span>
          .
        </p>
        {/* Légende circuit : couleurs par type d'événement */}
        <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
          <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
            Circuit — couleurs par type d'événement
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {(Object.keys(CIRCUIT_TYPE_COLORS) as BasculeEventType[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[10px] text-white/55">
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{
                    backgroundColor: CIRCUIT_TYPE_COLORS[t],
                    boxShadow: `0 0 6px ${CIRCUIT_TYPE_COLORS[t]}`,
                  }}
                />
                {CIRCUIT_TYPE_LABELS[t]}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentEventIndex === 0}
            className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/15 disabled:opacity-30"
          >
            ← Préc.
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            aria-label={playing ? 'Pause du scénario' : 'Lecture du scénario'}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34] transition-colors hover:bg-[#ffca34]/30"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={currentEventIndex === BASCULE_EVENTS.length - 1}
            className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/15 disabled:opacity-30"
          >
            Suiv. →
          </button>
          <span className="tnum ml-auto text-[11px] text-white/40">
            Événement {event.seq} / {BASCULE_EVENTS.length}
          </span>
          <button
            type="button"
            onClick={() => setShowAnalysis((s) => !s)}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              showAnalysis
                ? 'border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34]'
                : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/15'
            }`}
          >
            Analyse
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── Registre d'incident (chaîne parallèle) ── */}
        <div className="border-b border-white/10 p-2">
          <div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Registre d'incident — {BASCULE_ARTEFACTS.length} entrées chaînées
          </div>
          <ul className="space-y-[2px]">
            {BASCULE_EVENTS.map((ev, i) => {
              const active = i === currentEventIndex
              const reached = i <= currentEventIndex
              return (
                <li key={ev.seq}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(i)}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      active
                        ? ev.estPointDeBascule
                          ? 'bg-[#ffca34]/15'
                          : 'bg-white/10'
                        : 'hover:bg-white/5'
                    } ${reached ? '' : 'opacity-45'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`tnum text-[10px] font-semibold ${
                          ev.estPointDeBascule ? 'text-[#ffca34]' : 'text-white/50'
                        }`}
                      >
                        {String(ev.seq).padStart(2, '0')}
                      </span>
                      <span className="tnum text-[10px] text-white/35">{ev.date}</span>
                      {ev.types.map((t) => (
                        <span
                          key={t}
                          className="h-[7px] w-[7px] rounded-full"
                          style={{ backgroundColor: BASCULE_TYPE_META[t].couleur }}
                          title={BASCULE_TYPE_META[t].label}
                        />
                      ))}
                      <span className="tnum ml-auto truncate font-mono text-[9px] text-white/30">
                        {shortHash(ev.artefact.hash, 6, 4)}
                      </span>
                      {ev.estPointDeBascule && (
                        <span className="rounded-full border border-[#ffca34]/60 bg-[#ffca34]/20 px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-[0.1em] text-[#ffca34]">
                          bascule
                        </span>
                      )}
                    </div>
                    <div className="mt-[2px] truncate pl-6 text-[11px] text-white/65">{ev.titre}</div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* ── Carte détail de l'événement ── */}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {event.types.map((t) => (
              <span
                key={t}
                className="rounded-full border px-2 py-[2px] text-[9px] font-medium uppercase tracking-[0.12em]"
                style={{
                  color: BASCULE_TYPE_META[t].couleur,
                  borderColor: `${BASCULE_TYPE_META[t].couleur}55`,
                  backgroundColor: `${BASCULE_TYPE_META[t].couleur}14`,
                }}
              >
                {BASCULE_TYPE_META[t].label}
              </span>
            ))}
            <span className={`rounded-full border px-2 py-[2px] text-[9px] font-medium uppercase tracking-[0.12em] ${niveau.classes}`}>
              {niveau.label}
            </span>
            <span className="tnum ml-auto text-[11px] text-white/40">
              gravité {event.gravite}/5
            </span>
          </div>

          <div className="tnum mt-2 text-[11px] text-white/45">{event.date}</div>
          <h2 className="mt-1 text-[15px] font-semibold leading-snug text-[#f5f5f5]">
            {event.titre}
          </h2>

          {event.estPointDeBascule && (
            <div className="mt-2 rounded-md border border-[#ffca34]/60 bg-[#ffca34]/10 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffca34]">
                Point de bascule
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                La condition (iv) des lignes directrices C(2025) 884 — dommage significatif causé
                ou raisonnablement probable — devient incontestable : le passage à l'échelle rend
                le « significant harm » raisonnablement probable au moment même du lancement.
              </p>
            </div>
          )}

          <p className="mt-2.5 text-[12px] leading-relaxed text-white/65">{event.description}</p>

          {event.citation && (
            <blockquote className="mt-2.5 border-l-2 border-[#ffca34]/50 pl-3 text-[11px] italic leading-relaxed text-white/55">
              {event.citation}
            </blockquote>
          )}

          <div className="mt-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
              Fondement juridique
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/60">{event.articleApplicable}</p>
            <p className="mt-1.5 text-[11px] font-medium text-white/75">
              Statut : {event.statutJuridique}
            </p>
          </div>

          {/* Artefact JSON */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowArtefact((s) => !s)}
              className="flex w-full items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/15"
            >
              <span>
                Artefact JSON · réf. {event.artefact.preuve.ref}
              </span>
              <span className="text-white/40">{showArtefact ? '−' : '+'}</span>
            </button>
            <div className="tnum mt-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] text-white/45">
              <div className="flex justify-between gap-2">
                <span>prev</span>
                <span className="truncate" title={event.artefact.prev_hash}>
                  {shortHash(event.artefact.prev_hash, 10, 6)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>hash</span>
                <span className="truncate text-[#ffca34]" title={event.artefact.hash}>
                  {event.artefact.hash}
                </span>
              </div>
            </div>
            {showArtefact && (
              <pre className="tnum mt-1.5 max-h-[220px] overflow-auto rounded-md border border-white/10 bg-black/60 p-2 font-mono text-[10px] leading-relaxed text-white/55">
                {JSON.stringify(event.artefact, null, 2)}
              </pre>
            )}
          </div>

          {/* Analyse du point de bascule (événement 6) */}
          {event.estPointDeBascule && (
            <div className="mt-4 border-t border-[#ffca34]/30 pt-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#ffca34]">
                {POINT_DE_BASCULE.titre}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                {POINT_DE_BASCULE.intro}
              </p>
              <ul className="mt-2 space-y-2">
                {POINT_DE_BASCULE.conditions.map((c) => (
                  <li key={c.numero} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#ffca34]">{c.numero}</span>
                      <span className="tnum text-[10px] text-white/45">{c.atteinteDes}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/65">{c.texte}</p>
                    <p className="mt-1 text-[10px] leading-snug text-white/45">{c.analyse}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                {POINT_DE_BASCULE.argumentCle}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                {POINT_DE_BASCULE.declencheur}
              </p>
            </div>
          )}

          {/* Analyse finale */}
          {showAnalysis && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                Analyse — hallucination vs intention
              </div>

              <h3 className="mt-2.5 text-[13px] font-semibold text-[#f5f5f5]">
                {ANALYSE_FINALE.hallucination.titre}
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                {ANALYSE_FINALE.hallucination.texte}
              </p>

              <h3 className="mt-3 text-[13px] font-semibold text-[#f5f5f5]">
                {ANALYSE_FINALE.intention.titre}
              </h3>
              {ANALYSE_FINALE.intention.nuances.map((n, i) => (
                <p key={i} className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                  {n}
                </p>
              ))}

              <blockquote className="mt-3 rounded-md border border-[#ffca34]/40 bg-[#ffca34]/10 p-3 text-[11px] font-medium leading-relaxed text-[#ffdf80]">
                {ANALYSE_FINALE.formule}
              </blockquote>

              <h3 className="mt-4 text-[13px] font-semibold text-[#f5f5f5]">
                Sanctions encourues (Chapitre XII)
              </h3>
              <ul className="mt-2 space-y-2">
                {ANALYSE_FINALE.sanctions.map((s) => (
                  <li key={s.fondement} className="rounded-md border border-[#ff3b30]/30 bg-[#ff3b30]/10 px-2.5 py-2">
                    <div className="text-[11px] font-semibold text-[#ff8ba0]">{s.fondement}</div>
                    <div className="tnum mt-[2px] text-[12px] font-medium text-[#f5f5f5]">
                      {s.plafond}
                    </div>
                    <div className="mt-[2px] text-[10px] text-white/45">{s.note}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-white/55">
                {ANALYSE_FINALE.aggravants}
              </p>

              <h3 className="mt-4 text-[13px] font-semibold text-[#f5f5f5]">Chaîne causale</h3>
              <ol className="mt-2 space-y-0">
                {ANALYSE_FINALE.chaineCausale.map((c, i) => (
                  <li key={c.etape} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-[3px] h-[9px] w-[9px] shrink-0 rounded-full ${
                          i === ANALYSE_FINALE.chaineCausale.length - 1
                            ? 'bg-[#ff3b30] shadow-[0_0_8px_rgba(255,59,48,0.8)]'
                            : 'bg-[#ffca34]'
                        }`}
                      />
                      {i < ANALYSE_FINALE.chaineCausale.length - 1 && (
                        <span className="w-px flex-1 bg-white/15" />
                      )}
                    </div>
                    <div className="pb-2.5">
                      <div className="text-[11px] font-medium text-[#f5f5f5]">{c.etape}</div>
                      <div className="text-[10px] text-white/45">{c.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
