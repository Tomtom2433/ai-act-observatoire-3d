import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  NODES,
  LINKS,
  CATEGORIE_META,
  type ActNode,
  type NodeCategorie,
} from '../data/aiActData'
import { tsOf } from '../lib/time'
import { relationKind } from '../lib/relations'
import { getNodeHistory, type NodeHistoryEntry } from '../lib/versionStore'
import {
  BASCULE_CIRCUIT,
  BASCULE_PIVOT_INDEX,
  CIRCUIT_COLORS,
  basculeCircuitMap,
  circuitKey,
  type CircuitKind,
  type CircuitSegment,
} from '../lib/circuit'

export interface GraphNode extends ActNode {
  __o?: number
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
}

export interface GraphLinkLike {
  source: string | GraphNode
  target: string | GraphNode
  relation: string
}

interface ForceGraphHandle {
  cameraPosition: (
    pos?: { x: number; y: number; z: number },
    lookAt?: { x?: number; y?: number; z?: number },
    ms?: number,
  ) => any
  d3Force: (name: string) => any
  d3ReheatSimulation?: () => void
  scene: () => THREE.Scene
  camera: () => THREE.PerspectiveCamera
  renderer: () => THREE.WebGLRenderer
  postProcessingComposer?: () => { addPass: (p: unknown) => void }
}

export interface IsolationSpec {
  nodeId: string
  depth: 1 | 2 | 3
}

interface Graph3DProps {
  currentTs: number
  famillesVisibles: Set<NodeCategorie>
  resetSignal: number
  ramified: boolean
  /** Racine de l'arbre radial (nœud sélectionné, sinon racine par degré max). */
  ramifyRootId: string | null
  isolation: IsolationSpec | null
  diveNodeId: string | null
  /** Nœud sélectionné (mode Exploration) — pilote l'électrisation du voisinage. */
  selectedNodeId: string | null
  /** Index d'événement du scénario « La Bascule », null hors scénario. */
  basculeIndex: number | null
  /** Toggle « Courant » — coupe le moteur d'impulsions (accessibilité / perfs). */
  currentOn: boolean
  onSelectNode: (node: GraphNode | null) => void
  onDiveChange: (nodeId: string | null) => void
  onSeekVersion: (iso: string) => void
}

/* ── Données statiques — une seule instance pour toute la vie du composant.
   La simulation n'est jamais réinitialisée : la visibilité est gérée par
   opacité des matériaux (nœuds) et par l'accesseur linkVisibility (liens). */
const GRAPH_DATA = {
  nodes: NODES.map((n) => ({ ...n }) as GraphNode),
  links: LINKS.map((l) => ({ ...l }) as GraphLinkLike),
}

const ACTIVATION = new Map<string, number>(
  NODES.map((n) => [n.id, n.actifDepuis === null ? Number.NEGATIVE_INFINITY : tsOf(n.actifDepuis)]),
)

const BY_ID = new Map<string, GraphNode>(GRAPH_DATA.nodes.map((n) => [n.id, n]))

const DEGREE = new Map<string, number>()
const ADJACENCY = new Map<string, Set<string>>()
for (const l of LINKS) {
  DEGREE.set(l.source, (DEGREE.get(l.source) ?? 0) + 1)
  DEGREE.set(l.target, (DEGREE.get(l.target) ?? 0) + 1)
  if (!ADJACENCY.has(l.source)) ADJACENCY.set(l.source, new Set())
  if (!ADJACENCY.has(l.target)) ADJACENCY.set(l.target, new Set())
  ADJACENCY.get(l.source)!.add(l.target)
  ADJACENCY.get(l.target)!.add(l.source)
}

function linkEndId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id
}

/** Ensemble des nœuds à ≤ depth sauts (BFS sur le voisinage non orienté). */
function computeHopSet(nodeId: string, depth: number): Set<string> {
  const seen = new Set<string>([nodeId])
  let frontier = [nodeId]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const n of ADJACENCY.get(id) ?? []) {
        if (!seen.has(n)) {
          seen.add(n)
          next.push(n)
        }
      }
    }
    frontier = next
  }
  return seen
}

/* ── Ramification maison : arbre radial BFS (le graphe a des cycles, ce qui
   exclut le dagMode de 3d-force-graph — « Invalid DAG structure »).
   Layout en anneaux concentriques avec allocation d'angles par wedges. ── */
interface Vec3 {
  x: number
  y: number
  z: number
}

function computeRadialLayout(rootId: string): Map<string, Vec3> {
  const parent = new Map<string, string | null>([[rootId, null]])
  const level = new Map<string, number>([[rootId, 0]])
  const children = new Map<string, string[]>()
  const order = [rootId]
  for (let qi = 0; qi < order.length; qi++) {
    const id = order[qi]
    for (const n of ADJACENCY.get(id) ?? []) {
      if (!parent.has(n)) {
        parent.set(n, id)
        level.set(n, (level.get(id) ?? 0) + 1)
        if (!children.has(id)) children.set(id, [])
        children.get(id)!.push(n)
        order.push(n)
      }
    }
  }
  for (const n of GRAPH_DATA.nodes) {
    if (!parent.has(n.id)) level.set(n.id, 5)
  }
  // Angles : slots égaux pour les feuilles, wedge moyen pour les nœuds internes.
  const angle = new Map<string, number>()
  const leaves: string[] = []
  const collectLeaves = (id: string) => {
    const ch = children.get(id)
    if (!ch || ch.length === 0) leaves.push(id)
    else ch.forEach(collectLeaves)
  }
  collectLeaves(rootId)
  leaves.forEach((id, i) => angle.set(id, (i / Math.max(leaves.length, 1)) * Math.PI * 2))
  const assignInternal = (id: string): [number, number] => {
    const ch = children.get(id)
    if (!ch || ch.length === 0) {
      const a = angle.get(id) ?? 0
      return [a, a]
    }
    let min = Infinity
    let max = -Infinity
    for (const c of ch) {
      const [lo, hi] = assignInternal(c)
      min = Math.min(min, lo)
      max = Math.max(max, hi)
    }
    angle.set(id, (min + max) / 2)
    return [min, max]
  }
  assignInternal(rootId)
  const GAP = 80
  const out = new Map<string, Vec3>()
  for (const n of GRAPH_DATA.nodes) {
    const L = level.get(n.id) ?? 5
    const a = angle.get(n.id) ?? 0
    const r = L * GAP
    out.set(n.id, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r })
  }
  out.set(rootId, { x: 0, y: 0, z: 0 })
  return out
}

