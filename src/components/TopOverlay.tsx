import { formatDateShort } from '../lib/time'

interface TopOverlayProps {
  currentTs: number
}

export default function TopOverlay({ currentTs }: TopOverlayProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-6 py-3 text-center backdrop-blur-md">
      <h1 className="text-[15px] font-semibold tracking-wide text-[#f5f5f5]">
        AI Act — Observatoire 3D
      </h1>
      <p className="mt-[2px] text-[11px] text-white/45">
        Règlement (UE) 2024/1689 · graphe de connaissances temporel
      </p>
      <p className="tnum mt-1 text-[13px] font-medium text-[#ffca34]">{formatDateShort(currentTs)}</p>
    </div>
  )
}
