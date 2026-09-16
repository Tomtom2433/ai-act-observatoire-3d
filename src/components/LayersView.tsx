/**
 * Mode « COUCHES » — vue 3D éclatée des versions d'une donnée,
 * matière « cristal moléculaire / graphène ».
 *
 * Scène three.js dédiée (overlay plein écran au-dessus du graphe,
 * indépendante de react-force-graph) :
 *  - chaque couche = les FEUILLES de sa version posées sur un treillis
 *    carré régulier : atomes = sphères (UN InstancedMesh global),
 *    liaisons fines entre voisins du treillis (LineSegments fusionné) ;
 *  - code couleur fonctionnel : donnée elle-même = gros atome couleur
 *    famille ; leafHash différent de la couche précédente = rouge
 *    #ff5872 ; nouvelle feuille = doré #ffca34 ; inchangé = bleu-gris
 *    tamisé ; atomes modifiés/nouveaux flottent au-dessus du treillis
 *    avec un halo sprite sobre ;
 *  - vias entre couches consécutives à la position du MÊME leafId :
 *    dorée fine = inchangé (lignes fusionnées), rouge épaisse = modifié
 *    (cylindre, infobulle diff au survol) ;
 *  - plan plein supprimé : un cadre de contour discret (couleur du kind)
 *    + un plan de clic invisible conservent la sélection de couche ;
 *  - profondeur : fog noir léger ; lueurs : sprites additifs, aucun
 *    postprocessing ;
 *  - labels CSS2D (#v + date + action), clic couche OU atome (atome →
 *    preuve centrée sur cette feuille dans la HistoryCard), bouton
 *    Retour / Échap : inchangés.
 *
 * Hook de test : window.__layers = { count, atoms, points, selected }.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { CATEGORIE_META, NODES } from '../data/aiActData'
import { shortHash } from '../lib/merkle'
import { findModification, getNodeHistory, useRegistry } from '../lib/versionStore'

const KIND_COLOR = { first: '#ffca34', modified: '#ff5872', present: '#8ab4ff' } as const

const SPACING_Y = 1.05
const LIFT_LAST = 0.4
const GRID = 0.42
const ATOM_R = 0.085
const FLOAT_DY = 0.13

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Assombrit une couleur hex (atomes inchangés tamisés). */
function dim(hex: string, f: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

function shorten(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** Texture de halo radial doux (partagée par tous les sprites). */
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

interface LayersViewProps {
  nodeId: string
  selectedVersionIndex: number | null
  selectedLeafId: string | null
  onSelectVersion: (versionIndex: number, leafId: string | null) => void
  onExit: () => void
}

export default function LayersView({
  nodeId,
  selectedVersionIndex,
  selectedLeafId,
  onSelectVersion,
  onExit,
}: LayersViewProps) {
  const registry = useRegistry() // réactivité : nouvelles versions / sabotage
  const containerRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef(onSelectVersion)
  selectRef.current = onSelectVersion
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const history = getNodeHistory(nodeId)
  const node = NODES.find((n) => n.id === nodeId)
  const nodeLabel = node?.label ?? nodeId
  // Signature : reconstruit la scène si l'historique, la sélection ou le
  // registre (sabotage / réparation) change.
  const sig =
    history.map((h) => `${h.versionIndex}:${h.leafHash.slice(0, 12)}`).join('|') +
    `|sel:${selectedVersionIndex ?? '-'}:${selectedLeafId ?? '-'}` +
    `|n:${registry.versions.length}|sab:${registry.sabotage ? 1 : 0}`

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const hist = getNodeHistory(nodeId)
    const n = hist.length
    const node = NODES.find((x) => x.id === nodeId)
    const nodeColor = node ? CATEGORIE_META[node.categorie].couleur : '#ffca34'
    const mod = findModification(nodeId)

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

    /* ── Treillis par couche ── */
    interface Atom {
      x: number
      y: number
      z: number
      scale: number
      color: string
      glow: string | null
      versionIndex: number
      leafId: string
      leafLabel: string
      leafHash: string
    }
    interface LayerInfo {
      entry: (typeof hist)[number]
      y: number
      byId: Map<string, { x: number; z: number; leafHash: string; label: string }>
      gridW: number
      atoms: Atom[]
    }
    const yOf = (i: number) => i * SPACING_Y + (i === n - 1 && n > 1 ? LIFT_LAST : 0)

    // Feuilles triées par id (treillis stable d'une couche à l'autre).
    const perLayerLeaves = hist.map((entry) => {
      const v = registry.versions.find((x) => x.index === entry.versionIndex) ?? null
      return v ? [...v.leaves].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) : []
    })
    const layers: LayerInfo[] = hist.map((entry, i) => {
      const leaves = perLayerLeaves[i]
      const prevMap = new Map((i > 0 ? perLayerLeaves[i - 1] : []).map((l) => [l.id, l.leafHash]))
      const cols = Math.max(1, Math.ceil(Math.sqrt(leaves.length)))
      const rows = Math.max(1, Math.ceil(leaves.length / cols))
      const gridW = (cols - 1) * GRID
      const gridD = (rows - 1) * GRID
      const y = yOf(i)
      const byId = new Map<string, { x: number; z: number; leafHash: string; label: string }>()
      const atoms: Atom[] = []
      leaves.forEach((leaf, idx) => {
        const x = (idx % cols) * GRID - gridW / 2
        const z = Math.floor(idx / cols) * GRID - gridD / 2
        byId.set(leaf.id, { x, z, leafHash: leaf.leafHash, label: leaf.label })
        const isSelf = leaf.id === nodeId
        const prevHash = i > 0 ? prevMap.get(leaf.id) : undefined
        let color: string
        let scale = 1
        let dy = 0
        let glow: string | null = null
        if (isSelf) {
          color = nodeColor
          scale = 1.8
          dy = 0.1
          glow = nodeColor
        } else if (i === 0) {
          color = dim('#8ab4ff', 0.5) // couche d'ancre : tout est « base »
        } else if (prevHash === undefined) {
          color = '#ffca34' // nouvelle feuille
          scale = 1.25
          dy = FLOAT_DY
          glow = '#ffca34'
        } else if (prevHash !== leaf.leafHash) {
          color = '#ff5872' // modifiée
          scale = 1.25
          dy = FLOAT_DY
          glow = '#ff5872'
        } else {
          color = dim('#8ab4ff', 0.5) // inchangée
        }
        atoms.push({
          x,
          y: y + dy,
          z,
          scale,
          color,
          glow,
          versionIndex: entry.versionIndex,
          leafId: leaf.id,
          leafLabel: leaf.label,
          leafHash: leaf.leafHash,
        })
      })
      return { entry, y, byId, gridW, atoms }
    })

    const maxGrid = Math.max(GRID * 3, ...layers.map((L) => L.gridW))
    const midY = yOf(n - 1) / 2
    const dist = Math.max(7.5, 5 + n * 0.9, maxGrid * 2.1)

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      300,
    )
    camera.position.set(dist * 0.62, midY + dist * 0.55, dist * 0.78)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, midY, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 2
    controls.maxDistance = 60

    /* ── Profondeur : fog noir léger ── */
    scene.fog = new THREE.Fog(0x000000, dist * 0.85, dist * 2.6)

    /* ── Lumières (sphères Lambert = volume 3D) ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
    dirLight.position.set(5, 10, 6)
    scene.add(dirLight)

    /* ── Atomes : UN InstancedMesh global ── */
    const allAtoms = layers.flatMap((L) => L.atoms)
    let atomsMesh: THREE.InstancedMesh | null = null
    if (allAtoms.length > 0) {
      const sphereGeo = new THREE.SphereGeometry(ATOM_R, 14, 10)
      disposables.push(sphereGeo)
      const atomMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
      disposables.push(atomMat)
      atomsMesh = new THREE.InstancedMesh(sphereGeo, atomMat, allAtoms.length)
      const m4 = new THREE.Matrix4()
      const col = new THREE.Color()
      allAtoms.forEach((a, i) => {
        m4.makeScale(a.scale, a.scale, a.scale)
        m4.setPosition(a.x, a.y, a.z)
        atomsMesh!.setMatrixAt(i, m4)
        atomsMesh!.setColorAt(i, col.set(a.color))
      })
      atomsMesh.instanceMatrix.needsUpdate = true
      if (atomsMesh.instanceColor) atomsMesh.instanceColor.needsUpdate = true
      scene.add(atomsMesh)
    }

    /* ── Halos sprites (modifiés / nouveaux / donnée) ── */
    const glowTex = makeGlowTexture()
    disposables.push(glowTex)
    for (const a of allAtoms) {
      if (!a.glow) continue
      const smat = new THREE.SpriteMaterial({
        map: glowTex,
        color: a.glow,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      disposables.push(smat)
      const sp = new THREE.Sprite(smat)
      sp.position.set(a.x, a.y, a.z)
      sp.scale.setScalar(0.42 * a.scale)
      scene.add(sp)
    }
    // Halo blanc sur l'atome sélectionné.
    if (selectedVersionIndex !== null && selectedLeafId) {
      const sel = allAtoms.find(
        (a) => a.versionIndex === selectedVersionIndex && a.leafId === selectedLeafId,
      )
      if (sel) {
        const smat = new THREE.SpriteMaterial({
          map: glowTex,
          color: '#ffffff',
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        disposables.push(smat)
        const sp = new THREE.Sprite(smat)
        sp.position.set(sel.x, sel.y, sel.z)
        sp.scale.setScalar(0.75)
        scene.add(sp)
      }
    }

    /* ── Liaisons du treillis : LineSegments fusionné (toutes couches) ── */
    {
      const pos: number[] = []
      layers.forEach((L, i) => {
        const leaves = perLayerLeaves[i]
        const cols = Math.max(1, Math.ceil(Math.sqrt(leaves.length)))
        const gridW = (cols - 1) * GRID
        const rows = Math.max(1, Math.ceil(leaves.length / cols))
        const gridD = (rows - 1) * GRID
        const px = (idx: number) => (idx % cols) * GRID - gridW / 2
        const pz = (idx: number) => Math.floor(idx / cols) * GRID - gridD / 2
        leaves.forEach((_, idx) => {
          const col = idx % cols
          if (col < cols - 1 && idx + 1 < leaves.length) {
            pos.push(px(idx), L.y, pz(idx), px(idx + 1), L.y, pz(idx + 1))
          }
          if (idx + cols < leaves.length) {
            pos.push(px(idx), L.y, pz(idx), px(idx + cols), L.y, pz(idx + cols))
          }
        })
      })
      if (pos.length > 0) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        disposables.push(g)
        const m = new THREE.LineBasicMaterial({
          color: '#8ab4ff',
          transparent: true,
          opacity: 0.22,
        })
        disposables.push(m)
        scene.add(new THREE.LineSegments(g, m))
      }
    }

    /* ── Vias : même leafId entre couches consécutives ── */
    const viaMeshes: THREE.Mesh[] = []
    {
      const goldPos: number[] = []
      const up = new THREE.Vector3(0, 1, 0)
      const mkCylinder = (
        a: THREE.Vector3,
        b: THREE.Vector3,
        r: number,
        color: string,
        opacity: number,
        text: string | null,
      ) => {
        const dir = new THREE.Vector3().subVectors(b, a)
        const len = dir.length()
        if (len < 1e-6) return
        const geo = new THREE.CylinderGeometry(r, r, len, 8)
        disposables.push(geo)
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
        disposables.push(mat)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.copy(a).addScaledVector(dir, 0.5)
        mesh.quaternion.setFromUnitVectors(up, dir.normalize())
        if (text) {
          mesh.userData.text = text
          viaMeshes.push(mesh)
        }
        scene.add(mesh)
      }
      for (let i = 0; i < n - 1; i++) {
        const A = layers[i]
        const B = layers[i + 1]
        for (const [leafId, pb] of B.byId) {
          const pa = A.byId.get(leafId)
          if (!pa) continue
          const changed = pa.leafHash !== pb.leafHash
          const a = new THREE.Vector3(pa.x, A.y, pa.z)
          const b = new THREE.Vector3(pb.x, B.y, pb.z)
          if (changed) {
            mkCylinder(
              a,
              b,
              0.045,
              '#ff5872',
              0.95,
              `Modifié — ${shorten(pb.label, 34)} — v${A.entry.versionIndex} → v${B.entry.versionIndex}` +
                (leafId === nodeId && mod
                  ? ` · diff : +${mod.diff.added.length} −${mod.diff.removed.length} ~${mod.diff.changed.length}`
                  : ''),
            )
          } else if (leafId === nodeId) {
            mkCylinder(a, b, 0.026, '#ffca34', 0.75, null)
          } else {
            goldPos.push(a.x, a.y, a.z, b.x, b.y, b.z)
          }
        }
      }
      if (goldPos.length > 0) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(goldPos, 3))
        disposables.push(g)
        const m = new THREE.LineBasicMaterial({
          color: '#ffca34',
          transparent: true,
          opacity: 0.1,
        })
        disposables.push(m)
        scene.add(new THREE.LineSegments(g, m))
      }
    }

    /* ── Contour discret + plan de clic invisible par couche + label ── */
    const clickPlanes: THREE.Mesh[] = []
    layers.forEach((L) => {
      const size = Math.max(L.gridW, GRID * 3) + 0.7
      const isSel = L.entry.versionIndex === selectedVersionIndex
      const color = KIND_COLOR[L.entry.kind]
      // Cadre de contour (repère de couche).
      const half = size / 2
      const pts = [
        new THREE.Vector3(-half, L.y, -half),
        new THREE.Vector3(half, L.y, -half),
        new THREE.Vector3(half, L.y, half),
        new THREE.Vector3(-half, L.y, half),
      ]
      const lg = new THREE.BufferGeometry().setFromPoints(pts)
      disposables.push(lg)
      const lm = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: isSel ? 0.85 : 0.16,
      })
      disposables.push(lm)
      scene.add(new THREE.LineLoop(lg, lm))
      // Plan de clic invisible (raycast uniquement).
      const pg = new THREE.PlaneGeometry(size, size)
      disposables.push(pg)
      const pm = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      disposables.push(pm)
      const plane = new THREE.Mesh(pg, pm)
      plane.rotation.x = -Math.PI / 2
      plane.position.y = L.y
      plane.userData.versionIndex = L.entry.versionIndex
      scene.add(plane)
      clickPlanes.push(plane)
      // Label flottant CSS2D : #v-index + date + action courte.
      const div = document.createElement('div')
      div.className = 'layer-tag'
      div.style.cssText =
        'pointer-events:none;white-space:nowrap;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;' +
        `color:${color};background:rgba(0,0,0,0.72);border:1px solid ${hexA(color, 0.45)};` +
        'border-radius:4px;padding:3px 7px;letter-spacing:0.04em;'
      div.textContent = `#v${L.entry.versionIndex} · ${L.entry.dateSimulee} · ${shorten(L.entry.action, 42)}`
      const obj = new CSS2DObject(div)
      obj.position.set(half + 0.25, L.y, 0)
      scene.add(obj)
    })

    /* ── Interactions : survol (via / atome), clic (atome > couche) ── */
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let downX = 0
    let downY = 0
    const setMouse = (e: MouseEvent | PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
    }
    const onMove = (e: PointerEvent) => {
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      const hitVia = raycaster.intersectObjects(viaMeshes, false)[0]
      if (hitVia) {
        setTooltip({ x: e.clientX, y: e.clientY, text: hitVia.object.userData.text as string })
        renderer.domElement.style.cursor = 'help'
        return
      }
      if (atomsMesh) {
        const hitAtom = raycaster.intersectObject(atomsMesh, false)[0]
        if (hitAtom && hitAtom.instanceId !== undefined) {
          const a = allAtoms[hitAtom.instanceId]
          setTooltip({
            x: e.clientX,
            y: e.clientY,
            text: `${shorten(a.leafLabel, 40)} · ${shortHash(a.leafHash)} · #v${a.versionIndex}`,
          })
          renderer.domElement.style.cursor = 'pointer'
          return
        }
      }
      setTooltip(null)
      const hitPlane = raycaster.intersectObjects(clickPlanes, false)[0]
      renderer.domElement.style.cursor = hitPlane ? 'pointer' : 'grab'
    }
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }
    const onClick = (e: MouseEvent) => {
      // Garde anti-drag : un déplacement > 6 px = orbite, pas un clic.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
      setMouse(e)
      raycaster.setFromCamera(mouse, camera)
      if (atomsMesh) {
        const hitAtom = raycaster.intersectObject(atomsMesh, false)[0]
        if (hitAtom && hitAtom.instanceId !== undefined) {
          const a = allAtoms[hitAtom.instanceId]
          selectRef.current(a.versionIndex, a.leafId)
          return
        }
      }
      const hitPlane = raycaster.intersectObjects(clickPlanes, false)[0]
      if (hitPlane) selectRef.current(hitPlane.object.userData.versionIndex as number, null)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('click', onClick)

    /* ── Boucle de rendu + hook de test ── */
    const w = window as unknown as { __layers?: unknown }
    const size = { w: container.clientWidth, h: container.clientHeight }
    const proj = new THREE.Vector3()
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
      const points = clickPlanes.map((m) => {
        m.getWorldPosition(proj).project(camera)
        return {
          x: (proj.x * 0.5 + 0.5) * size.w,
          y: (-proj.y * 0.5 + 0.5) * size.h,
          versionIndex: m.userData.versionIndex as number,
        }
      })
      w.__layers = {
        count: clickPlanes.length,
        atoms: allAtoms.length,
        points,
        selected: selectedVersionIndex,
      }
    }
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
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
      container.removeChild(labelRenderer.domElement)
      delete w.__layers
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, sig])

  return (
    <div ref={containerRef} className="absolute inset-0 z-[22] bg-black/90">
      {/* En-tête du mode */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center">
        <div className="tnum font-mono text-[10px] uppercase tracking-[0.22em] text-[#ffca34]/80">
          Couches — {history.length} version{history.length > 1 ? 's' : ''}
        </div>
        <div className="mt-0.5 text-[12px] text-white/60">{nodeLabel}</div>
      </div>

      {/* Infobulle (via / atome) */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[300px] rounded-md border border-white/20 bg-black/90 px-2.5 py-1.5 font-mono text-[10px] leading-snug text-white/80"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Sortie */}
      <button
        type="button"
        onClick={onExit}
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-md border border-[#ffca34]/45 bg-black/80 px-4 py-1.5 text-[11px] font-medium text-[#ffca34] backdrop-blur-md transition-colors hover:bg-[#ffca34]/25"
        title="Touche Échap"
      >
        ← Retour au graphe
      </button>
    </div>
  )
}
