/**
 * TutorialOverlay — cadre doré autour de la zone ciblée + fond assombri
 * ailleurs (trou via box-shadow), carte titre/texte positionnée à côté
 * de la zone, navigation Suivant / Précédent / Passer, points de
 * progression. Les ACTIONS réelles des étapes sont exécutées par App
 * (pas ici) — ce composant est purement visuel.
 */
import { useEffect, useState } from 'react'
import type { TutoStep } from '../lib/tutorial'

interface TutorialOverlayProps {
  step: TutoStep
  index: number
  total: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

export default function TutorialOverlay({
  step,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
}: TutorialOverlayProps) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const zx = (step.zone.x / 100) * vp.w
  const zy = (step.zone.y / 100) * vp.h
  const zw = (step.zone.w / 100) * vp.w
  const zh = (step.zone.h / 100) * vp.h

  /* Position de la carte : à côté de la zone, bornée au viewport. */
  const CARD_W = 360
  let left = 0
  let top = 0
  if (step.cote === 'bas') {
    left = Math.min(Math.max(zx + zw / 2 - CARD_W / 2, 12), vp.w - CARD_W - 12)
    top = Math.min(zy + zh + 14, vp.h - 190)
  } else if (step.cote === 'haut') {
    left = Math.min(Math.max(zx + zw / 2 - CARD_W / 2, 12), vp.w - CARD_W - 12)
    top = Math.max(zy - 190, 12)
  } else if (step.cote === 'gauche') {
    left = Math.max(zx - CARD_W - 14, 12)
    top = Math.min(Math.max(zy + zh / 2 - 90, 12), vp.h - 190)
  } else {
    left = Math.min(zx + zw + 14, vp.w - CARD_W - 12)
    top = Math.min(Math.max(zy + zh / 2 - 90, 12), vp.h - 190)
  }

  return (
    <div className="absolute inset-0 z-[60]">
      {/* Trou : boîte transparente + ombre géante assombrie, cadre doré */}
      <div
        className="pointer-events-none absolute rounded-lg border-2 border-[#ffca34] transition-all duration-500"
        style={{
          left: zx,
          top: zy,
          width: zw,
          height: zh,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.72), 0 0 24px rgba(255,202,52,0.35)',
        }}
      />

      {/* Carte de l'étape */}
      <div
        className="absolute w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-[#ffca34]/30 bg-black/90 p-4 backdrop-blur-md transition-all duration-300"
        style={{ left, top }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="tnum font-mono text-[10px] uppercase tracking-[0.2em] text-[#ffca34]/80">
            Tuto · {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="text-[10px] text-white/40 transition-colors hover:text-white/80"
          >
            Passer le tuto (Échap)
          </button>
        </div>
        <h3 className="mt-1.5 text-[15px] font-semibold text-[#f5f5f5]">{step.titre}</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">{step.texte}</p>

        {/* Points de progression + navigation */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-[5px] w-[5px] rounded-full ${
                  i === index ? 'bg-[#ffca34]' : i < index ? 'bg-[#ffca34]/40' : 'bg-white/15'
                }`}
              />
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={index === 0}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Précédent
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-md border border-[#ffca34]/45 bg-[#ffca34]/12 px-2.5 py-1 text-[10px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/30"
            >
              {index === total - 1 ? 'Terminer' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