function defaultRamifyRoot(): string {
  let best = GRAPH_DATA.nodes[0].id
  let bestDeg = -1
  for (const [id, deg] of DEGREE) {
    if (deg > bestDeg) {
      bestDeg = deg
      best = id
    }
  }
  return best
}

function nodeRadius(id: string): number {
  return 2.1 + Math.sqrt(DEGREE.get(id) ?? 0) * 1.05
}

/* Texture de halo radial, partagée par tous les nœuds. */
let glowTextureCache: THREE.Texture | null = null
function glowTexture(): THREE.Texture {
  if (glowTextureCache) return glowTextureCache
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.35)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowTextureCache = new THREE.CanvasTexture(canvas)
  return glowTextureCache
}

interface NodeVisual {
  sphere: THREE.MeshBasicMaterial
  halo: THREE.SpriteMaterial
  group: THREE.Group
}

/* ── Plongée : tween de caméra en arc quadratique + easing. ── */
interface CamTween {
  t0: number
  dur: number
  fromPos: THREE.Vector3
  ctrl: THREE.Vector3
  toPos: THREE.Vector3
  fromLook: THREE.Vector3
  toLook: THREE.Vector3
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function quadBezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const u = 1 - t
  return new THREE.Vector3(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  )
}

const ORBITAL_COLORS: Record<NodeHistoryEntry['kind'], string> = {
  first: '#ffca34',
  modified: '#ff5872',
  present: '#9a9aad',
}

interface OrbitalInfo {
  entry: NodeHistoryEntry
  mesh: THREE.Mesh
}

interface DiveState {
  nodeId: string
  ring: THREE.Group
  orbitals: OrbitalInfo[]
  bornAt: number
}

