import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LINKS,
  MILESTONES,
  NODES,
  RANGE_END,
  RANGE_START,
  type NodeCategorie,
} from './data/aiActData'
import { BASCULE_EVENTS } from './data/laBasculeData'
import { MS_PER_MONTH, formatDateShort, tsOf } from './lib/time'
import {
  buildNodeArtifactLeaves,
  buildStateLeaves,
  commitVersion,
  initGenesis,
  repair,
  runVerification,
  sabotage,
} from './lib/versionStore'
import type { Version } from './lib/merkle'
import type { GraphNode, IsolationSpec } from './components/Graph3D'
import Timeline from './components/Timeline'
import LegendPanel from './components/LegendPanel'
import MilestonePanel from './components/MilestonePanel'
import NodeDetailPanel from './components/NodeDetailPanel'
import TopOverlay from './components/TopOverlay'
import RegistryPanel from './components/RegistryPanel'
import SearchPanel from './components/SearchPanel'
import BasculePanel from './components/BasculePanel'
import NeuronPanel from './components/NeuronPanel'
import HudOverlay, { type ExplorationMode } from './components/HudOverlay'
import HistoryCard from './components/HistoryCard'
import ViewSwitcher, { type ViewId } from './components/ViewSwitcher'
import Breadcrumbs from './components/Breadcrumbs'
import TutorialOverlay from './components/TutorialOverlay'
import { TUTO_STEPS, type TutoApi } from './lib/tutorial'

const Graph3D = lazy(() => import('./components/Graph3D'))
const Graph2D = lazy(() => import('./components/Graph2D'))
const ListView = lazy(() => import('./components/ListView'))
const SpiralView = lazy(() => import('./components/SpiralView'))
const LayersView = lazy(() => import('./components/LayersView'))

const START_TS = tsOf(RANGE_START)
const END_TS = tsOf(RANGE_END)

const ALL_FAMILLES = new Set<NodeCategorie>(NODES.map((n) => n.categorie))

const POINT_DE_BASCULE_TS = tsOf('2025-07-15')

/** Index 0-based de l'événement « point de bascule » (seq 6, 15/07/2025). */
const BASCULE_POINT_INDEX = Math.max(
  0,
  BASCULE_EVENTS.findIndex((e) => e.date === '2025-07-15'),
)

type RightPanel = 'legend' | 'registry' | 'bascule'

