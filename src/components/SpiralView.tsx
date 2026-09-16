/**
 * Vue SPIRALE TEMPORELLE (niveau 3 de l'échelle) — « quel est l'état à
 * une date donnée ? ». Scène three.js dédiée (pattern LayersView :
 * overlay plein écran, OrbitControls via three/addons, CSS2D labels).
 *
 * Placement (spec §3) : u(ts) = (ts−t0)/(t1−t0) ; H=60, R=14, TURNS=6 ;
 * y = H·u − H/2, θ = 2π·TURNS·u ; chaque nœud est posé à sa date
 * d'activation sur l'hélice ; actifDepuis === null → orbite extérieure
 * R+6 en bas (opacité 0,5) ; anti-chevauchement même date → R + 2,5·k ;
 * couleur = famille ; état à T : allumé + halo si actif (règle
 * visibleIdsAt), sinon 25 %.
 *
 * Scène : axe central gradué par année (2021…2030), origine lumineuse au
 * bas (21/04/2021), 25 jalons = sphères sur l'axe + lignes de rappel vers
 * labels en marge (clic → jalon + saut timeline), 4 anneaux d'époque
 * translucides + légende, curseur T = anneau doré #ffca34 draggable
 * (synchro bidirectionnelle avec la Timeline, commit débouncé par App).
 *
 * Sélection : clic nœud → fiche BLOC (App) + panneau de marge gauche
 * (mini-historique 5 entrées + jalons ± 6 mois) + ligne de rappel couleur
 * famille. Double-clic nœud → rapprochement animé. Bouton « Suivre le
 * temps » : caméra à hauteur du curseur T.
 *
 * Hook de test : window.__spiral = { nodeCount, outerCount,
 * milestoneCount, cursorU, litCount, points }.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import {
  CATEGORIE_META,
  MILESTONES,
  NODES,
  RANGE_END,
  RANGE_START,
  type ActNode,
  type NodeCategorie,
} from '../data/aiActData'
import { MS_PER_MONTH, tsOf } from '../lib/time'
import { shortHash } from '../lib/merkle'
import { getNodeHistory, useRegistry } from '../lib/versionStore'
import type { GraphNode } from './Graph3D'

const T0 = tsOf(RANGE_START)
const T1 = tsOf(RANGE_END)
const H = 60
const R = 14
const TURNS = 6

const uOf = (ts: number) => Math.min(1, Math.max(0, (ts - T0) / (T1 - T0)))
const yOf = (u: number) => H * u - H / 2
const thetaOf = (u: number) => 2 * Math.PI * TURNS * u

const EPOCHS: Array<{ date: string; label: string }> = [
  { date: '2021-04-21', label: 'Proposition de la Commission' },
  { date: '2024-08-01', label: 'Entrée en vigueur' },
  { date: '2025-02-02', label: 'Pratiques interdites applicables' },
  { date: '2026-08-02', label: 'Obligations haut risque' },
]

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function dim(hex: string, f: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

function shorten(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

const lit = (n: ActNode, ts: number, familles: Set<NodeCategorie>) =>
  (n.actifDepuis === null || tsOf(n.actifDepuis) <= ts) && familles.has(n.categorie)

interface SpiralViewProps {
  currentTs: number
  famillesVisibles: Set<NodeCategorie>
  selectedNodeId: string | null
  onSelectNode: (node: GraphNode | null) => void
  onSelectMilestone: (titre: string) => void
  onSeek: (ts: number) => void
  onExit: () => void
}

interface Node3D {
  node: ActNode
  x: number
  y: number
  z: number
  outer: boolean
}

export default function SpiralView({
  currentTs,
  famillesVisibles,
  selectedNodeId,
  onSelectNode,
  onSelectMilestone,
  onSeek,
  onExit,
}: SpiralViewProps) {
  useRegistry() // mini-historique réactif
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [follow, setFollow] = useState(false)

  /* Handles mutables de la scène (construite une fois au montage). */
  const sceneRef = useRef<{
    nodes: Node3D[]
    atoms: THREE.InstancedMesh | null
    halos: THREE.Sprite[]
    selHalo: THREE.Sprite
    selLine: THREE.Line
    cursor: THREE.Mesh
    controls: OrbitControls
    camera: THREE.PerspectiveCamera
    prevSel: number
    follow: boolean
  } | null>(null)
  const followRef = useRef(follow)
  followRef.current = follow
  const currentTsRef = useRef(currentTs)
  currentTsRef.current = currentTs

  const callbacksRef = useRef({ onSelectNode, onSelectMilestone, onSeek })
  callbacksRef.current = { onSelectNode, onSelectMilestone, onSeek }

  /* Positions hélicoïdales (statiques — données figées). */
  const nodesRef = useRef<Node3D[] | null>(null)
  if (nodesRef.current === null) {
    const out: Node3D[] = []
    const byDate = new Map<string, ActNode[]>()
    for (const n of NODES) {
      if (n.actifDepuis === null) continue
      const arr = byDate.get(n.actifDepuis)
      if (arr) arr.push(n)
      else byDate.set(n.actifDepuis, [n])
    }
    for (const [date, arr] of byDate) {
      const u = uOf(tsOf(date))
      const theta = thetaOf(u)
      const y = yOf(u)
      ;[...arr]
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .forEach((n, k) => {
          const r = R + 2.5 * k // anti-chevauchement : quartiers concentriques
          out.push({ node: n, x: r * Math.cos(theta), y, z: r * Math.sin(theta), outer: false })
        })
    }
    const outerNodes = NODES.filter((n) => n.actifDepuis === null)
    outerNodes.forEach((n, i) => {
      const a = (i / Math.max(1, outerNodes.length)) * 2 * Math.PI
      out.push({
        node: n,
        x: (R + 6) * Math.cos(a),
        y: -H / 2 - 3,
        z: (R + 6) * Math.sin(a),
        outer: true,
      })
    })
    nodesRef.current = out
  }

  /* ── Construction de la scène (une fois) ── */
  useEffect(() => {
    const container = containerRef.current
    const nodes = nodesRef.current
    if (!container || !nodes) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(container.clientWidth, container.clientHeight)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.inset = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)

    const scene = new THREE.Scene()
    const disposables: Array<{ dispose(): void }> = []
    const dist = 70 // cadrage ¾ : toute la hauteur de l'hélice (H=60) visible
    scene.fog = new THREE.Fog(0x000000, dist * 1.0, dist * 2.6)
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      400,
    )
    camera.position.set(dist * 0.72, 16, dist * 0.72) // vue ¾

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 6
    controls.maxDistance = 140

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3)
    dirLight.position.set(20, 40, 25)
    scene.add(dirLight)

    const glowTex = makeGlowTexture()
    disposables.push(glowTex)

    const mkLabel = (text: string, color: string, fontSize = 9) => {
      const div = document.createElement('div')
      div.className = 'spiral-label'
      div.style.cssText =
        `pointer-events:none;white-space:nowrap;font:${fontSize}px ui-monospace,SFMono-Regular,Menlo,monospace;` +
        `color:${color};background:rgba(0,0,0,0.6);padding:1px 5px;border-radius:3px;`
      div.textContent = text
      return new CSS2DObject(div)
    }

    /* ── Axe central + graduations années + origine ── */
    {
      const geo = new THREE.CylinderGeometry(0.06, 0.06, H + 8, 8)
      disposables.push(geo)
      const mat = new THREE.MeshBasicMaterial({ color: '#8ab4ff', transparent: true, opacity: 0.3 })
      disposables.push(mat)
      scene.add(new THREE.Mesh(geo, mat))
      for (let year = 2021; year <= 2030; year++) {
        const ts = year === 2021 ? T0 : tsOf(`${year}-01-01`)
        const y = yOf(uOf(ts))
        const tick = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0.4, y, 0),
          new THREE.Vector3(1.3, y, 0),
        ])
        disposables.push(tick)
        const tm = new THREE.LineBasicMaterial({ color: '#8ab4ff', transparent: true, opacity: 0.5 })
        disposables.push(tm)
        scene.add(new THREE.Line(tick, tm))
        const lbl = mkLabel(String(year), 'rgba(138,180,255,0.85)', 10)
        lbl.position.set(2.2, y, 0)
        scene.add(lbl)
      }
      // Origine lumineuse (21/04/2021).
      const smat = new THREE.SpriteMaterial({
        map: glowTex,
        color: '#ffca34',
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      disposables.push(smat)
      const sp = new THREE.Sprite(smat)
      sp.position.set(0, -H / 2, 0)
      sp.scale.setScalar(6)
      scene.add(sp)
      const org = mkLabel('21/04/2021 — origine du règlement', '#ffca34', 9)
      org.position.set(0, -H / 2 - 2.2, 0)
      scene.add(org)
    }

    /* ── Anneaux d'époque ── */
    for (const ep of EPOCHS) {
      const y = yOf(uOf(tsOf(ep.date)))
      const geo = new THREE.RingGeometry(R - 0.5, R + 9, 72)
      disposables.push(geo)
      const mat = new THREE.MeshBasicMaterial({
        color: '#8ab4ff',
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      disposables.push(mat)
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = y
      scene.add(ring)
    }

    /* ── Jalons : sphères sur l'axe + lignes de rappel + labels ── */
    const milestoneMeshes: THREE.Mesh[] = []
    {
      const geo = new THREE.SphereGeometry(0.42, 12, 10)
      disposables.push(geo)
      for (const m of MILESTONES) {
        const u = uOf(tsOf(m.date))
        const y = yOf(u)
        const theta = thetaOf(u)
        const mat = new THREE.MeshBasicMaterial({ color: '#f5f5f5' })
        disposables.push(mat)
        const sph = new THREE.Mesh(geo, mat)
        sph.position.set(0, y, 0)
        sph.userData.titre = m.titre
        sph.userData.date = m.date
        scene.add(sph)
        milestoneMeshes.push(sph)
        // Ligne de rappel vers le label en marge (extérieur de l'hélice).
        const anchor = new THREE.Vector3((R + 13) * Math.cos(theta), y, (R + 13) * Math.sin(theta))
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, y, 0), anchor])
        disposables.push(lg)
        const lm = new THREE.LineBasicMaterial({
          color: '#ffca34',
          transparent: true,
          opacity: 0.22,
        })
        disposables.push(lm)
        scene.add(new THREE.Line(lg, lm))
        const lbl = mkLabel(`${m.date} · ${shorten(m.titre, 24)}`, 'rgba(245,245,245,0.75)', 8)
        lbl.position.copy(anchor)
        scene.add(lbl)
      }
    }

    /* ── Nœuds : UN InstancedMesh + halos ── */
    const sphereGeo = new THREE.SphereGeometry(0.5, 14, 10)
    disposables.push(sphereGeo)
    const atomMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    disposables.push(atomMat)
    const atoms = new THREE.InstancedMesh(sphereGeo, atomMat, nodes.length)
    const m4 = new THREE.Matrix4()
    nodes.forEach((p, i) => {
      m4.makeScale(1, 1, 1)
      m4.setPosition(p.x, p.y, p.z)
      atoms.setMatrixAt(i, m4)
      atoms.setColorAt(i, new THREE.Color('#8ab4ff'))
    })
    atoms.instanceMatrix.needsUpdate = true
    scene.add(atoms)

    const halos: THREE.Sprite[] = nodes.map((p) => {
      const sm = new THREE.SpriteMaterial({
        map: glowTex,
        color: CATEGORIE_META[p.node.categorie].couleur,
        transparent: true,
        opacity: p.outer ? 0.3 : 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      disposables.push(sm)
      const s = new THREE.Sprite(sm)
      s.position.set(p.x, p.y, p.z)
      s.scale.setScalar(2.2)
      s.visible = false
      scene.add(s)
      return s
    })

    /* ── Halo + ligne de rappel de la sélection ── */
    const selHaloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    disposables.push(selHaloMat)
    const selHalo = new THREE.Sprite(selHaloMat)
    selHalo.scale.setScalar(3.4)
    selHalo.visible = false
    scene.add(selHalo)
    const selLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    disposables.push(selLineGeo)
    const selLineMat = new THREE.LineBasicMaterial({
      color: '#ffca34',
      transparent: true,
      opacity: 0.7,
    })
    disposables.push(selLineMat)
    const selLine = new THREE.Line(selLineGeo, selLineMat)
    selLine.visible = false
    scene.add(selLine)

    /* ── Curseur T : anneau doré draggable ── */
    const cursorGeo = new THREE.TorusGeometry(2.2, 0.13, 10, 48)
    disposables.push(cursorGeo)
    const cursorMat = new THREE.MeshBasicMaterial({
      color: '#ffca34',
      transparent: true,
      opacity: 0.95,
    })
    disposables.push(cursorMat)
    const cursor = new THREE.Mesh(cursorGeo, cursorMat)
    cursor.rotation.x = Math.PI / 2
    scene.add(cursor)

    sceneRef.current = {
      nodes,
      atoms,
      halos,
      selHalo,
      selLine,
      cursor,
      controls,
      camera,
      prevSel: -1,
      follow: false,
    }

    /* ── Interactions ── */
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let downX = 0
    let downY = 0
    let dragging = false
    let dragStartY = 0
    let dragStartU = 0
    let anim: {
      fromPos: THREE.Vector3
      toPos: THREE.Vector3
      fromTg: THREE.Vector3
      toTg: THREE.Vector3
      t0: number
    } | null = null

    const setMouse = (e: MouseEvent | PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
    }
    const onMove = (e: PointerEvent) => {
      if (dragging) return
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      if (raycaster.intersectObject(cursor, false)[0]) {
        setTooltip({ x: e.clientX, y: e.clientY, text: 'Curseur T — glisser pour voyager dans le temps' })
        renderer.domElement.style.cursor = 'ns-resize'
        return
      }
      const hitAtom = raycaster.intersectObject(atoms, false)[0]
      if (hitAtom && hitAtom.instanceId !== undefined) {
        const p = nodes[hitAtom.instanceId]
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          text: `${shorten(p.node.label, 40)} · ${p.node.actifDepuis ?? 'toujours visible'}`,
        })
        renderer.domElement.style.cursor = 'pointer'
        return
      }
      const hitMs = raycaster.intersectObjects(milestoneMeshes, false)[0]
      if (hitMs) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          text: `Jalon ${hitMs.object.userData.date} — ${shorten(hitMs.object.userData.titre as string, 40)}`,
        })
        renderer.domElement.style.cursor = 'pointer'
        return
      }
      setTooltip(null)
      renderer.domElement.style.cursor = 'grab'
    }
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      if (raycaster.intersectObject(cursor, false)[0]) {
        dragging = true
        dragStartY = e.clientY
        dragStartU = uOf(currentTsRef.current)
        controls.enabled = false
      }
    }
    const onUp = () => {
      if (dragging) {
        dragging = false
        controls.enabled = true
      }
    }
    const onDragMove = (e: PointerEvent) => {
      if (!dragging) return
      const du = (-(e.clientY - dragStartY) / container.clientHeight) * 1.2
      const u = Math.min(1, Math.max(0, dragStartU + du))
      callbacksRef.current.onSeek(T0 + u * (T1 - T0)) // commit débouncé côté App
    }
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      const hitAtom = raycaster.intersectObject(atoms, false)[0]
      if (hitAtom && hitAtom.instanceId !== undefined) {
        callbacksRef.current.onSelectNode(nodes[hitAtom.instanceId].node as GraphNode)
        return
      }
      const hitMs = raycaster.intersectObjects(milestoneMeshes, false)[0]
      if (hitMs) {
        callbacksRef.current.onSelectMilestone(hitMs.object.userData.titre as string)
        callbacksRef.current.onSeek(tsOf(hitMs.object.userData.date as string))
      }
    }
    const onDbl = (e: MouseEvent) => {
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      const hitAtom = raycaster.intersectObject(atoms, false)[0]
      if (hitAtom && hitAtom.instanceId !== undefined) {
        const p = nodes[hitAtom.instanceId]
        const target = new THREE.Vector3(p.x, p.y, p.z)
        anim = {
          fromPos: camera.position.clone(),
          toPos: new THREE.Vector3(p.x * 1.35, p.y + 4, p.z * 1.35),
          fromTg: controls.target.clone(),
          toTg: target,
          t0: performance.now(),
        }
      }
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('click', onClick)
    renderer.domElement.addEventListener('dblclick', onDbl)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointermove', onDragMove)

    /* ── Boucle + hook de test ── */
    const w = window as unknown as { __spiral?: unknown }
    const size = { w: container.clientWidth, h: container.clientHeight }
    const proj = new THREE.Vector3()
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (anim) {
        const t = Math.min(1, (performance.now() - anim.t0) / 900)
        const e2 = t * t * (3 - 2 * t)
        camera.position.lerpVectors(anim.fromPos, anim.toPos, e2)
        controls.target.lerpVectors(anim.fromTg, anim.toTg, e2)
        if (t >= 1) anim = null
      }
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
      const points = nodes.map((p) => {
        proj.set(p.x, p.y, p.z).project(camera)
        return {
          x: (proj.x * 0.5 + 0.5) * size.w,
          y: (-proj.y * 0.5 + 0.5) * size.h,
          id: p.node.id,
        }
      })
      const litCount = nodes.filter((p) => lit(p.node, currentTsRef.current, famillesRef.current)).length
      w.__spiral = {
        nodeCount: nodes.filter((p) => !p.outer).length,
        outerCount: nodes.filter((p) => p.outer).length,
        milestoneCount: milestoneMeshes.length,
        cursorU: uOf(currentTsRef.current),
        litCount,
        points,
      }
    }
    const famillesRef = { current: famillesVisibles }
    // famillesRef local mis à jour par l'effet dynamique ci-dessous.
    ;(sceneRef.current as { famillesRef?: typeof famillesRef }).famillesRef = famillesRef
    tick()

    const onResize = () => {
      size.w = container.clientWidth
      size.h = container.clientHeight
      camera.aspect = size.w / size.h
      camera.updateProjectionMatrix()
      renderer.setSize(size.w, size.h)
      labelRenderer.setSize(size.w, size.h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointermove', onDragMove)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.domElement.removeEventListener('dblclick', onDbl)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
      container.removeChild(labelRenderer.domElement)
      sceneRef.current = null
      delete w.__spiral
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Mises à jour dynamiques : curseur T, états allumé/grisé,
        sélection (halo + ligne de rappel), suivi du temps ── */
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    const u = uOf(currentTs)
    const cursorY = yOf(u)
    s.cursor.position.y = cursorY
    const col = new THREE.Color()
    const m4 = new THREE.Matrix4()
    s.nodes.forEach((p, i) => {
      const isLit = lit(p.node, currentTs, famillesVisibles)
      const base = CATEGORIE_META[p.node.categorie].couleur
      s.atoms!.setColorAt(i, col.set(isLit ? base : dim(base, 0.25)))
      s.halos[i].visible = isLit && !p.outer
      if (p.node.id === selectedNodeId) {
        m4.makeScale(1.5, 1.5, 1.5)
        m4.setPosition(p.x, p.y, p.z)
        s.atoms!.setMatrixAt(i, m4)
        s.selHalo.position.set(p.x, p.y, p.z)
        s.selHalo.visible = true
        ;(s.selLine.material as THREE.LineBasicMaterial).color.set(base)
        s.selLine.geometry.setFromPoints([
          new THREE.Vector3(p.x, p.y, p.z),
          new THREE.Vector3(p.x * 1.6, p.y, p.z * 1.6),
        ])
        s.selLine.visible = true
      } else if (s.prevSel === i) {
        m4.makeScale(1, 1, 1)
        m4.setPosition(p.x, p.y, p.z)
        s.atoms!.setMatrixAt(i, m4)
      }
    })
    s.prevSel = s.nodes.findIndex((p) => p.node.id === selectedNodeId)
    if (s.prevSel < 0) {
      s.selHalo.visible = false
      s.selLine.visible = false
    }
    s.atoms!.instanceMatrix.needsUpdate = true
    if (s.atoms!.instanceColor) s.atoms!.instanceColor.needsUpdate = true
    if (followRef.current) {
      s.controls.target.set(0, cursorY, 0)
      s.camera.position.y = cursorY + 10
    }
    // famillesRef partagé avec la boucle de rendu (litCount du hook).
    const fr = (s as { famillesRef?: { current: Set<NodeCategorie> } }).famillesRef
    if (fr) fr.current = famillesVisibles
  }, [currentTs, famillesVisibles, selectedNodeId])

  const selectedNode = NODES.find((n) => n.id === selectedNodeId) ?? null
  const miniHistory = selectedNode ? getNodeHistory(selectedNode.id).slice(-5).reverse() : []
  const nearMilestones = MILESTONES.filter(
    (m) => Math.abs(tsOf(m.date) - currentTs) <= 6 * MS_PER_MONTH,
  )

  return (
    <div ref={containerRef} className="absolute inset-0 z-[22] bg-black/90">
      {/* En-tête */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center">
        <div className="tnum font-mono text-[10px] uppercase tracking-[0.22em] text-[#ffca34]/80">
          Spirale temporelle — état à T
        </div>
        <div className="mt-0.5 text-[12px] text-white/60">
          {nodesRef.current?.filter((p) => !p.outer).length ?? 0} données datées ·{' '}
          {nodesRef.current?.filter((p) => p.outer).length ?? 0} toujours visibles ·{' '}
          {MILESTONES.length} jalons
        </div>
      </div>

      {/* Légende des époques (anneaux) */}
      <div className="pointer-events-none absolute left-4 top-[150px] z-10 rounded-md border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
        <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
          Époques
        </div>
        <ul className="mt-1 space-y-1">
          {EPOCHS.map((ep) => (
            <li key={ep.date} className="tnum flex items-center gap-2 text-[10px] text-white/55">
              <span className="inline-block h-[7px] w-[7px] rounded-full border border-[#8ab4ff]/60 bg-[#8ab4ff]/15" />
              <span className="font-mono text-white/40">{ep.date}</span> {ep.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Panneau de marge : mini-historique + jalons proches */}
      {selectedNode && (
        <div className="pointer-events-auto absolute left-4 top-[286px] z-10 w-[300px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-black/75 p-3 backdrop-blur-md">
          <div className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
            Mini-historique — {shorten(selectedNode.label, 30)}
          </div>
          {miniHistory.length === 0 ? (
            <p className="mt-1 text-[10px] text-white/40">Absente du registre pour l'instant.</p>
          ) : (
            <ul className="tnum mt-1.5 space-y-1 font-mono text-[10px] text-white/55">
              {miniHistory.map((h) => (
                <li key={h.versionIndex} className="flex items-center gap-2">
                  <span className="text-[#ffca34]">#v{h.versionIndex}</span>
                  <span className="text-white/35">{h.dateSimulee}</span>
                  <span className="truncate" title={h.leafHash}>
                    {shortHash(h.leafHash)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2.5 border-t border-white/10 pt-2 text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
            Jalons ± 6 mois
          </div>
          {nearMilestones.length === 0 ? (
            <p className="mt-1 text-[10px] text-white/40">Aucun jalon dans cette époque.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {nearMilestones.map((m) => (
                <li key={m.date}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMilestone(m.titre)
                      onSeek(tsOf(m.date))
                    }}
                    className="tnum text-left text-[10px] text-white/55 transition-colors hover:text-[#ffca34]"
                    title={`Saut au ${m.date}`}
                  >
                    <span className="font-mono text-white/35">{m.date}</span> · {shorten(m.titre, 30)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Infobulle */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[300px] rounded-md border border-white/20 bg-black/90 px-2.5 py-1.5 font-mono text-[10px] leading-snug text-white/80"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Actions bas de vue */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        <button
          type="button"
          onClick={() => setFollow((f) => !f)}
          aria-pressed={follow}
          className={`rounded-md border px-4 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
            follow
              ? 'border-[#ffca34]/50 bg-[#ffca34]/20 text-[#ffca34]'
              : 'border-white/15 bg-black/80 text-white/65 hover:bg-white/15'
          }`}
          title="Caméra à hauteur du curseur T"
        >
          Suivre le temps
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md border border-[#ffca34]/45 bg-black/80 px-4 py-1.5 text-[11px] font-medium text-[#ffca34] backdrop-blur-md transition-colors hover:bg-[#ffca34]/25"
          title="Touche Échap"
        >
          ← Retour au graphe
        </button>
      </div>
    </div>
  )
}
