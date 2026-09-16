/**
 * Vue 2D — même dataset, mêmes filtres temporels et couleurs de famille
 * que la vue 3D, rendue en canvas 2D (react-force-graph-2d).
 *
 * Clic nœud → sélection (le commit de version est fait par App, comme en
 * 3D) ; clic fond → désélection ; survol → curseur pointeur + infobulle
 * native (nodeLabel). Liens « appartenance » (est_un, inclut, comprend,
 * regroupe, est_sous_categorie_de) en pointillés fins ; liens « action »
 * pleins avec flèche. Nœud sélectionné : anneau doré + halo.
 */
import { useMemo, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { CATEGORIE_META, LINKS, NODES, type ActLink } from '../data/aiActData'
import { tsOf } from '../lib/time'
import type { GraphNode } from './Graph3D'

/** Relations structurelles (pointillés) vs relations d'action (plein). */
const APPARTENANCE = new Set(['est_un', 'inclut', 'comprend', 'regroupe', 'est_sous_categorie_de'])

interface Graph2DProps {
  currentTs: number
  famillesVisibles: Set<string>
  selectedNodeId: string | null
  onSelectNode: (node: GraphNode | null) => void
}

export default function Graph2D({
  currentTs,
  famillesVisibles,
  selectedNodeId,
  onSelectNode,
}: Graph2DProps) {
  const fgRef = useRef<{ zoomToFit?: (ms?: number, px?: number) => void } | null>(null)

  /* Même règle de visibilité que la 3D : actifDepuis ≤ T + famille visible. */
  const data = useMemo(() => {
    const nodes = NODES.filter(
      (n) =>
        (n.actifDepuis === null || tsOf(n.actifDepuis) <= currentTs) &&
        famillesVisibles.has(n.categorie),
    ).map((n) => ({ ...n }))
    const ids = new Set(nodes.map((n) => n.id))
    const links = LINKS.filter((l) => ids.has(l.source as string) && ids.has(l.target as string)).map(
      (l) => ({ ...l }),
    )
    return { nodes, links }
  }, [currentTs, famillesVisibles])

  return (
    <ForceGraph2D
      ref={fgRef as never}
      graphData={data}
      nodeId="id"
      backgroundColor="rgba(0,0,0,0)"
      nodeLabel={(n) => (n as GraphNode).label}
      nodeCanvasObject={(n, ctx) => {
        const node = n as GraphNode & { x: number; y: number }
        const meta = CATEGORIE_META[node.categorie]
        const isSel = node.id === selectedNodeId
        const r = isSel ? 6 : 5
        if (isSel) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 4.5, 0, 2 * Math.PI)
          ctx.fillStyle = 'rgba(255,202,52,0.18)'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 2.5, 0, 2 * Math.PI)
          ctx.strokeStyle = '#ffca34'
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        ctx.fillStyle = meta.couleur
        ctx.globalAlpha = 0.92
        ctx.fill()
        ctx.globalAlpha = 1
      }}
      nodePointerAreaPaint={(n, color, ctx) => {
        const node = n as GraphNode & { x: number; y: number }
        ctx.beginPath()
        ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
      }}
      linkColor={() => 'rgba(140,160,200,0.32)'}
      linkWidth={(l) => (APPARTENANCE.has((l as ActLink).relation) ? 0.6 : 1.1)}
      linkLineDash={(l) => (APPARTENANCE.has((l as ActLink).relation) ? [3, 3] : null)}
      linkDirectionalArrowLength={(l) => (APPARTENANCE.has((l as ActLink).relation) ? 0 : 3)}
      linkDirectionalArrowRelPos={0.85}
      onNodeClick={(n) => onSelectNode(n as GraphNode)}
      onBackgroundClick={() => onSelectNode(null)}
      onNodeHover={(n) => {
        document.body.style.cursor = n ? 'pointer' : 'default'
      }}
      onEngineStop={() => fgRef.current?.zoomToFit?.(600, 60)}
      warmupTicks={90}
      cooldownTime={3500}
    />
  )
}
