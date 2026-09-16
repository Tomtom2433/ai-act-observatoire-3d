import { MILESTONE_CATEGORIE_META, type Milestone } from '../data/aiActData'
import { formatDateShort, tsOf } from '../lib/time'

interface MilestonePanelProps {
  milestone: Milestone | null
  index: number
  total: number
}

export default function MilestonePanel({ milestone, index, total }: MilestonePanelProps) {
  return (
    <div className="pointer-events-auto absolute bottom-[132px] left-4 z-20 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-black/70 p-4 backdrop-blur-md">
      {milestone ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex items-center rounded-full border px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em]"
              style={{
                color: MILESTONE_CATEGORIE_META[milestone.categorie].couleur,
                borderColor: `${MILESTONE_CATEGORIE_META[milestone.categorie].couleur}55`,
                backgroundColor: `${MILESTONE_CATEGORIE_META[milestone.categorie].couleur}14`,
              }}
            >
              {MILESTONE_CATEGORIE_META[milestone.categorie].label}
            </span>
            <span className="tnum text-[11px] text-white/40">
              Jalon {index + 1} / {total} · {formatDateShort(tsOf(milestone.date))}
            </span>
          </div>
          <h2 className="mt-2.5 text-[15px] font-semibold leading-snug text-[#f5f5f5]">
            {milestone.titre}
          </h2>
          <p className="mt-1.5 max-h-[130px] overflow-y-auto text-[12px] leading-relaxed text-white/65">
            {milestone.description}
          </p>
          <a
            href={milestone.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#ffca34] transition-colors hover:text-[#ffd967]"
          >
            Source : {milestone.sourceLabel}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </>
      ) : (
        <p className="text-[12px] text-white/50">
          Avant le premier jalon : faites avancer la timeline pour découvrir la chronologie de
          l&apos;AI Act.
        </p>
      )}
    </div>
  )
}
