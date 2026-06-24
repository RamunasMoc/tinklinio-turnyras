'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const DRAW_LBL: Record<string,string> = {
  RANDOM:        'Atsitiktinis',
  SEEDED_RANDOM: 'Sėjamosios pagal reitingą',
  SNAKE:         'Gyvatėlė pagal reitingą',
  MANUAL:        'Rankinis (drag & drop)',
}

export default function GroupsClient({ tournamentId, config, initialGroups, allTeams }:
  { tournamentId:string; config:any; initialGroups:any[]; allTeams:any[] }) {

  const router = useRouter()
  const [groups,   setGroups]   = useState<any[]>(initialGroups)
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')
  const [moveTarget, setMoveTarget] = useState<{ttId:string; fromGroup:number; teamName:string} | null>(null)

  // Drag state
  const dragTeam  = useRef<{ttId:string; fromGroup:number} | null>(null)
  const [dragOver, setDragOver] = useState<number|null>(null)

  const G           = config?.numGroups ?? 4
  const T           = allTeams.length
  const advMode     = config?.advanceMode ?? 'fixed'
  const advPerGroup = config?.advancePerGroup ?? 2
  const advTotal    = config?.advanceTotal ?? 8
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(advMode==='fixed'?advPerGroup*G:advTotal, 2))))
  const isManual    = config?.drawMethod === 'MANUAL'

  function calcAdvanceCounts(): number[] {
    if (advMode === 'fixed') return Array(G).fill(advPerGroup)
    const base = Math.floor(advTotal / G), extra = advTotal % G
    return Array.from({ length: G }, (_, i) => base + (i < extra ? 1 : 0))
  }
  const advCounts    = calcAdvanceCounts()
  const totalAdvance = advCounts.reduce((s, n) => s + n, 0)

  async function generateGroups() {
    if (!config) { setMsg('Pirmiausia nustatykite konfigūraciją'); return }
    if (T === 0)  { setMsg('Pirmiausia registruokite komandas'); return }
    const base = Math.floor(T / G), extra = T % G
    const groupSizes = Array.from({ length: G }, (_, i) => base + (i < extra ? 1 : 0))
    setLoading(true); setMsg('')
    const res  = await fetch(`/api/tournaments/${tournamentId}/groups`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ groupSizes, advanceCounts: advCounts }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      await fetch(`/api/tournaments/${tournamentId}/groups/clear-matches`, { method:'POST' })
      setGroups(data.data)
      setMsg('✓ Grupės sudarytos. Tvarkaraščiai ir rezultatai išvalyti.')
      router.refresh()
    } else setMsg(`Klaida: ${data.error}`)
  }

  async function redraw() {
    setLoading(true); setMsg('')
    const res  = await fetch(`/api/tournaments/${tournamentId}/groups/draw`, { method:'POST' })
    const data = await res.json()
    if (data.ok) {
      await fetch(`/api/tournaments/${tournamentId}/groups/clear-matches`, { method:'POST' })
      setGroups(data.data)
      setMsg('✓ Burtai pakartoti. Tvarkaraščiai ir rezultatai išvalyti.')
      router.refresh()
    } else setMsg(`Klaida: ${data.error}`)
    setLoading(false)
  }

  // ─── Drag & drop ─────────────────────────────────────────────

  function onDragStart(ttId: string, fromGroupIdx: number) {
    dragTeam.current = { ttId, fromGroup: fromGroupIdx }
  }

  function onDragOver(e: React.DragEvent, toGroupIdx: number) {
    e.preventDefault()
    setDragOver(toGroupIdx)
  }

  function onDragLeave() {
    setDragOver(null)
  }

  async function onDrop(e: React.DragEvent, toGroupIdx: number) {
    e.preventDefault()
    setDragOver(null)
    if (!dragTeam.current) return
    const { ttId, fromGroup: fromGroupIdx } = dragTeam.current
    dragTeam.current = null

    await moveTeam(ttId, fromGroupIdx, toGroupIdx)
  }

  async function moveTeam(ttId: string, fromGroupIdx: number, toGroupIdx: number) {
    if (saving || fromGroupIdx === toGroupIdx) return

    const previousGroups = groups

    // Atnaujinti lokalų state
    const newGroups = groups.map((g, gi) => {
      if (gi === fromGroupIdx) {
        return { ...g, teams: g.teams.filter((tt: any) => tt.id !== ttId) }
      }
      if (gi === toGroupIdx) {
        const tt = groups[fromGroupIdx].teams.find((t: any) => t.id === ttId)
        return tt ? { ...g, teams: [...g.teams, tt] } : g
      }
      return g
    })
    setGroups(newGroups)
    setMoveTarget(null)

    // Išsaugoti į DB + išvalyti tvarkaraščius ir rezultatus
    setSaving(true)
    const toGroup = groups[toGroupIdx]

    // 1. Perkelti komandą
    const res = await fetch(`/api/tournaments/${tournamentId}/teams/${ttId}`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ groupId: toGroup.id }),
    })

    if (!res.ok) {
      setSaving(false)
      setMsg('Klaida perkeliant komandą')
      setGroups(previousGroups) // atstatyti
      return
    }

    // 2. Išvalyti grupių tvarkaraščius ir rezultatus (mačai, setai, statistika)
    await fetch(`/api/tournaments/${tournamentId}/groups/clear-matches`, {
      method: 'POST',
    })

    setSaving(false)
    setMsg('✓ Komanda perkelta. Tvarkaraščiai ir rezultatai išvalyti.')
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Grupės</h1>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <form
              method="post"
              action={`/api/tournaments/${tournamentId}/groups/actions`}
              onSubmit={e => {
                if (typeof window !== 'undefined') {
                  e.preventDefault()
                  redraw()
                }
              }}>
              <input type="hidden" name="action" value="redraw" />
              <button type="submit" disabled={loading}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                ↺ Burtai iš naujo
              </button>
            </form>
          )}
          <form
            method="post"
            action={`/api/tournaments/${tournamentId}/groups/actions`}
            onSubmit={e => {
              if (typeof window !== 'undefined') {
                e.preventDefault()
                generateGroups()
              }
            }}>
            <input type="hidden" name="action" value="generate" />
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Sudaroma...' : groups.length > 0 ? 'Pertvarkyti grupes' : 'Sudaryti grupes'}
            </button>
          </form>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.startsWith('✓')
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg}
        </div>
      )}

      {/* Konfigūracijos suvestinė */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grupių nustatymai</p>
          <a href={`/tournament/${tournamentId}/config`}
            className="text-xs text-gray-400 hover:text-gray-600 underline">
            Keisti nustatymus →
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Grupių skaičius</p>
            <p className="text-sm font-semibold text-gray-800">{G}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Burtų metodas</p>
            <p className="text-sm font-semibold text-gray-800">
              {DRAW_LBL[config?.drawMethod ?? 'RANDOM'] ?? config?.drawMethod}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Klubo apribojimas</p>
            <p className="text-sm font-semibold text-gray-800">{config?.clubRule ? '✓ Įjungtas' : '✗ Išjungtas'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Rungtynių trukmė</p>
            <p className="text-sm font-semibold text-gray-800">{config?.groupTimeMinutes ?? '—'} min.</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Aikštelių skaičius</p>
            <p className="text-sm font-semibold text-gray-800">{config?.groupCourts ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Setų formatas</p>
            <p className="text-sm font-semibold text-gray-800">{config?.groupSetFormat ?? '—'}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Patekimas į atkrintamąsias</p>
          <div className="flex gap-2 flex-wrap">
            {advCounts.map((n, i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 font-medium">
                Gr. {String.fromCharCode(65+i)}: {n}
              </span>
            ))}
            <span className="text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 font-medium">
              Braket: {bracketSize} vietų{bracketSize !== totalAdvance ? ` (${bracketSize-totalAdvance} bye)` : ''}
            </span>
          </div>
          {advMode === 'total' && advTotal > advPerGroup * G && (
            <p className="text-xs text-gray-400 mt-1">
              {advPerGroup * G} tiesioginių + {advTotal - advPerGroup * G} geriausių likusių
            </p>
          )}
        </div>
      </div>

      {/* Rankinio metodo paaiškinimas */}
      {isManual && groups.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
          <span>↕️</span>
          <span>Rankinis režimas — kompiuteryje vilkite komandą, telefone palieskite ją ir pasirinkite kitą grupę. Pakeitimai išsaugomi automatiškai.</span>
          {saving && <span className="ml-auto text-xs text-blue-500">Saugoma...</span>}
        </div>
      )}

      {/* Grupių vaizdas */}
      {groups.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400">
          <p className="text-lg mb-2">🎯</p>
          <p>Grupės dar nesudaryta. Spausk „Sudaryti grupes".</p>
          {T === 0 && <p className="text-sm mt-2 text-red-400">⚠️ Pirmiausia registruokite komandas</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g: any, gi: number) => (
            <div
              key={g.id}
              className={`bg-white border rounded-xl p-4 transition-colors ${
                isManual && dragOver === gi
                  ? 'border-blue-400 bg-blue-50/30'
                  : 'border-gray-200'
              }`}
              onDragOver={isManual ? e => onDragOver(e, gi) : undefined}
              onDragLeave={isManual ? onDragLeave : undefined}
              onDrop={isManual ? e => onDrop(e, gi) : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">Grupė {g.name}</span>
                <span className="text-xs text-gray-400">{g.teams.length}/{g.maxTeams}</span>
              </div>
              <div className="space-y-2">
                {g.teams.map((tt: any, i: number) => (
                  <button
                    type="button"
                    key={tt.id}
                    draggable={isManual}
                    onDragStart={isManual ? () => onDragStart(tt.id, gi) : undefined}
                    onClick={isManual ? () => setMoveTarget({ ttId: tt.id, fromGroup: gi, teamName: tt.team.name }) : undefined}
                    disabled={saving}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs
                      ${isManual ? 'cursor-grab active:cursor-grabbing' : ''}
                      disabled:cursor-wait disabled:opacity-60
                      ${tt.seeded
                        ? 'bg-yellow-50 border border-yellow-200'
                        : i < g.advanceCount
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-100'}`}>
                    {tt.seeded && <span className="font-bold text-yellow-700">S</span>}
                    {isManual && <span className="text-gray-300 shrink-0">⠿</span>}
                    <span className="truncate font-medium text-gray-800">{tt.team.name}</span>
                    {i < g.advanceCount && <span className="ml-auto text-green-600 shrink-0">✓</span>}
                    {isManual && <span className="shrink-0 text-base leading-none text-gray-300 sm:hidden">›</span>}
                  </button>
                ))}
              </div>
              {isManual && dragOver === gi && (
                <div className="mt-2 border-2 border-dashed border-blue-300 rounded-lg py-2 text-center text-xs text-blue-400">
                  Paleiskite čia
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 text-center">
                Patenka: {g.advanceCount} iš {g.teams.length}
              </div>
            </div>
          ))}
        </div>
      )}

      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="move-team-title">
          <button
            type="button"
            className="absolute inset-0 bg-gray-950/40"
            onClick={() => setMoveTarget(null)}
            aria-label="Uždaryti komandų perkėlimą"
          />
          <div className="relative w-full rounded-t-xl bg-white p-4 shadow-xl sm:max-w-sm sm:rounded-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400">Perkelti komandą</p>
                <h2 id="move-team-title" className="mt-1 text-lg font-semibold text-gray-900">{moveTarget.teamName}</h2>
                <p className="mt-1 text-sm text-gray-500">Dabar: Grupė {groups[moveTarget.fromGroup]?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
                aria-label="Uždaryti"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {groups.map((group, groupIndex) => groupIndex !== moveTarget.fromGroup && (
                <button
                  key={group.id}
                  type="button"
                  disabled={saving}
                  onClick={() => moveTeam(moveTarget.ttId, moveTarget.fromGroup, groupIndex)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span>Grupė {group.name}</span>
                  <span className="text-xs font-normal text-gray-400">{group.teams.length} komandų</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMoveTarget(null)}
              className="mt-4 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Atšaukti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
