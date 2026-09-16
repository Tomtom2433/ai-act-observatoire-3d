/**
 * Panneau « Registre » — explorateur de blocs des versions chaînées.
 * Liste chronologique inversée : index, heure, action, racine Merkle
 * tronquée, hash tronqué, pastille de statut après vérification.
 * Boutons : Vérifier la chaîne / Saboter (démo) / Réparer.
 */
import { useEffect } from 'react'
import { shortHash } from '../lib/merkle'
import { repair, runVerification, sabotage, useRegistry } from '../lib/versionStore'
import CycleVerifyDiagram from './CycleVerifyDiagram'

const ACTION_LABEL: Record<string, string> = {
  init: 'Genèse',
  timeJump: 'Saut temporel',
  milestoneClick: 'Clic jalon',
  nodeClick: 'Clic nœud',
  familleToggle: 'Toggle famille',
  basculeEvent: 'Événement Bascule',
}

function StatusDot({ status }: { status: boolean | null }) {
  if (status === null) {
    return (
      <span
        className="inline-block h-[8px] w-[8px] rounded-full border border-white/30 bg-white/10"
        title="Non vérifiée"
      />
    )
  }
  return (
    <span
      className={`inline-block h-[8px] w-[8px] rounded-full ${
        status
          ? 'bg-[#00ffa3] shadow-[0_0_8px_rgba(0,255,163,0.7)]'
          : 'bg-[#ff3b30] shadow-[0_0_8px_rgba(255,59,48,0.8)]'
      }`}
      title={status ? 'Version intègre' : 'Chaîne rompue à cette version'}
    />
  )
}

export default function RegistryPanel({
  onSelectVersion,
  highlightIndex = null,
}: {
  onSelectVersion: (dateIso: string) => void
  highlightIndex?: number | null
}) {
  const { versions, sabotage: sabotageInfo, verification } = useRegistry()
  const reversed = [...versions].reverse()

  /* Bloc demandé depuis la fiche détail : scroll + anneau doré. */
  useEffect(() => {
    if (highlightIndex === null) return
    const el = document.querySelector(`[data-registry-v="${highlightIndex}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightIndex])

  return (
    <div className="pointer-events-auto absolute bottom-[150px] right-4 top-4 z-30 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-white/10 bg-black/75 backdrop-blur-md">
      {/* En-tête */}
      <div className="border-b border-white/10 p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            Registre de versions
          </div>
          <span className="tnum text-[11px] text-white/40">{versions.length} versions</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          Registre à preuve cryptographique, non distribué : chaînage par hash + racine de Merkle
          par version (modèle transparency log).
        </p>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => runVerification()}
            className="flex-1 rounded-md border border-[#ffca34]/40 bg-[#ffca34]/10 px-3 py-1.5 text-[11px] font-medium text-[#ffca34] transition-colors hover:bg-[#ffca34]/25"
          >
            Vérifier la chaîne
          </button>
          {sabotageInfo ? (
            <button
              type="button"
              onClick={() => repair()}
              className="flex-1 rounded-md border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1.5 text-[11px] font-medium text-[#00ffa3] transition-colors hover:bg-[#00ffa3]/25"
            >
              Réparer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => sabotage()}
              disabled={versions.length < 4}
              className="flex-1 rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/10 px-3 py-1.5 text-[11px] font-medium text-[#ff6b62] transition-colors hover:bg-[#ff3b30]/25 disabled:cursor-not-allowed disabled:opacity-40"
              title="Altère silencieusement une feuille d'une version passée"
            >
              Saboter (démo)
            </button>
          )}
        </div>

        {/* Bandeau de verdict */}
        {verification && (
          <div
            className={`mt-2 rounded-md border px-3 py-2 text-[11px] font-medium ${
              verification.ok
                ? 'border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]'
                : 'border-[#ff3b30]/40 bg-[#ff3b30]/10 text-[#ff6b62]'
            }`}
          >
            {verification.ok
              ? '✓ Chaîne intègre — toutes les racines et tous les chaînages recalculés concordent.'
              : `✗ Chaîne rompue à partir de la version ${verification.brokenAt} — invalidation en cascade.`}
          </div>
        )}
        {sabotageInfo && !verification && (
          <div className="mt-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/55">
            Une feuille de la version {sabotageInfo.versionIndex} a été silencieusement altérée.
            Relancez la vérification…
          </div>
        )}

        {/* Cycle de vérification (spec §4) — en tête du Registre */}
        <CycleVerifyDiagram />
      </div>

      {/* Liste des versions */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-[2px]">
          {reversed.map((v) => {
            const status = verification ? verification.statuses[v.index] ?? null : null
            const isSabotaged = sabotageInfo?.versionIndex === v.index
            return (
              <li key={v.index} data-registry-v={v.index}>
                <button
                  type="button"
                  onClick={() => onSelectVersion(v.dateSimulee)}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/10 ${
                    status === false ? 'bg-[#ff3b30]/10' : ''
                  } ${highlightIndex === v.index ? 'ring-1 ring-[#ffca34]/70 bg-[#ffca34]/[0.07]' : ''}`}
                  title={`Ramener la timeline au ${v.dateSimulee}`}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={status} />
                    <span className="tnum text-[11px] font-semibold text-[#ffca34]">
                      v{v.index}
                    </span>
                    <span className="tnum text-[10px] text-white/35">
                      {new Date(v.timestamp).toLocaleTimeString('fr-FR')}
                    </span>
                    <span className="rounded-full border border-white/15 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.1em] text-white/45">
                      {ACTION_LABEL[v.actionKind] ?? v.actionKind}
                    </span>
                    {isSabotaged && (
                      <span className="rounded-full border border-[#ff3b30]/50 bg-[#ff3b30]/15 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.1em] text-[#ff6b62]">
                        falsifiée
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate pl-4 text-[11px] text-white/65">{v.action}</div>
                  <div className="tnum mt-1 flex gap-3 pl-4 font-mono text-[10px] text-white/40">
                    <span title={`Racine Merkle : ${v.merkleRoot}`}>racine {shortHash(v.merkleRoot)}</span>
                    <span title={`Hash de version : ${v.hash}`}>hash {shortHash(v.hash)}</span>
                    <span className="text-white/30">{v.leaves.length} feuilles</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
