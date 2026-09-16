import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scaleTime } from 'd3-scale'
import { MILESTONE_CATEGORIE_META, type Milestone } from '../data/aiActData'
import { formatDateLong, tsOf } from '../lib/time'

interface TimelineProps {
  currentTs: number
  startTs: number
  endTs: number
  milestones: Milestone[]
  playing: boolean
  vitesse: 1 | 4
  onTogglePlay: () => void
  onToggleVitesse: () => void
  onSeek: (ts: number) => void
  onSelectMilestone: (m: Milestone) => void
  /** Marqueur spécial « point de bascule » (mode La Bascule), ou null. */
  basculeMarkerTs?: number | null
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14Z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

export default function Timeline({
  currentTs,
  startTs,
  endTs,
  milestones,
  playing,
  vitesse,
  onTogglePlay,
  onToggleVitesse,
  onSeek,
  onSelectMilestone,
  basculeMarkerTs = null,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const draggingRef = useRef(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = useMemo(
    () => scaleTime().domain([new Date(startTs), new Date(endTs)]).range([0, Math.max(width, 1)]),
    [startTs, endTs, width],
  )

  const yearTicks = useMemo(() => {
    const ticks: { year: number; x: number }[] = []
    for (let y = new Date(startTs).getFullYear() + 1; y <= new Date(endTs).getFullYear(); y++) {
      const d = new Date(y, 0, 1)
      if (d.getTime() >= startTs && d.getTime() <= endTs) {
        ticks.push({ year: y, x: scale(d) })
      }
    }
    return ticks
  }, [startTs, endTs, scale])

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
      const date = scale.invert(x)
      onSeek(Math.min(Math.max(date.getTime(), startTs), endTs))
    },
    [scale, onSeek, startTs, endTs],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      seekFromClientX(e.clientX)
    },
    [seekFromClientX],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current) seekFromClientX(e.clientX)
    },
    [seekFromClientX],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  const cursorX = scale(new Date(currentTs))
  const progressPct = Math.min(100, Math.max(0, (cursorX / Math.max(width, 1)) * 100))

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/70 px-5 pb-4 pt-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-end gap-5">
        {/* Date courante en grand */}
        <div className="w-[300px] shrink-0 pb-[2px]">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            Date courante
          </div>
          <div className="tnum mt-1 text-lg font-medium leading-tight text-[#f5f5f5]">
            {formatDateLong(currentTs)}
          </div>
        </div>

        {/* Contrôles + piste */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={playing ? 'Pause' : 'Lecture'}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34] transition-colors hover:bg-[#ffca34]/30"
            >
              {playing ? <IconPause /> : <IconPlay />}
            </button>
            <button
              type="button"
              onClick={onToggleVitesse}
              aria-label="Changer la vitesse de lecture"
              className="tnum flex h-7 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/15"
            >
              ×{vitesse}
            </button>
            <span className="tnum ml-1 text-[11px] text-white/35">
              {vitesse} mois / seconde
            </span>
          </div>

          {/* Piste scrubbable */}
          <div
            ref={trackRef}
            className="relative h-12 cursor-pointer touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Ligne de base + progression */}
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
            <div
              className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[#ffca34]/70"
              style={{ width: `${progressPct}%` }}
            />

            {/* Graduations annuelles */}
            {yearTicks.map((t) => (
              <div key={t.year} className="absolute top-0 h-full" style={{ left: t.x }}>
                <div className="absolute top-[9px] h-[22px] w-px bg-white/20" />
                <div className="tnum absolute bottom-0 -translate-x-1/2 text-[10px] text-white/35">
                  {t.year}
                </div>
              </div>
            ))}

            {/* Marqueurs de jalons */}
            {milestones.map((m) => {
              const ts = tsOf(m.date)
              const x = scale(new Date(ts))
              const passed = ts <= currentTs
              const meta = MILESTONE_CATEGORIE_META[m.categorie]
              return (
                <button
                  key={m.date + m.titre}
                  type="button"
                  title={`${m.titre} — ${m.date}`}
                  aria-label={`Jalon : ${m.titre} (${m.date})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeek(ts)
                    onSelectMilestone(m)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="group absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 p-[6px]"
                  style={{ left: x }}
                >
                  <span
                    className="block h-[9px] w-[9px] rotate-45 rounded-[2px] border transition-transform group-hover:scale-150"
                    style={{
                      borderColor: meta.couleur,
                      backgroundColor: passed ? meta.couleur : 'transparent',
                      opacity: passed ? 1 : 0.55,
                    }}
                  />
                </button>
              )
            })}

            {/* Marqueur spécial « POINT DE BASCULE » (mode La Bascule) */}
            {basculeMarkerTs !== null && (
              <div
                className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: scale(new Date(basculeMarkerTs)) }}
              >
                <div className="flex flex-col items-center">
                  <span className="mb-[26px] whitespace-nowrap rounded-full border border-[#ffca34]/60 bg-black/85 px-2 py-[2px] text-[8px] font-semibold uppercase tracking-[0.14em] text-[#ffca34] shadow-[0_0_14px_rgba(255,202,52,0.45)]">
                    Point de bascule
                  </span>
                  <span className="absolute top-1/2 block h-[13px] w-[13px] -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-[#ffca34] bg-[#ffca34]/70 shadow-[0_0_16px_rgba(255,202,52,0.9)]" />
                </div>
              </div>
            )}

            {/* Curseur */}
            <div
              className="pointer-events-none absolute top-0 z-20 h-full -translate-x-1/2"
              style={{ left: cursorX }}
            >
              <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#ffca34]" />
              <div className="absolute left-1/2 top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ffca34] bg-black shadow-[0_0_12px_rgba(255,202,52,0.65)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
