/**
 * CycleVerifyDiagram — cycle de vérification (spec §4, image « cristal
 * temporel » : états → actions → cycle qui doit se refermer).
 *
 * SVG circulaire : N pastilles = les N dernières versions (N ≤ 24, plus
 * récentes), première en haut ; flèches courbes entre pastilles
 * consécutives (l'« action » prevHash → hash).
 *
 * Mécanique — JAMAIS d'animation verte sans résultat réel :
 *  1. « Vérifier le cycle » appelle runVerification() (re-hachage RÉEL et
 *     synchrone de toute la chaîne : racines Merkle + hashes + chaînage) ;
 *  2. l'animation (~120 ms/maillon) ne fait que RÉVÉLER le verdict déjà
 *     calculé : flèches vertes séquentiellement jusqu'au maillon fautif ;
 *  3. chaîne saine → la flèche de fermeture se referme en vert, badge
 *     « ✓ cycle fermé — chaîne intègre » ; chaîne rompue → la flèche
 *     fautive devient rouge pointillée, le cycle reste VISUELLEMENT
 *     OUVERT, badge « ✗ cycle rompu au bloc n°i ».
 *
 * États : non vérifié (gris) / en cours / intègre / rompu. Raccordé à
 * sabotage()/repair() : tout changement du registre réinitialise le
 * diagramme — une nouvelle vérification est exigée pour refermer.
 */
import { useEffect, useState } from 'react'
import { shortHash } from '../lib/merkle'
import { runVerification, useRegistry } from '../lib/versionStore'

const MAX_NODES = 24
const LINK_MS = 120
const CX = 130
const CY = 128
const RADIUS = 88

type Phase = 'idle' | 'animating' | 'done'
type LinkState = 'idle' | 'ok' | 'broken'
type NodeState = 'idle' | 'ok' | 'broken' | 'warn'

const LINK_COLOR: Record<LinkState, string> = {
  idle: 'rgba(255,255,255,0.22)',
  ok: '#00ffa3',
  broken: '#ff3b30',
}
const NODE_FILL: Record<NodeState, string> = {
  idle: 'rgba(255,255,255,0.08)',
  ok: 'rgba(0,255,163,0.18)',
  broken: 'rgba(255,59,48,0.22)',
  warn: 'rgba(255,138,61,0.15)',
}
const NODE_STROKE: Record<NodeState, string> = {
  idle: 'rgba(255,255,255,0.3)',
  ok: '#00ffa3',
  broken: '#ff3b30',
  warn: '#ff8a3d',
}