export default function Graph3D({
  currentTs,
  famillesVisibles,
  resetSignal,
  ramified,
  ramifyRootId,
  isolation,
  diveNodeId,
  selectedNodeId,
  basculeIndex,
  currentOn,
  onSelectNode,
  onDiveChange,
  onSeekVersion,
}: Graph3DProps) {
  const fgRef = useRef<ForceGraphHandle | null>(null)
  const visualsRef = useRef(new Map<string, NodeVisual>())

  /* Refs lus par les accesseurs et la boucle d'animation (pas de re-render). */
  const tsRef = useRef(currentTs)
  const famillesRef = useRef(famillesVisibles)
  const hoverRef = useRef<GraphNode | null>(null)

  /* ── Circuit électrique : sélection, scénario, toggle, impulsions. ── */
  const selectedRef = useRef<string | null>(selectedNodeId)
  const basculeRef = useRef<number | null>(basculeIndex)
  const currentOnRef = useRef(currentOn)
  const impulsesRef = useRef<{
    pts: THREE.Points
    geo: THREE.BufferGeometry
    mat: THREE.PointsMaterial
    prog: Float32Array
    phase: Float32Array
  } | null>(null)
  const basculeCacheRef = useRef<{
    index: number
    links: Map<string, CircuitSegment>
    nodes: Map<string, CircuitSegment>
  } | null>(null)
  const basculeFlashRef = useRef(0)
  const prevBasculeRef = useRef<number | null>(basculeIndex)
  const circuitStatsRef = useRef({ on: currentOn, chemin: 0, brut: 0, decision: 0, violation: 0, pulses: 0 })

  /* Plongée / isolation / ramification — état interne par refs. */
  const diveRef = useRef<DiveState | null>(null)
  const camTweenRef = useRef<CamTween | null>(null)
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0))
  const isolationRef = useRef<{ nodeId: string; depth: number; set: Set<string> } | null>(null)
  const scanRingRef = useRef<THREE.Mesh | null>(null)
  const bloomRef = useRef<UnrealBloomPass | null>(null)
  const ramifyTweenRef = useRef<{
    t0: number
    dur: number
    fromMap: Map<string, Vec3>
    toMap: Map<string, Vec3>
  } | null>(null)

  /* Orbites : raycast souris + tooltip DOM manipulé directement. */
  const mouseNdcRef = useRef(new THREE.Vector2(-10, -10))
  const raycasterRef = useRef(new THREE.Raycaster())
  const hoverOrbitalRef = useRef<OrbitalInfo | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const lastNodeClickRef = useRef<{ id: string; t: number } | null>(null)
  const lastBgClickRef = useRef(0)
  const [tooltipContent, setTooltipContent] = useState<NodeHistoryEntry | null>(null)

  useEffect(() => {
    tsRef.current = currentTs
  }, [currentTs])

  useEffect(() => {
    famillesRef.current = famillesVisibles
  }, [famillesVisibles])

  /* ── Circuit : sync des props dans les refs + flash au point de bascule. ── */
  useEffect(() => {
    selectedRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    if (
      basculeIndex !== null &&
      basculeIndex >= BASCULE_PIVOT_INDEX &&
      (prevBasculeRef.current === null || prevBasculeRef.current < BASCULE_PIVOT_INDEX)
    ) {
      basculeFlashRef.current = performance.now()
    }
    prevBasculeRef.current = basculeIndex
    basculeRef.current = basculeIndex
  }, [basculeIndex])

  useEffect(() => {
    currentOnRef.current = currentOn
    if (impulsesRef.current) impulsesRef.current.pts.visible = currentOn
  }, [currentOn])

  /* ── Isolation : ensemble BFS + anneau de scan pulsé. ── */
  useEffect(() => {
    // Retirer l'anneau précédent.
    if (scanRingRef.current) {
      scanRingRef.current.parent?.remove(scanRingRef.current)
      ;(scanRingRef.current.material as THREE.Material).dispose()
      scanRingRef.current.geometry.dispose()
      scanRingRef.current = null
    }
    if (!isolation) {
      isolationRef.current = null
      return
    }
    isolationRef.current = {
      nodeId: isolation.nodeId,
      depth: isolation.depth,
      set: computeHopSet(isolation.nodeId, isolation.depth),
    }
    const v = visualsRef.current.get(isolation.nodeId)
    if (v) {
      const r = nodeRadius(isolation.nodeId)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 3.2, r * 3.2 + 1.1, 48),
        new THREE.MeshBasicMaterial({
          color: '#ffca34',
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      v.group.add(ring)
      scanRingRef.current = ring
    }
  }, [isolation])

  /* ── Tween caméra générique. ── */
  const flyCamera = useCallback((toPos: THREE.Vector3, toLook: THREE.Vector3, dur: number) => {
    const fg = fgRef.current
    if (!fg) return
    const fromPos = fg.camera().position.clone()
    const fromLook = lookAtRef.current.clone()
    const dir = toPos.clone().sub(fromPos)
    const len = Math.max(dir.length(), 1)
    const up = new THREE.Vector3(0, 1, 0)
    const perp = new THREE.Vector3().crossVectors(dir.clone().normalize(), up)
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0)
    perp.normalize()
    const ctrl = fromPos
      .clone()
      .add(toPos)
      .multiplyScalar(0.5)
      .add(perp.multiplyScalar(len * 0.28))
      .add(up.clone().multiplyScalar(len * 0.14))
    camTweenRef.current = { t0: performance.now(), dur, fromPos, ctrl, toPos, fromLook, toLook }
  }, [])

  /* ── Entrée en plongée : anneau orbital de l'historique + vol caméra. ── */
  const enterDive = useCallback(
    (nodeId: string) => {
      const node = BY_ID.get(nodeId)
      const v = visualsRef.current.get(nodeId)
      if (!node || !v || node.x === undefined) return

      let history = getNodeHistory(nodeId)
      if (history.length === 0) {
        history = [
          {
            versionIndex: -1,
            leafHash: '—',
            action: 'État courant (aucune version commitée ne contient encore cette molécule)',
            timestamp: Date.now(),
            dateSimulee: '',
            kind: 'first',
          },
        ]
      }

      const R = nodeRadius(nodeId) * 6 + 24
      const ring = new THREE.Group()
      const orbitals: OrbitalInfo[] = []
      const geo = new THREE.SphereGeometry(1.15, 12, 12)
      history.forEach((entry, i) => {
        const a = (i / history.length) * Math.PI * 2 - Math.PI / 2
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            color: ORBITAL_COLORS[entry.kind],
            transparent: true,
            opacity: 0,
          }),
        )
        mesh.position.set(Math.cos(a) * R, Math.sin(a) * R * 0.32, Math.sin(a) * R)
        mesh.userData.entry = entry
        ring.add(mesh)
        orbitals.push({ entry, mesh })
      })
      // Cercle guide de l'orbite.
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2 - Math.PI / 2
        pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R * 0.32, Math.sin(a) * R))
      }
      const guide = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: '#ffca34', transparent: true, opacity: 0.16 }),
      )
      ring.add(guide)
      ring.rotation.x = 0.42
      v.group.add(ring)

      diveRef.current = { nodeId, ring, orbitals, bornAt: performance.now() }

      // Vol cinématique vers le neurone.
      const fg = fgRef.current
      if (fg) {
        const nodePos = new THREE.Vector3(node.x, node.y, node.z)
        const camPos = fg.camera().position.clone()
        const dir = camPos.clone().sub(nodePos).normalize()
        const toPos = nodePos.clone().add(dir.multiplyScalar(nodeRadius(nodeId) * 8 + 30))
        flyCamera(toPos, nodePos, 2400)
      }
    },
    [flyCamera],
  )

  const exitDive = useCallback(() => {
    const dive = diveRef.current
    if (dive) {
      const v = visualsRef.current.get(dive.nodeId)
      if (v) {
        v.group.remove(dive.ring)
        dive.ring.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.material) (m.material as THREE.Material).dispose()
        })
      }
      diveRef.current = null
      hoverOrbitalRef.current = null
      setTooltipContent(null)
    }
    flyCamera(new THREE.Vector3(0, 30, 380), new THREE.Vector3(0, 0, 0), 1900)
  }, [flyCamera])

  /* Le prop diveNodeId pilote entrée/sortie (source de vérité : App). */
  useEffect(() => {
    const current = diveRef.current?.nodeId ?? null
    if (diveNodeId === current) return
    if (diveNodeId) enterDive(diveNodeId)
    else exitDive()
  }, [diveNodeId, enterDive, exitDive])

  const isNodeActive = useCallback((node: GraphNode): boolean => {
    return (
      (ACTIVATION.get(node.id) ?? Number.NEGATIVE_INFINITY) <= tsRef.current &&
      famillesRef.current.has(node.categorie)
    )
  }, [])

  /* ── Objet 3D custom : sphère + halo additif (look « Obsidian »). */
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const couleur = CATEGORIE_META[node.categorie].couleur
    const r = nodeRadius(node.id)

    const sphereMat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0 })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), sphereMat)

    const haloMat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: couleur,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.scale.setScalar(r * 6)

    const group = new THREE.Group()
    group.add(sphere)
    group.add(halo)
    group.visible = false

    visualsRef.current.set(node.id, { sphere: sphereMat, halo: haloMat, group })
    return group
  }, [])

  const nodeLabel = useCallback((node: GraphNode) => {
    const meta = CATEGORIE_META[node.categorie]
    return `<div style="font-weight:600">${node.label}</div><div style="opacity:.65;font-size:11px;margin-top:2px">${meta.label}</div>`
  }, [])

  /* ── Visibilité des liens : closure volontairement NON mémorisée. */
  const linkVisibility = (link: GraphLinkLike): boolean => {
    const s = BY_ID.get(linkEndId(link.source))
    const t = BY_ID.get(linkEndId(link.target))
    if (!s || !t) return false
    return (
      (ACTIVATION.get(s.id) ?? Number.NEGATIVE_INFINITY) <= currentTs &&
      (ACTIVATION.get(t.id) ?? Number.NEGATIVE_INFINITY) <= currentTs &&
      famillesVisibles.has(s.categorie) &&
      famillesVisibles.has(t.categorie)
    )
  }

  const linkColorFn = useCallback(
    (link: GraphLinkLike): string =>
      relationKind(link.relation) === 'action'
        ? 'rgba(255,202,52,0.30)'
        : 'rgba(135,135,150,0.25)',
    [],
  )

  const linkWidthFn = useCallback(
    (link: GraphLinkLike): number => (relationKind(link.relation) === 'action' ? 0.75 : 0.4),
    [],
  )

  /* ── Circuit électrique : résolution de l'état d'un lien (chemin / brut /
     décision / violation). Stable — ne lit que des refs et données module. ── */
  const getBasculeCache = useCallback((index: number) => {
    const c = basculeCacheRef.current
    if (c && c.index === index) return c
    const links = basculeCircuitMap(index)
    const nodes = new Map<string, CircuitSegment>()
    const last = Math.min(index, BASCULE_CIRCUIT.length - 1)
    for (let i = 0; i <= last; i++) {
      for (const sgm of BASCULE_CIRCUIT[i]) {
        nodes.set(sgm.s, sgm)
        nodes.set(sgm.t, sgm)
      }
    }
    const next = { index, links, nodes }
    basculeCacheRef.current = next
    return next
  }, [])

  const resolveCircuit = useCallback(
    (sid: string, tid: string): { color: string; kind: CircuitKind } | null => {
      if (!currentOnRef.current) return null
      const s = BY_ID.get(sid)
      const t = BY_ID.get(tid)
      if (!s || !t) return null
      if (!famillesRef.current.has(s.categorie) || !famillesRef.current.has(t.categorie)) return null
      const bi = basculeRef.current
      if (bi !== null) {
        // Scénario : la chronologie des événements prime sur la timeline —
        // un tronçon atteint est électrisé même si ses nœuds sont « futurs ».
        const sgm = getBasculeCache(bi).links.get(circuitKey(sid, tid))
        if (sgm) return { color: sgm.color, kind: sgm.kind }
        return { color: CIRCUIT_COLORS.brut, kind: 'brut' }
      }
      // Exploration : les liens masqués par la timeline n'ont pas d'état.
      if ((ACTIVATION.get(sid) ?? Number.NEGATIVE_INFINITY) > tsRef.current) return null
      if ((ACTIVATION.get(tid) ?? Number.NEGATIVE_INFINITY) > tsRef.current) return null
      const focus = hoverRef.current?.id ?? selectedRef.current
      if (focus && (sid === focus || tid === focus)) {
        const fn = BY_ID.get(focus)
        if (fn && fn.categorie === 'acteur') return { color: CIRCUIT_COLORS.decision, kind: 'decision' }
        return { color: CIRCUIT_COLORS.chemin, kind: 'chemin' }
      }
      // Liens des nœuds de décision (acteurs) : surcharge dorée permanente.
      if (s.categorie === 'acteur' || t.categorie === 'acteur') {
        return { color: CIRCUIT_COLORS.decision, kind: 'decision' }
      }
      return { color: CIRCUIT_COLORS.brut, kind: 'brut' }
    },
    [getBasculeCache],
  )

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      const next = node && isNodeActive(node) ? node : null
      if (next?.id === hoverRef.current?.id) return
      hoverRef.current = next
      document.body.style.cursor = next || hoverOrbitalRef.current ? 'pointer' : ''
    },
    [isNodeActive],
  )

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (!isNodeActive(node)) return
      const now = performance.now()
      const last = lastNodeClickRef.current
      lastNodeClickRef.current = { id: node.id, t: now }
      // Double-clic → plongée neuronale (fenêtre large : tolère les
      // machines lentes où les frames WebGL retardent les événements).
      if (last && last.id === node.id && now - last.t < 700) {
        onSelectNode(node)
        onDiveChange(node.id)
        return
      }
      // En plongée : sélection sans vol de caméra.
      if (diveRef.current) {
        onSelectNode(node)
        return
      }
      const fg = fgRef.current
      if (fg && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const distance = 95
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
        const look = { x: node.x, y: node.y, z: node.z }
        lookAtRef.current.set(node.x, node.y, node.z)
        fg.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          look,
          1400,
        )
      }
      onSelectNode(node)
    },
    [isNodeActive, onSelectNode, onDiveChange],
  )

  const handleBackgroundClick = useCallback(() => {
    const now = performance.now()
    const dt = now - lastBgClickRef.current
    lastBgClickRef.current = now
    if (diveRef.current) {
      // Clic sur une version orbitale → saut de timeline.
      const orb = hoverOrbitalRef.current
      if (orb && orb.entry.versionIndex >= 0) {
        onSeekVersion(orb.entry.dateSimulee)
        return
      }
      // Double-clic dans le vide → surface.
      if (dt < 700) onDiveChange(null)
      return
    }
    onSelectNode(null)
  }, [onSelectNode, onDiveChange, onSeekVersion])

  /* ── Souris NDC pour le raycast des orbites. ── */
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const el = fg.renderer().domElement
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      mouseNdcRef.current.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])

  /* ── Double-clic natif : plongée (nœud) / surface (vide).
     Détection en espace écran (tolérance ~40 px) — robuste aux vols de
     caméra et aux machines lentes, contrairement au timing de deux clics. */
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const el = fg.renderer().domElement
    const onDbl = (e: MouseEvent) => {
      const w = window as unknown as { __dbg?: { dbl: number; lastHit: string | null } }
      w.__dbg = w.__dbg ?? { dbl: 0, lastHit: null }
      w.__dbg.dbl += 1
      const r = el.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1
      const cam = fg.camera()
      const v = new THREE.Vector3()
      let best: GraphNode | null = null
      let bestD = 0.08
      for (const node of GRAPH_DATA.nodes) {
        if (node.x === undefined || node.y === undefined || node.z === undefined) continue
        if ((node.__o ?? 0) < 0.05) continue
        if ((ACTIVATION.get(node.id) ?? Number.NEGATIVE_INFINITY) > tsRef.current) continue
        if (!famillesRef.current.has(node.categorie)) continue
        v.set(node.x, node.y, node.z).project(cam)
        const d = Math.hypot(v.x - nx, v.y - ny)
        if (d < bestD) {
          bestD = d
          best = node
        }
      }
      w.__dbg.lastHit = best ? (best as GraphNode).id : null
      if (best) {
        onSelectNode(best)
        onDiveChange(best.id)
      } else if (diveRef.current) {
        onDiveChange(null)
      }
    }
    el.addEventListener('dblclick', onDbl)
    return () => el.removeEventListener('dblclick', onDbl)
  }, [onDiveChange, onSelectNode])

  /* ── Moteur d'impulsions électriques : UN seul THREE.Points pour tous les
     liens (train de 4 points par lien : tête brillante + traîne décroissante).
     Positions et couleurs mutées chaque frame par la boucle principale —
     blending additif : couleur noire = invisible. ── */
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const L = GRAPH_DATA.links.length
    const TRAIN = 4
    const N = L * TRAIN
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    const mat = new THREE.PointsMaterial({
      size: 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    pts.visible = currentOnRef.current
    fg.scene().add(pts)
    const prog = new Float32Array(L)
    const phase = new Float32Array(L)
    for (let i = 0; i < L; i++) {
      prog[i] = Math.random()
      phase[i] = Math.random()
    }
    impulsesRef.current = { pts, geo, mat, prog, phase }
    return () => {
      fg.scene().remove(pts)
      geo.dispose()
      mat.dispose()
      impulsesRef.current = null
    }
  }, [])

  /* ── Bloom léger (postprocessing) — avec repli silencieux.
     Le paramètre d'URL ?lite le désactive (tests headless SwiftShader). ── */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('lite')) return
    const fg = fgRef.current
    if (!fg || typeof fg.postProcessingComposer !== 'function') return
    const t = window.setTimeout(() => {
      try {
        const composer = fg.postProcessingComposer!()
        const bloom = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.55, // force
          0.5, // rayon
          0.82, // seuil — seuls les éléments brillants halotent
        )
        composer.addPass(bloom)
        bloomRef.current = bloom
      } catch {
        bloomRef.current = null
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [])

  /* ── Boucle d'animation unique : opacités, tween caméra, orbites,
     anneau de scan, dérive des particules. Tout par refs, zéro setState. */
  useEffect(() => {
    let raf = 0
    let lastT = performance.now()
    const tmpColor = new THREE.Color()
    const ghostColor = new THREE.Color('#55556a')
    const brutGhostColor = new THREE.Color('#5c7299')
    const goldColor = new THREE.Color('#ffca34')
    const wp = new THREE.Vector3()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min((now - lastT) / 1000, 0.5)
      lastT = now
      // Lissage temporel : indépendant du framerate (critique sur machine lente).
      const kFade = 1 - Math.exp(-dt * 9)
      const kScale = 1 - Math.exp(-dt * 14)
      const kColor = 1 - Math.exp(-dt * 6)
      const dive = diveRef.current
      const iso = isolationRef.current
      const hover = hoverRef.current
      const neigh = hover ? ADJACENCY.get(hover.id) : undefined

      /* Circuit : focus (survol > sélection) et cache des tronçons du scénario. */
      const circuitOn = currentOnRef.current
      const basculeIdx = basculeRef.current
      const bCache = circuitOn && basculeIdx !== null ? getBasculeCache(basculeIdx) : null
      const focusId = !dive && circuitOn ? (hover?.id ?? selectedRef.current) : null
      const focusNeigh = focusId ? ADJACENCY.get(focusId) : undefined
      const focusDecision = focusId ? BY_ID.get(focusId)?.categorie === 'acteur' : false
      // Surcharge au point de bascule : flash global décroissant (~1,4 s).
      const flash =
        basculeFlashRef.current > 0 ? Math.max(0, 1 - (now - basculeFlashRef.current) / 1400) : 0
      if (basculeFlashRef.current > 0 && flash <= 0) basculeFlashRef.current = 0
      if (bloomRef.current) bloomRef.current.strength = 0.55 + flash * 1.5

      for (const node of GRAPH_DATA.nodes) {
        const actif = (ACTIVATION.get(node.id) ?? Number.NEGATIVE_INFINITY) <= tsRef.current
        const familleOk = famillesRef.current.has(node.categorie)
        // Base : actif → 1 ; futur visible → fantôme 0.10 ; sinon 0.
        let target = 0
        if (familleOk) target = actif ? 1 : 0.1
        // Modes d'exploration.
        if (dive) {
          if (node.id === dive.nodeId) target = familleOk ? Math.max(target, 0.85) : 0.85
          else if (ADJACENCY.get(dive.nodeId)?.has(node.id)) target = Math.min(target, 0.38)
          else target = Math.min(target, 0.04)
        } else if (iso) {
          if (!iso.set.has(node.id)) target = Math.min(target, 0.015)
        } else if (hover && neigh && node.id !== hover.id && !neigh.has(node.id)) {
          target = Math.min(target, 0.07)
        }
        // Scénario : les nœuds d'un tronçon atteint se révèlent (même « futurs »).
        const bSeg = bCache?.nodes.get(node.id) ?? null
        if (bSeg && familleOk) target = Math.max(target, 0.55)
        const o = node.__o ?? 0
        const next = o + (target - o) * kFade
        node.__o = Math.abs(next - target) < 0.004 ? target : next
        const v = visualsRef.current.get(node.id)
        if (v) {
          v.sphere.opacity = node.__o
          v.halo.opacity = node.__o * 0.5
          // Halo d'alarme / surcharge pour les tronçons fautifs du scénario.
          if (bSeg && bSeg.kind === 'violation') {
            v.halo.opacity *= 0.55 + 0.45 * Math.abs(Math.sin(now * 0.011))
          } else if (bSeg && bSeg.kind === 'decision') {
            v.halo.opacity *= 0.8 + 0.3 * Math.abs(Math.sin(now * 0.013) * Math.sin(now * 0.0047))
          }
          v.group.visible = node.__o > 0.02
          // Couleur du halo : doré pour le neurone en plongée, couleur du
          // tronçon en scénario, cyan/doré pour le voisinage en focus,
          // bleu-gris pour les fantômes futurs (ÉTAT BRUT), famille sinon.
          if (dive && node.id === dive.nodeId) tmpColor.copy(goldColor)
          else if (bSeg) tmpColor.set(bSeg.color)
          else if (focusId && (node.id === focusId || focusNeigh?.has(node.id))) {
            tmpColor.set(focusDecision ? CIRCUIT_COLORS.decision : CIRCUIT_COLORS.chemin)
          } else if (familleOk && !actif) tmpColor.copy(circuitOn ? brutGhostColor : ghostColor)
          else tmpColor.set(CATEGORIE_META[node.categorie].couleur)
          v.halo.color.lerp(tmpColor, kColor)
          // Respiration du neurone central / survol.
          let targetScale = hover && node.id === hover.id ? 1.35 : 1
          if (dive && node.id === dive.nodeId) targetScale = 1.15 + Math.sin(now * 0.0024) * 0.07
          const s = v.group.scale.x + (targetScale - v.group.scale.x) * kScale
          v.group.scale.setScalar(s)
        }
      }

      /* Tween caméra (arc quadratique + easing). */
      const tween = camTweenRef.current
      const fg = fgRef.current
      if (tween && fg) {
        const t = Math.min((now - tween.t0) / tween.dur, 1)
        const e = easeInOutCubic(t)
        const pos = quadBezier(tween.fromPos, tween.ctrl, tween.toPos, e)
        const look = tween.fromLook.clone().lerp(tween.toLook, e)
        lookAtRef.current.copy(look)
        fg.cameraPosition({ x: pos.x, y: pos.y, z: pos.z }, { x: look.x, y: look.y, z: look.z }, 0)
        if (t >= 1) camTweenRef.current = null
      }

      /* Tween de ramification : déplacement des épingles fx/fy/fz. */
      const rt = ramifyTweenRef.current
      if (rt) {
        const t = Math.min((now - rt.t0) / rt.dur, 1)
        const e = easeInOutCubic(t)
        for (const node of GRAPH_DATA.nodes) {
          const to = rt.toMap.get(node.id)
          if (!to) continue
          const from = rt.fromMap.get(node.id) ?? { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 }
          node.fx = from.x + (to.x - from.x) * e
          node.fy = from.y + (to.y - from.y) * e
          node.fz = from.z + (to.z - from.z) * e
        }
        if (t >= 1) ramifyTweenRef.current = null
      }

      /* Anneau orbital : rotation lente + apparition progressive + raycast. */
      if (dive && fg) {
        dive.ring.rotation.y += 0.0022
        const fade = Math.min((now - dive.bornAt) / 1200, 1)
        for (const orb of dive.orbitals) {
          const m = orb.mesh.material as THREE.MeshBasicMaterial
          const hovered = hoverOrbitalRef.current === orb
          const target = fade * (hovered ? 1 : 0.85)
          m.opacity += (target - m.opacity) * 0.12
          const s = hovered ? 1.7 : 1
          orb.mesh.scale.setScalar(orb.mesh.scale.x + (s - orb.mesh.scale.x) * 0.2)
        }
        // Raycast des orbites.
        raycasterRef.current.setFromCamera(mouseNdcRef.current, fg.camera())
        const hits = raycasterRef.current.intersectObjects(dive.ring.children, false)
        const hitOrb =
          (hits
            .map((h) => dive.orbitals.find((o) => o.mesh === h.object))
            .find((o) => o !== undefined) as OrbitalInfo | undefined) ?? null
        if (hitOrb !== hoverOrbitalRef.current) {
          hoverOrbitalRef.current = hitOrb
          setTooltipContent(hitOrb ? hitOrb.entry : null)
          if (!hoverRef.current) document.body.style.cursor = hitOrb ? 'pointer' : ''
        }
        // Tooltip : positionnement direct du DOM (aucun setState par frame).
        const tip = tooltipRef.current
        if (tip) {
          if (hitOrb) {
            hitOrb.mesh.getWorldPosition(wp)
            wp.project(fg.camera())
            const el = fg.renderer().domElement
            const x = (wp.x * 0.5 + 0.5) * el.clientWidth
            const y = (-wp.y * 0.5 + 0.5) * el.clientHeight
            tip.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y - 10)}px)`
            tip.style.opacity = '1'
          } else {
            tip.style.opacity = '0'
          }
        }
      }

      /* Anneau de scan de l'isolation. */
      const scan = scanRingRef.current
      if (scan) {
        const p = (now % 1700) / 1700
        scan.scale.setScalar(1 + p * 2.3)
        ;(scan.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.5
        scan.rotation.z += 0.004
      }

      /* Liens : mutation directe des matériaux selon survol / plongée /
         état circuit. Les états sont résolus une fois par lien et par frame
         (cache), partagés avec le moteur d'impulsions. */
      const csCache = new Map<string, { color: string; kind: CircuitKind } | null>()
      const getCs = (a: string, b: string) => {
        const k = circuitKey(a, b)
        if (!csCache.has(k)) csCache.set(k, resolveCircuit(a, b))
        return csCache.get(k) ?? null
      }
      const csOpacity = (cs: { color: string; kind: CircuitKind }, ph: number): number => {
        switch (cs.kind) {
          case 'chemin':
            return 0.45 + 0.2 * Math.sin(now * 0.006 + ph * 6.2832)
          case 'brut':
            return 0.08 + 0.14 * Math.max(0, Math.sin(now * 0.0009 + ph * 6.2832))
          case 'decision':
            return (
              0.22 + 0.5 * Math.abs(Math.sin(now * 0.013 + ph * 9.4) * Math.sin(now * 0.0047 + ph * 3.1))
            )
          case 'violation':
            return Math.sin(now * 0.011 + ph * 4.0) > -0.2 ? 0.8 : 0.14
        }
      }
      const scene = fg?.scene?.()
      if (scene) {
        const hoverId = hover?.id ?? null
        const diveId = dive?.nodeId ?? null
        const isoSet = iso?.set ?? null
        scene.traverse((obj: any) => {
          const d = obj?.__data
          if (!d || d.relation === undefined || !obj.material) return
          if (!obj.__highlightReady) {
            obj.material = obj.material.clone()
            obj.__highlightReady = true
          }
          const m = obj.material as THREE.Material & { color?: THREE.Color; opacity?: number }
          if (!m.color) return
          m.transparent = true
          const sid = linkEndId(d.source)
          const tid = linkEndId(d.target)
          const isAction = relationKind(d.relation) === 'action'
          const cs = circuitOn ? getCs(sid, tid) : null
          // Scénario : un tronçon atteint reste visible même si la timeline
          // masque le lien (nœuds « futurs ») — le circuit est alimenté.
          if (bCache && circuitOn) {
            const isSeg = bCache.links.has(circuitKey(sid, tid))
            if (isSeg && !obj.visible) {
              obj.visible = true
              obj.__forcedVisible = true
            }
          }
          if (obj.__forcedVisible && (!bCache || !circuitOn || !bCache.links.has(circuitKey(sid, tid)))) {
            obj.visible =
              (ACTIVATION.get(sid) ?? Number.NEGATIVE_INFINITY) <= tsRef.current &&
              (ACTIVATION.get(tid) ?? Number.NEGATIVE_INFINITY) <= tsRef.current
            if (!obj.visible) obj.__forcedVisible = false
          }
          const ph = (sid.length * 7 + tid.length * 13) % 10 / 10
          if (diveId) {
            const touching = sid === diveId || tid === diveId
            if (touching) {
              m.color.set('#ffca34')
              m.opacity = 0.85
            } else {
              m.color.set('#6e6e7d')
              m.opacity = 0.05
            }
          } else if (isoSet) {
            const inside = isoSet.has(sid) && isoSet.has(tid)
            m.color.set(isAction ? '#ffca34' : '#878796')
            m.opacity = inside ? (isAction ? 0.5 : 0.3) : 0.02
          } else if (hoverId) {
            const touching = sid === hoverId || tid === hoverId
            if (touching) {
              m.color.set(cs ? cs.color : '#ffca34')
              m.opacity = 0.9
            } else if (cs) {
              m.color.set(cs.color)
              m.opacity = csOpacity(cs, ph) * 0.5
            } else {
              m.color.set('#6e6e7d')
              m.opacity = 0.04
            }
          } else if (cs) {
            m.color.set(cs.color)
            m.opacity = csOpacity(cs, ph)
          } else {
            m.color.set(isAction ? '#d8a92b' : '#878796')
            m.opacity = isAction ? 0.32 : 0.22
          }
        })
      }

      /* ── Impulsions électriques : trains d'ondes le long des liens.
         Tête brillante + traîne de 3 points décroissants ; vitesse et
         intensité dépendent de l'état sémantique du lien. ── */
      const imp = impulsesRef.current
      if (imp) {
        const posAttr = imp.geo.getAttribute('position') as THREE.BufferAttribute
        const colAttr = imp.geo.getAttribute('color') as THREE.BufferAttribute
        const pos = posAttr.array as Float32Array
        const col = colAttr.array as Float32Array
        const TRAIN = 4
        const SPEED: Record<CircuitKind, number> = {
          chemin: 0.34,
          brut: 0.05,
          decision: 0.6,
          violation: 0.22,
        }
        const boost = 1 + flash * 2.2
        const stats = circuitStatsRef.current
        stats.on = circuitOn
        stats.chemin = 0
        stats.brut = 0
        stats.decision = 0
        stats.violation = 0
        let li = 0
        for (const link of GRAPH_DATA.links) {
          const sid = linkEndId(link.source)
          const tid = linkEndId(link.target)
          const st = circuitOn ? getCs(sid, tid) : null
          const sn = BY_ID.get(sid)
          const tn = BY_ID.get(tid)
          const base = li * TRAIN
          if (st) stats[st.kind] += 1
          if (!st || !sn || !tn || sn.x === undefined || tn.x === undefined) {
            for (let j = 0; j < TRAIN; j++) {
              const pi = (base + j) * 3
              col[pi] = 0
              col[pi + 1] = 0
              col[pi + 2] = 0
            }
          } else {
            imp.prog[li] = (imp.prog[li] + dt * SPEED[st.kind]) % 1
            let inten: number
            switch (st.kind) {
              case 'chemin':
                inten = 1
                break
              case 'brut':
                inten = 0.16 + 0.34 * Math.max(0, Math.sin(now * 0.0009 + imp.phase[li] * 6.2832))
                break
              case 'decision':
                inten =
                  0.35 +
                  0.65 *
                    Math.abs(
                      Math.sin(now * 0.013 + imp.phase[li] * 9.4) *
                        Math.sin(now * 0.0047 + imp.phase[li] * 3.1),
                    )
                break
              case 'violation':
                inten = Math.sin(now * 0.011 + imp.phase[li] * 4.0) > -0.2 ? 1 : 0.08
                break
            }
            inten = Math.min(inten * boost, 2.6)
            tmpColor.set(st.color)
            const sy = sn.y ?? 0
            const sz = sn.z ?? 0
            const ty = tn.y ?? 0
            const tz = tn.z ?? 0
            for (let j = 0; j < TRAIN; j++) {
              let tj = imp.prog[li] - j * 0.045
              if (tj < 0) tj += 1
              const b = Math.pow(1 - j / TRAIN, 1.5) * inten
              const pi = (base + j) * 3
              pos[pi] = sn.x + (tn.x - sn.x) * tj
              pos[pi + 1] = sy + (ty - sy) * tj
              pos[pi + 2] = sz + (tz - sz) * tj
              col[pi] = tmpColor.r * b
              col[pi + 1] = tmpColor.g * b
              col[pi + 2] = tmpColor.b * b
            }
          }
          li++
        }
        stats.pulses = (stats.chemin + stats.brut + stats.decision + stats.violation) * TRAIN
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  /* ── Forces et position initiale de caméra. */
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge')
    if (charge?.strength) charge.strength(-170)
    const link = fg.d3Force('link')
    if (link?.distance) link.distance(58)
    const t = window.setTimeout(() => {
      lookAtRef.current.set(0, 0, 0)
      fg.cameraPosition({ x: 0, y: 30, z: 380 }, { x: 0, y: 0, z: 0 }, 0)
    }, 150)
    return () => window.clearTimeout(t)
  }, [])

  /* ── Reset caméra. */
  useEffect(() => {
    if (resetSignal === 0) return
    flyCamera(new THREE.Vector3(0, 30, 380), new THREE.Vector3(0, 0, 0), 1500)
  }, [resetSignal, flyCamera])

  /* ── Ramification : arbre radial BFS épinglé (fx/fy/fz) avec transition
     animée — pas de dagMode (le graphe a des cycles). ── */
  const firstRamifyRef = useRef(true)
  useEffect(() => {
    if (firstRamifyRef.current) {
      firstRamifyRef.current = false
      if (!ramified) return
    }
    const fg = fgRef.current
    if (ramified) {
      const root = ramifyRootId && BY_ID.has(ramifyRootId) ? ramifyRootId : defaultRamifyRoot()
      const toMap = computeRadialLayout(root)
      const fromMap = new Map<string, Vec3>(
        GRAPH_DATA.nodes.map((n) => [
          n.id,
          { x: n.fx ?? n.x ?? 0, y: n.fy ?? n.y ?? 0, z: n.fz ?? n.z ?? 0 },
        ]),
      )
      ramifyTweenRef.current = { t0: performance.now(), dur: 1800, fromMap, toMap }
      if (!diveRef.current) flyCamera(new THREE.Vector3(0, 90, 480), new THREE.Vector3(0, 0, 0), 1700)
    } else {
      // Libération : on dé-épingle et on réchauffe doucement — retour organique.
      ramifyTweenRef.current = null
      for (const n of GRAPH_DATA.nodes) {
        delete n.fx
        delete n.fy
        delete n.fz
      }
      fg?.d3ReheatSimulation?.()
      if (!diveRef.current) flyCamera(new THREE.Vector3(0, 30, 380), new THREE.Vector3(0, 0, 0), 1600)
    }
  }, [ramified, ramifyRootId, flyCamera])

  /* ── Hooks de diagnostic pour la vérification headless. ── */
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__graph = {
      diveState: () => diveRef.current?.nodeId ?? null,
      orbitalCount: () => diveRef.current?.orbitals.length ?? 0,
      isolationState: () => isolationRef.current?.nodeId ?? null,
      hopCount: () => isolationRef.current?.set.size ?? 0,
      bloom: () => bloomRef.current !== null,
      pinnedCount: () => GRAPH_DATA.nodes.filter((n) => n.fx !== undefined).length,
      opacityOf: (id: string) => BY_ID.get(id)?.__o ?? -1,
      visibleCount: () => GRAPH_DATA.nodes.filter((n) => (n.__o ?? 0) > 0.3).length,
      /** Compteurs du circuit électrique (états des liens + impulsions). */
      circuitStats: () => ({ ...circuitStatsRef.current }),
      /** État circuit courant d'un lien (ids non orientés). */
      circuitStateOf: (a: string, b: string) => resolveCircuit(a, b),
      /** Voisins non orientés d'un nœud (tests). */
      neighborsOf: (id: string) => Array.from(ADJACENCY.get(id) ?? []),
      /** Position écran (coordonnées client) d'un nœud — pour les tests. */
      screenPosOf: (id: string) => {
        const fg = fgRef.current
        const node = BY_ID.get(id)
        if (!fg || !node || node.x === undefined || node.y === undefined || node.z === undefined) {
          return null
        }
        const v = new THREE.Vector3(node.x, node.y, node.z).project(fg.camera())
        const el = fg.renderer().domElement
        const r = el.getBoundingClientRect()
        return {
          x: r.left + (v.x * 0.5 + 0.5) * r.width,
          y: r.top + (-v.y * 0.5 + 0.5) * r.height,
        }
      },
      /** Premier nœud actif dont le point écran est cliquable (tests). */
      freeNode: () => {
        const fg = fgRef.current
        if (!fg) return null
        const canvas = fg.renderer().domElement
        const v = new THREE.Vector3()
        const r = canvas.getBoundingClientRect()
        for (const node of GRAPH_DATA.nodes) {
          if (node.x === undefined || node.y === undefined || node.z === undefined) continue
          if ((node.__o ?? 0) < 0.3) continue
          if ((ACTIVATION.get(node.id) ?? Number.NEGATIVE_INFINITY) > tsRef.current) continue
          if (!famillesRef.current.has(node.categorie)) continue
          v.set(node.x, node.y, node.z).project(fg.camera())
          const x = r.left + (v.x * 0.5 + 0.5) * r.width
          const y = r.top + (-v.y * 0.5 + 0.5) * r.height
          if (x < 0 || y < 0 || x > r.left + r.width || y > r.top + r.height) continue
          const el = document.elementFromPoint(x, y)
          if (el === canvas || (el && canvas.contains(el))) return { id: node.id, x, y }
        }
        return null
      },
    }
    return () => {
      delete w.__graph
    }
  }, [])

  const graphData = useMemo(() => GRAPH_DATA, [])

  return (
    <div className="relative h-full w-full">
      <ForceGraph3D
        ref={fgRef as any}
        graphData={graphData as any}
        nodeThreeObject={nodeThreeObject as any}
        nodeLabel={nodeLabel as any}
        linkVisibility={linkVisibility as any}
        linkColor={linkColorFn as any}
        linkWidth={linkWidthFn as any}
        onNodeHover={handleNodeHover as any}
        onNodeClick={handleNodeClick as any}
        onBackgroundClick={handleBackgroundClick}
        backgroundColor="#000000"
        showNavInfo={false}
        nodeResolution={16}
        warmupTicks={70}
        cooldownTime={9000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.28}
      />
      {/* Tooltip des versions orbitales (positionné en direct par la boucle). */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-40 rounded-md border border-[#ffca34]/40 bg-black/85 px-2.5 py-1.5 opacity-0 backdrop-blur-md transition-opacity duration-150"
        style={{ willChange: 'transform' }}
      >
        {tooltipContent && (
          <>
            <div className="tnum text-[10px] font-semibold text-[#ffca34]">
              {tooltipContent.versionIndex >= 0 ? `Version v${tooltipContent.versionIndex}` : 'État courant'}
              {tooltipContent.kind === 'first' && ' · première apparition'}
              {tooltipContent.kind === 'modified' && ' · modifiée'}
            </div>
            <div className="mt-[2px] max-w-[240px] truncate text-[10px] text-white/60">
              {tooltipContent.action}
            </div>
            {tooltipContent.leafHash !== '—' && (
              <div className="tnum mt-[2px] font-mono text-[9px] text-white/35">
                {tooltipContent.leafHash.slice(0, 12)}…
              </div>
            )}
            <div className="mt-[2px] text-[9px] text-white/40">Clic → sauter à cette date</div>
          </>
        )}
      </div>
    </div>
  )
}