/** Date simulée au format ISO (yyyy-mm-dd, heure locale). */
function isoOfTs(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Nœuds visibles à une date T donnée (même règle que le graphe). */
function visibleIdsAt(ts: number, familles: Set<NodeCategorie>): Set<string> {
  const ids = new Set<string>()
  for (const n of NODES) {
    const actif = n.actifDepuis === null || tsOf(n.actifDepuis) <= ts
    if (actif && familles.has(n.categorie)) ids.add(n.id)
  }
  return ids
}

export default function App() {
  const [currentTs, setCurrentTs] = useState(START_TS)
  const [playing, setPlaying] = useState(false)
  const [vitesse, setVitesse] = useState<1 | 4>(1)
  const [famillesVisibles, setFamillesVisibles] = useState<Set<NodeCategorie>>(ALL_FAMILLES)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [nodeVersion, setNodeVersion] = useState<Version | null>(null)
  const [registryHighlight, setRegistryHighlight] = useState<number | null>(null)
  const [resetSignal, setResetSignal] = useState(0)

  /* ── Panneaux ── */
  const [rightPanel, setRightPanel] = useState<RightPanel>('legend')
  const [searchOpen, setSearchOpen] = useState(false)

  /* ── Modes d'exploration 3D ── */
  const [diveNodeId, setDiveNodeId] = useState<string | null>(null)
  const [isolation, setIsolation] = useState<IsolationSpec | null>(null)
  const [ramified, setRamified] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  /* ── Vue de base (switcher unifié LISTE · 2D · 3D · NEURONE · COUCHES) ── */
  const [baseView, setBaseView] = useState<'liste' | '2d' | '3d'>('3d')
  /** Mini-feedback de garde (breadcrumbs / raccourcis). */
  const [navHint, setNavHint] = useState<string | null>(null)
  const navHintTimerRef = useRef<number | null>(null)
  const flashHint = useCallback((msg: string) => {
    setNavHint(msg)
    if (navHintTimerRef.current !== null) window.clearTimeout(navHintTimerRef.current)
    navHintTimerRef.current = window.setTimeout(() => setNavHint(null), 2200)
  }, [])

  /* Invariants §5 : baseViewRef = lecture hors render ; previousViewRef =
     vue mémorisée à l'entrée de NEURONE/COUCHES/SPIRALE (retour exact). */
  const baseViewRef = useRef(baseView)
  useEffect(() => {
    baseViewRef.current = baseView
  }, [baseView])
  const previousViewRef = useRef<'liste' | '2d' | '3d' | 'spirale'>('3d')

  /* ── Mode « SPIRALE » (niveau 3 : hélice temporelle, sans sélection) ── */
  const [spiralActive, setSpiralActive] = useState(false)
  const spiralActiveRef = useRef(false)
  useEffect(() => {
    spiralActiveRef.current = spiralActive
  }, [spiralActive])

  /* ── Mode « COUCHES » (vue 3D éclatée des versions d'une donnée) ── */
  const [layersNodeId, setLayersNodeId] = useState<string | null>(null)
  const [layersSelectedVersion, setLayersSelectedVersion] = useState<number | null>(null)
  const [layersSelectedLeaf, setLayersSelectedLeaf] = useState<string | null>(null)

  /* ── Tuto démo guidé ── */
  const [tutoStep, setTutoStep] = useState<number | null>(null)
  const [historyVerifySignal, setHistoryVerifySignal] = useState(0)

  /* ── Mode « La Bascule » ── */
  const [basculeActive, setBasculeActive] = useState(false)
  const [basculeEventIndex, setBasculeEventIndex] = useState(0)
  const [basculePlaying, setBasculePlaying] = useState(false)

  /* Plongée, isolation et couches sont mutuellement exclusifs (cohérence
     UX) ; la ramification est un layout cumulable. */
  const enterDive = useCallback((nodeId: string | null) => {
    if (nodeId) {
      setIsolation(null)
      setLayersNodeId(null)
      previousViewRef.current = spiralActiveRef.current ? 'spirale' : baseViewRef.current
      setSpiralActive(false)
    }
    setDiveNodeId(nodeId)
  }, [])

  const toggleIsolation = useCallback((spec: IsolationSpec | null) => {
    if (spec) {
      setDiveNodeId(null)
      setLayersNodeId(null)
      setSpiralActive(false)
      setBaseView('3d') // l'isolation est un mode de la vue 3D
    }
    setIsolation(spec)
  }, [])

  const enterLayers = useCallback((nodeId: string) => {
    setDiveNodeId(null)
    setIsolation(null)
    setLayersSelectedVersion(null)
    setLayersSelectedLeaf(null)
    previousViewRef.current = spiralActiveRef.current ? 'spirale' : baseViewRef.current
    setSpiralActive(false)
    setLayersNodeId(nodeId)
  }, [])

  const exitLayers = useCallback(() => {
    setLayersNodeId(null)
    setLayersSelectedVersion(null)
    setLayersSelectedLeaf(null)
  }, [])

  /* ── Entrée/sortie SPIRALE (exclusivité avec plongée/couches/isolation) ── */
  const enterSpiral = useCallback(() => {
    setDiveNodeId(null)
    setIsolation(null)
    exitLayers()
    previousViewRef.current = baseViewRef.current // retour exact (§5.3)
    setSpiralActive(true)
  }, [exitLayers])

  const exitSpiral = useCallback(() => setSpiralActive(false), [])

  /* Restaure la vue mémorisée à la sortie de NEURONE/COUCHES (y compris
     la spirale si on y était). */
  const restorePreviousView = useCallback(() => {
    const prev = previousViewRef.current
    if (prev === 'spirale') setSpiralActive(true)
    else setBaseView(prev)
  }, [])

  /* Vue courante dérivée : NEURONE/COUCHES/SPIRALE sont des modes
     au-dessus de la vue de base ; quitter l'un d'eux restaure la vue de
     base (sélection et contexte conservés). */
  const currentView: ViewId = layersNodeId
    ? 'couches'
    : diveNodeId
      ? 'neurone'
      : spiralActive
        ? 'spirale'
        : baseView

  /* ── Boutons globaux : historique + point de bascule, de partout ── */
  const handleGlobalHistory = useCallback(() => {
    if (selectedNode) enterLayers(selectedNode.id)
    else setRightPanel('registry')
  }, [selectedNode, enterLayers])

  const handlePointDeBascule = useCallback(() => {
    if (basculeActive) {
      setBasculePlaying(false)
      setBasculeActive(false)
      setRightPanel('legend')
      return
    }
    setRightPanel('bascule')
    setBasculeEventIndex(BASCULE_POINT_INDEX)
    setBasculePlaying(false)
    setBasculeActive(true)
  }, [basculeActive])

  /* ── Circuit électrique (toggle « Courant ») ── */
  const [currentOn, setCurrentOn] = useState(true)

  /* Refs pour les commits (lecture hors render). */
  const currentTsRef = useRef(currentTs)
  const famillesRef = useRef(famillesVisibles)
  useEffect(() => {
    currentTsRef.current = currentTs
  }, [currentTs])
  useEffect(() => {
    famillesRef.current = famillesVisibles
  }, [famillesVisibles])

  /* ── Genèse du registre de versions au chargement. ── */
  useEffect(() => {
    initGenesis(
      buildStateLeaves(visibleIdsAt(START_TS, ALL_FAMILLES), ALL_FAMILLES),
      isoOfTs(START_TS),
    )
  }, [])

  /* ── Commit « saut de timeline » débouncé (scrub continu). ── */
  const seekTimerRef = useRef<number | null>(null)
  const commitTimeJump = useCallback(() => {
    if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
    seekTimerRef.current = window.setTimeout(() => {
      seekTimerRef.current = null
      const ts = currentTsRef.current
      commitVersion(
        'timeJump',
        `Saut de la timeline au ${isoOfTs(ts)}`,
        buildStateLeaves(visibleIdsAt(ts, famillesRef.current), famillesRef.current),
        isoOfTs(ts),
      )
    }, 700)
  }, [])

  /* ── Lecture : ~1 mois / seconde (×1) ou ~4 mois / seconde (×4). */
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      setCurrentTs((ts) => {
        const next = ts + dt * vitesse * MS_PER_MONTH
        if (next >= END_TS) {
          setPlaying(false)
          return END_TS
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, vitesse])

  const handleSeek = useCallback(
    (ts: number) => {
      setPlaying(false)
      setCurrentTs(Math.min(Math.max(ts, START_TS), END_TS))
      commitTimeJump()
    },
    [commitTimeJump],
  )

  const handleToggleFamille = useCallback((c: NodeCategorie) => {
    setFamillesVisibles((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      const ts = currentTsRef.current
      commitVersion(
        'familleToggle',
        `Famille « ${c} » ${next.has(c) ? 'affichée' : 'masquée'}`,
        buildStateLeaves(visibleIdsAt(ts, next), next),
        isoOfTs(ts),
      )
      return next
    })
  }, [])

  const handleResetCamera = useCallback(() => setResetSignal((s) => s + 1), [])

  /* ── Clic nœud : sélection + « version dupliquée » (artefact hashé). ── */
  const handleSelectNode = useCallback((node: GraphNode | null) => {
    setSelectedNode(node)
    if (node) {
      const v = commitVersion(
        'nodeClick',
        `Duplication de l'artefact « ${node.label} » (nœud + liens + voisinage)`,
        buildNodeArtifactLeaves(node.id),
        isoOfTs(currentTsRef.current),
      )
      setNodeVersion(v)
    } else {
      setNodeVersion(null)
    }
  }, [])

  const handleSelectMilestone = useCallback((titre: string) => {
    setSelectedNode(null)
    setNodeVersion(null)
    const ts = currentTsRef.current
    commitVersion(
      'milestoneClick',
      `Clic sur le jalon « ${titre} »`,
      buildStateLeaves(visibleIdsAt(ts, famillesRef.current), famillesRef.current),
      isoOfTs(ts),
    )
  }, [])

  /* ── Tuto démo : API centralisée pilotant l'app ── */
  const selectedNodeRef = useRef<GraphNode | null>(null)
  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])
  const tutoTimerRef = useRef<number | null>(null)

  const tutoApi = useMemo<TutoApi>(() => {
    const ensureSelection = (): string => {
      if (selectedNodeRef.current) return selectedNodeRef.current.id
      const n = NODES.find((x) => x.id === 'art-5')
      if (n) handleSelectNode(n as GraphNode)
      return 'art-5'
    }
    return {
      seekTo: (iso) => handleSeek(tsOf(iso)),
      playDemo: () => {
        setPlaying(true)
        if (tutoTimerRef.current !== null) window.clearTimeout(tutoTimerRef.current)
        tutoTimerRef.current = window.setTimeout(() => {
          tutoTimerRef.current = null
          handleSeek(tsOf('2025-08-02'))
        }, 3000)
      },
      selectNodeById: (id) => {
        const n = NODES.find((x) => x.id === id)
        if (n) handleSelectNode(n as GraphNode)
      },
      setBaseView: (v) => {
        setDiveNodeId(null)
        exitLayers()
        setBaseView(v)
      },
      enterDive: () => enterDive(ensureSelection()),
      enterLayers: () => enterLayers(ensureSelection()),
      openRegistry: () => setRightPanel('registry'),
      sabotageDemo: () => {
        sabotage()
        runVerification()
      },
      repairDemo: () => repair(),
      verifyHistory: () => setHistoryVerifySignal((s) => s + 1),
      startBascule: (index) => {
        setRightPanel('bascule')
        setBasculeEventIndex(index)
        setBasculePlaying(false)
        setBasculeActive(true)
      },
      resetAll: () => {
        if (tutoTimerRef.current !== null) {
          window.clearTimeout(tutoTimerRef.current)
          tutoTimerRef.current = null
        }
        setPlaying(false)
        setBasculePlaying(false)
        setBasculeActive(false)
        setRightPanel('legend')
        setDiveNodeId(null)
        exitLayers()
        exitSpiral()
        setIsolation(null)
        setBaseView('3d')
        repair()
      },
    }
  }, [handleSeek, handleSelectNode, enterDive, enterLayers, exitLayers, exitSpiral])

  /* Navigation du tuto : onLeave de l'étape courante, puis action de la
     nouvelle étape (déclenchée par l'effet ci-dessous). */
  const tutoGo = useCallback(
    (next: number | null) => {
      if (tutoStep !== null) TUTO_STEPS[tutoStep].onLeave?.(tutoApi)
      if (next === null || next >= TUTO_STEPS.length) {
        setTutoStep(null)
        tutoApi.resetAll()
        return
      }
      setTutoStep(next)
    },
    [tutoStep, tutoApi],
  )

  /* Exécute l'action réelle de l'étape à son entrée (petit délai pour
     laisser l'UI se stabiliser entre deux vues). */
  useEffect(() => {
    if (tutoStep === null) return
    const step = TUTO_STEPS[tutoStep]
    const t = window.setTimeout(() => step.action?.(tutoApi), 350)
    return () => window.clearTimeout(t)
  }, [tutoStep, tutoApi])

  /* ── Échelle de vues (§1/§5) : spirale au niveau 3 ── */
  const navigateToView = useCallback(
    (v: ViewId) => {
      if (v === 'spirale') {
        enterSpiral() // pas de garde : la spirale n'exige pas de sélection
        return
      }
      if (v === 'neurone' || v === 'couches') {
        const sel = selectedNodeRef.current
        if (!sel) {
          flashHint("sélectionne d'abord une donnée")
          return
        }
        if (v === 'neurone') enterDive(sel.id)
        else enterLayers(sel.id)
        return
      }
      setDiveNodeId(null)
      exitLayers()
      setSpiralActive(false)
      setBaseView(v)
    },
    [enterDive, enterLayers, exitLayers, enterSpiral, flashHint],
  )

  const goLevel = useCallback(
    (dir: 1 | -1) => {
      const LADDER: ViewId[] = ['liste', '2d', '3d', 'spirale', 'neurone', 'couches']
      const idx = LADDER.indexOf(currentView)
      const next = LADDER[idx + dir]
      if (next) navigateToView(next)
    },
    [currentView, navigateToView],
  )

  const handleSwitchView = navigateToView

  /* « Ouvrir dans… » (SearchPanel / LISTE) : sélectionne puis bascule. */
  const handleOpenIn = useCallback(
    (view: '2d' | '3d' | 'couches', nodeId: string) => {
      if (selectedNodeRef.current?.id !== nodeId) {
        const n = NODES.find((x) => x.id === nodeId)
        if (n) handleSelectNode(n as GraphNode)
      }
      setSearchOpen(false)
      if (view === 'couches') enterLayers(nodeId)
      else {
        setDiveNodeId(null)
        exitLayers()
        setBaseView(view)
      }
    },
    [handleSelectNode, enterLayers, exitLayers],
  )

  /* ── Raccourcis clavier d'exploration + échelle de vues. ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      // Le tuto capture tout : Échap quitte, les autres touches sont inertes.
      if (tutoStep !== null) {
        if (e.key === 'Escape') tutoGo(null)
        return
      }
      if (e.key === 'Escape') {
        // Descend d'un niveau : couches→base, neurone→base, spirale→base,
        // isolation→off, liste→désélection (retour exact via previousViewRef).
        if (helpOpen) setHelpOpen(false)
        else if (layersNodeId) {
          restorePreviousView()
          exitLayers()
        } else if (diveNodeId) {
          restorePreviousView()
          setDiveNodeId(null)
        } else if (spiralActive) exitSpiral()
        else if (isolation) setIsolation(null)
        else if (baseView === 'liste' && selectedNode) {
          setSelectedNode(null)
          setNodeVersion(null)
        }
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'h' || e.key === '?') setHelpOpen((o) => !o)
      else if (e.key === 'ArrowUp') {
        e.preventDefault()
        goLevel(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        goLevel(-1)
      } else if (k === 'r') {
        if (baseView !== '3d') setBaseView('3d') // la ramification est un layout 3D
        setRamified((r) => !r)
      } else if (k === 's') {
        navigateToView('spirale')
      } else if (k === 'l') navigateToView('liste')
      else if (k === 'c') navigateToView('couches')
      else if (k === 'p') {
        if (selectedNode) enterDive(selectedNode.id)
      } else if (isolation === null && (k === '0' || k === '4' || k === '5')) {
        // Chiffres-vues uniquement hors isolation (sinon 1/2/3 = profondeur).
        if (k === '0') navigateToView('liste')
        else if (k === '4') navigateToView('neurone')
        else navigateToView('couches')
      } else if (k === 'i') {
        if (isolation) setIsolation(null)
        else if (selectedNode) {
          setDiveNodeId(null)
          toggleIsolation({ nodeId: selectedNode.id, depth: 1 })
        }
      } else if ((e.key === '1' || e.key === '2' || e.key === '3') && isolation) {
        setIsolation({ ...isolation, depth: Number(e.key) as 1 | 2 | 3 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    helpOpen,
    diveNodeId,
    isolation,
    selectedNode,
    enterDive,
    layersNodeId,
    exitLayers,
    baseView,
    tutoStep,
    tutoGo,
    toggleIsolation,
    navigateToView,
    goLevel,
    flashHint,
    spiralActive,
    exitSpiral,
    restorePreviousView,
  ])

  /* ── Mode « La Bascule » : l'index pilote tout (date + commit). ── */
  const basculeCommittedRef = useRef({ active: false, index: -1 })
  useEffect(() => {
    const committed = basculeCommittedRef.current
    if (!basculeActive) {
      committed.active = false
      return
    }
    if (committed.active && committed.index === basculeEventIndex) return
    committed.active = true
    committed.index = basculeEventIndex
    const ev = BASCULE_EVENTS[basculeEventIndex]
    setPlaying(false)
    const ts = tsOf(ev.date)
    setCurrentTs(ts)
    commitVersion(
      'basculeEvent',
      `La Bascule — Événement ${ev.seq} : ${ev.titre}`,
      buildStateLeaves(visibleIdsAt(ts, famillesRef.current), famillesRef.current),
      ev.date,
    )
  }, [basculeActive, basculeEventIndex])

  /* Lecture scénarisée : un événement toutes les ~4,5 s. */
  useEffect(() => {
    if (!basculePlaying) return
    const id = window.setInterval(() => {
      setBasculeEventIndex((i) => {
        if (i >= BASCULE_EVENTS.length - 1) {
          setBasculePlaying(false)
          return i
        }
        return i + 1
      })
    }, 4500)
    return () => window.clearInterval(id)
  }, [basculePlaying])

  const toggleBascule = useCallback(() => {
    setBasculeActive((active) => {
      if (active) {
        setBasculePlaying(false)
        setRightPanel('legend')
        return false
      }
      setBasculeEventIndex(0)
      setRightPanel('bascule')
      return true
    })
  }, [])

  /* ── Nœuds / liens visibles à la date T (même règle que le graphe). */
  const visibleNodeIds = useMemo(
    () => visibleIdsAt(currentTs, famillesVisibles),
    [currentTs, famillesVisibles],
  )

  const nbLiensVisibles = useMemo(
    () => LINKS.filter((l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)).length,
    [visibleNodeIds],
  )

  /* Feuilles de l'état courant (pour la recherche moléculaire). */
  const currentLeaves = useMemo(
    () => buildStateLeaves(visibleNodeIds, famillesVisibles),
    [visibleNodeIds, famillesVisibles],
  )

  /* ── Jalon courant : le dernier franchi à la date T. */
  const milestoneIndex = useMemo(() => {
    let idx = -1
    for (let i = 0; i < MILESTONES.length; i++) {
      if (tsOf(MILESTONES[i].date) <= currentTs) idx = i
    }
    return idx
  }, [currentTs])

  /* ── Mode courant (HUD) + exposition de diagnostic pour les tests. ── */
  const mode: ExplorationMode = layersNodeId
    ? 'COUCHES'
    : diveNodeId
      ? 'PLONGÉE'
      : spiralActive
        ? 'SPIRALE'
        : isolation
          ? 'ISOLATION'
          : ramified
            ? 'RAMIFICATION'
            : baseView === 'liste'
              ? 'LISTE'
              : baseView === '2d'
                ? '2D'
                : '3D'

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__mode = {
      mode,
      baseView,
      view: currentView,
      selectedNodeId: selectedNode?.id ?? null,
      playing,
      ts: currentTs,
      rightPanel,
      basculeActive,
      basculeEventIndex,
      ramified,
      diveNodeId,
      layersNodeId,
      spiral: spiralActive,
      isolation: isolation?.nodeId ?? null,
      tutoStep,
    }
  }, [
    mode,
    baseView,
    currentView,
    selectedNode,
    playing,
    currentTs,
    rightPanel,
    basculeActive,
    basculeEventIndex,
    ramified,
    diveNodeId,
    layersNodeId,
    spiralActive,
    isolation,
    tutoStep,
  ])

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans text-[#f5f5f5]">
      {/* Graphe plein écran : 3D (requis aussi pour la plongée) ou 2D */}
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#ffca34]" />
                <p className="mt-3 text-[12px] text-white/50">Chargement du graphe…</p>
              </div>
            </div>
          }
        >
          {spiralActive ? (
            <SpiralView
              currentTs={currentTs}
              famillesVisibles={famillesVisibles}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectNode}
              onSelectMilestone={handleSelectMilestone}
              onSeek={handleSeek}
              onExit={exitSpiral}
            />
          ) : baseView === 'liste' && !diveNodeId ? (
            <ListView
              currentTs={currentTs}
              famillesVisibles={famillesVisibles}
              selectedNodeId={selectedNode?.id ?? null}
              rightReserved={rightPanel === 'legend' ? 280 : 460}
              onSelectNode={handleSelectNode}
              onOpenIn={handleOpenIn}
              onOpenSearch={() => setSearchOpen(true)}
            />
          ) : baseView === '3d' || diveNodeId ? (
            <Graph3D
              currentTs={currentTs}
              famillesVisibles={famillesVisibles}
              resetSignal={resetSignal}
              ramified={ramified}
              ramifyRootId={selectedNode?.id ?? null}
              isolation={isolation}
              diveNodeId={diveNodeId}
              selectedNodeId={selectedNode?.id ?? null}
              basculeIndex={basculeActive ? basculeEventIndex : null}
              currentOn={currentOn}
              onSelectNode={handleSelectNode}
              onDiveChange={enterDive}
              onSeekVersion={(iso) => handleSeek(tsOf(iso))}
            />
          ) : (
            <Graph2D
              currentTs={currentTs}
              famillesVisibles={famillesVisibles}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectNode}
            />
          )}
        </Suspense>
      </div>

      {/* Switcher de points de vue unifié */}
      <ViewSwitcher
        view={currentView}
        hasSelection={selectedNode !== null}
        onSwitch={handleSwitchView}
      />

      {/* Breadcrumbs — échelle de navigation + contexte */}
      <Breadcrumbs
        view={currentView}
        context={`${selectedNode ? selectedNode.label : 'aucune donnée'} · ${formatDateShort(currentTs)}`}
        hint={navHint}
        onNavigate={navigateToView}
      />

      {/* Barre d'outils haut-gauche */}
      <div className="pointer-events-auto absolute left-4 top-4 z-30 flex max-w-[62vw] flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRightPanel((p) => (p === 'registry' ? 'legend' : 'registry'))}
          aria-pressed={rightPanel === 'registry'}
          className={`rounded-md border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
            rightPanel === 'registry'
              ? 'border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34]'
              : 'border-white/15 bg-black/70 text-white/70 hover:bg-white/15'
          }`}
        >
          Registre
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen((o) => !o)}
          aria-pressed={searchOpen}
          className={`rounded-md border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
            searchOpen
              ? 'border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34]'
              : 'border-white/15 bg-black/70 text-white/70 hover:bg-white/15'
          }`}
        >
          Recherche
        </button>
        <button
          type="button"
          onClick={handleGlobalHistory}
          title={
            selectedNode
              ? 'Historique vérifiable du nœud sélectionné (COUCHES + carte)'
              : 'Aucun nœud sélectionné — ouvre le Registre des versions'
          }
          className="rounded-md border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-md transition-colors hover:bg-white/15"
        >
          Historique
        </button>
        <button
          type="button"
          onClick={toggleBascule}
          aria-pressed={basculeActive}
          className={`rounded-md border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
            basculeActive
              ? 'border-[#ffca34]/60 bg-[#ffca34]/20 text-[#ffca34] shadow-[0_0_14px_rgba(255,202,52,0.35)]'
              : 'border-white/15 bg-black/70 text-white/70 hover:bg-white/15'
          }`}
        >
          Scénario : La Bascule
        </button>
        <button
          type="button"
          onClick={handlePointDeBascule}
          title="Saut direct au point de bascule — 15/07/2025 (événement 6)"
          className={`rounded-md border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
            basculeActive && basculeEventIndex === BASCULE_POINT_INDEX
              ? 'border-[#ff5872]/60 bg-[#ff5872]/15 text-[#ff5872]'
              : 'border-[#ff5872]/35 bg-black/70 text-[#ff5872]/80 hover:bg-[#ff5872]/15'
          }`}
        >
          Point de bascule
        </button>
        <button
          type="button"
          onClick={() => setTutoStep(0)}
          aria-pressed={tutoStep !== null}
          className={`rounded-md border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition-colors ${
            tutoStep !== null
              ? 'border-[#ffca34]/50 bg-[#ffca34]/15 text-[#ffca34]'
              : 'border-[#ffca34]/35 bg-[#ffca34]/8 text-[#ffca34]/90 hover:bg-[#ffca34]/20'
          }`}
        >
          Tuto
        </button>
      </div>

      {/* Overlays */}
      <TopOverlay currentTs={currentTs} />

      {rightPanel === 'legend' && (
        <LegendPanel
          famillesVisibles={famillesVisibles}
          onToggleFamille={handleToggleFamille}
          nbNoeuds={visibleNodeIds.size}
          nbLiens={nbLiensVisibles}
          onResetCamera={handleResetCamera}
          ramified={ramified}
          onToggleRamified={() => {
            if (baseView !== '3d') setBaseView('3d') // layout 3D uniquement
            setRamified((r) => !r)
          }}
          currentOn={currentOn}
          onToggleCurrent={() => setCurrentOn((o) => !o)}
        />
      )}
      {rightPanel === 'registry' && (
        <RegistryPanel
          onSelectVersion={(iso) => handleSeek(tsOf(iso))}
          highlightIndex={registryHighlight}
        />
      )}
      {rightPanel === 'bascule' && basculeActive && (
        <BasculePanel
          currentEventIndex={basculeEventIndex}
          playing={basculePlaying}
          onPlayPause={() => setBasculePlaying((p) => !p)}
          onPrev={() => setBasculeEventIndex((i) => Math.max(0, i - 1))}
          onNext={() => setBasculeEventIndex((i) => Math.min(BASCULE_EVENTS.length - 1, i + 1))}
          onSelectEvent={setBasculeEventIndex}
          onClose={toggleBascule}
        />
      )}

      {searchOpen && (
        <SearchPanel
          currentLeaves={currentLeaves}
          onSeekToVersion={(iso) => handleSeek(tsOf(iso))}
          onOpenIn={handleOpenIn}
        />
      )}

      {diveNodeId ? (
        <NeuronPanel
          nodeId={diveNodeId}
          currentTs={currentTs}
          onSurface={() => {
            restorePreviousView()
            setDiveNodeId(null)
          }}
          onSeekVersion={(iso) => handleSeek(tsOf(iso))}
        />
      ) : (
        <MilestonePanel
          milestone={milestoneIndex >= 0 ? MILESTONES[milestoneIndex] : null}
          index={milestoneIndex}
          total={MILESTONES.length}
        />
      )}
      {!diveNodeId && !layersNodeId && (
        <NodeDetailPanel
          node={selectedNode}
          version={nodeVersion}
          currentTs={currentTs}
          onClose={() => {
            setSelectedNode(null)
            setNodeVersion(null)
          }}
          onDive={(n) => enterDive(n.id)}
          isolationDepth={isolation?.depth ?? null}
          onIsolate={(d) => selectedNode && toggleIsolation({ nodeId: selectedNode.id, depth: d })}
          onDesisolate={() => setIsolation(null)}
          onOpenLayers={(n) => enterLayers(n.id)}
          onOpenRegistry={(index) => {
            setRegistryHighlight(index)
            setRightPanel('registry')
          }}
          onSeekDate={(iso) => handleSeek(tsOf(iso))}
        />
      )}

      {/* Mode COUCHES : vue 3D éclatée + carte d'historique vérifiable */}
      {layersNodeId && (
        <>
          <Suspense fallback={null}>
            <LayersView
              nodeId={layersNodeId}
              selectedVersionIndex={layersSelectedVersion}
              selectedLeafId={layersSelectedLeaf}
              onSelectVersion={(v, leaf) => {
                setLayersSelectedVersion(v)
                setLayersSelectedLeaf(leaf)
              }}
              onExit={() => {
                restorePreviousView()
                exitLayers()
              }}
            />
          </Suspense>
          <HistoryCard
            nodeId={layersNodeId}
            currentTs={currentTs}
            selectedVersionIndex={layersSelectedVersion}
            selectedLeafId={layersSelectedLeaf}
            autoVerifySignal={historyVerifySignal}
            onSelectVersion={(v) => {
              setLayersSelectedVersion(v)
              setLayersSelectedLeaf(null) // la preuve retombe sur la donnée elle-même
            }}
            onSeekDate={(iso) => handleSeek(tsOf(iso))}
            onClose={exitLayers}
          />
        </>
      )}

      {/* Tuto démo guidé */}
      {tutoStep !== null && (
        <TutorialOverlay
          step={TUTO_STEPS[tutoStep]}
          index={tutoStep}
          total={TUTO_STEPS.length}
          onNext={() => tutoGo(tutoStep + 1)}
          onPrev={() => tutoGo(Math.max(0, tutoStep - 1))}
          onSkip={() => tutoGo(null)}
        />
      )}

      <HudOverlay mode={mode} helpOpen={helpOpen} onToggleHelp={() => setHelpOpen((o) => !o)} />

      <Timeline
        currentTs={currentTs}
        startTs={START_TS}
        endTs={END_TS}
        milestones={MILESTONES}
        playing={playing}
        vitesse={vitesse}
        onTogglePlay={() => setPlaying((p) => !p)}
        onToggleVitesse={() => setVitesse((v) => (v === 1 ? 4 : 1))}
        onSeek={handleSeek}
        onSelectMilestone={(m) => handleSelectMilestone(m.titre)}
        basculeMarkerTs={basculeActive ? POINT_DE_BASCULE_TS : null}
      />
    </div>
  )
}