const polar = (a: number, r: number) =>
  [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const

export default function CycleVerifyDiagram() {
  const { versions, sabotage: sabotageInfo, verification } = useRegistry()
  const [phase, setPhase] = useState<Phase>('idle')
  const [lit, setLit] = useState(0) // nombre de maillons révélés

  const n = Math.min(MAX_NODES, versions.length)
  const offset = versions.length - n

  /* Tout changement du registre (commit, sabotage, réparation) invalide
     l'affichage : retour à « non vérifié ». */
  useEffect(() => {
    setPhase('idle')
    setLit(0)
  }, [versions, sabotageInfo])

  /* Maillon fautif (flèche ENTRANT dans le bloc rompu, en coordonnées
     locales à la fenêtre affichée). */
  const brokenNode =
    verification && verification.brokenAt !== null
      ? Math.max(0, verification.brokenAt - offset)
      : null
  const brokenLink = brokenNode !== null ? (brokenNode - 1 + n) % n : null
  const maxLit = brokenLink !== null ? brokenLink + 1 : n

  /* Révélation séquentielle — le verdict est déjà calculé, on ne fait
     que l'allumer maillon par maillon. */
  useEffect(() => {
    if (phase !== 'animating') return
    if (lit >= maxLit) {
      setPhase('done')
      return
    }
    const id = window.setTimeout(() => setLit((l) => l + 1), LINK_MS)
    return () => window.clearTimeout(id)
  }, [phase, lit, maxLit])

  const run = () => {
    runVerification() // RÉEL et synchrone — le verdict existe avant toute animation
    setLit(0)
    setPhase('animating')
  }

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const span = (2 * Math.PI) / n
  const gap = Math.min(0.32, span * 0.22)

  const linkState = (i: number): LinkState => {
    if (phase === 'idle' || !verification) return 'idle'
    if (i >= lit) return 'idle'
    if (brokenLink !== null && i === brokenLink) return 'broken'
    return 'ok'
  }
  const nodeState = (i: number): NodeState => {
    if (phase === 'idle' || !verification) return 'idle'
    const ok = verification.statuses[offset + i]
    if (brokenNode !== null && i === brokenNode && lit > brokenLink!) return 'broken'
    if (ok && i <= lit) return 'ok'
    if (!ok && phase === 'done') return 'warn' // invalide par cascade (aval)
    return 'idle'
  }

  const arcPath = (i: number) => {
    const [x0, y0] = polar(angle(i) + gap, RADIUS)
    const [x1, y1] = polar(angle(i) + span - gap, RADIUS)
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${RADIUS} ${RADIUS} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }

  const brokenVersionIndex =
    brokenNode !== null ? versions[offset + brokenNode]?.index : null

  return (
    <div className="cycle-diagram mt-3 rounded-md border border-white/10 bg-white/[0.02] p-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
          Cycle de vérification — {n} dernières versions
        </span>
        <button
          type="button"
          onClick={run}
          disabled={n < 2 || phase === 'animating'}
          className="rounded-md border border-[#ffca34]/40 bg-[#ffca34]/10 px-2 py-1 text-[10px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === 'animating' ? `Vérification… ${lit}/${maxLit}` : 'Vérifier le cycle'}
        </button>
      </div>

      <div className="relative">
        <svg viewBox="0 0 260 256" className="mx-auto block w-full max-w-[300px]">
          <defs>
            <marker id="cyc-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#00ffa3" />
            </marker>
            <marker id="cyc-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#ff3b30" />
            </marker>
            <marker id="cyc-i" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(255,255,255,0.25)" />
            </marker>
          </defs>

          {/* Maillons (flèches courbes prevHash → hash ; le dernier = fermeture) */}
          {n > 1 &&
            Array.from({ length: n }, (_, i) => {
              const st = linkState(i)
              return (
                <path
                  key={i}
                  className={`cycle-link${i === n - 1 ? ' cycle-link-closing' : ''}`}
                  data-state={st}
                  d={arcPath(i)}
                  fill="none"
                  stroke={LINK_COLOR[st]}
                  strokeWidth={st === 'idle' ? 1.2 : 2.2}
                  strokeDasharray={st === 'broken' ? '5 4' : undefined}
                  markerEnd={`url(#cyc-${st === 'ok' ? 'g' : st === 'broken' ? 'r' : 'i'})`}
                />
              )
            })}

          {/* Pastilles = versions */}
          {versions.slice(offset).map((v, i) => {
            const st = nodeState(i)
            const [x, y] = polar(angle(i), RADIUS)
            const [lx, ly] = polar(angle(i), RADIUS + 17)
            return (
              <g key={v.index} className="cycle-node" data-state={st}>
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  fill={NODE_FILL[st]}
                  stroke={NODE_STROKE[st]}
                  strokeWidth={st === 'idle' ? 1 : 1.6}
                />
                <text
                  x={x}
                  y={y + 2.4}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontFamily="ui-monospace, monospace"
                  fill={st === 'idle' ? 'rgba(255,255,255,0.6)' : NODE_STROKE[st]}
                >
                  {v.index}
                </text>
                <text
                  x={lx}
                  y={ly + 2}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontFamily="ui-monospace, monospace"
                  fill="rgba(255,255,255,0.4)"
                >
                  #v{v.index} {shortHash(v.hash, 5, 3)}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Badge central */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`max-w-[150px] rounded-md border px-2.5 py-1.5 text-center text-[10px] font-medium leading-snug ${
              phase === 'done' && verification?.ok
                ? 'border-[#00ffa3]/50 bg-black/85 text-[#00ffa3]'
                : phase === 'done' && verification && !verification.ok
                  ? 'border-[#ff3b30]/50 bg-black/85 text-[#ff6b62]'
                  : 'border-white/15 bg-black/85 text-white/45'
            }`}
          >
            {phase === 'done' && verification ? (
              verification.ok ? (
                '✓ cycle fermé — chaîne intègre'
              ) : (
                `✗ cycle rompu au bloc n°${brokenVersionIndex}`
              )
            ) : phase === 'animating' ? (
              'vérification…'
            ) : (
              'cycle non vérifié'
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
