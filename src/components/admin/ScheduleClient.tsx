'use client'
import { useState, useEffect } from 'react'
import { timeOnlyString } from '@/lib/timezone'

export default function ScheduleClient({ tournamentId, config, initialMatches, startsAt, initialGroup = 'all', initialCourt = 'all' }:
  { tournamentId:string; config:any; initialMatches:any[]; startsAt:string; initialGroup?: string; initialCourt?: string }) {

  const [matches, setMatches] = useState<any[]>(initialMatches)

  // Pradžios laikas: iš konfigūracijos arba įvestas rankiniu būdu
  const configTime = (() => {
    try {
      if (!config?.groupStartsAt) return '09:00'
      return timeOnlyString(config.groupStartsAt, '09:00')
    } catch { return '09:00' }
  })()
  const [startTime, setStartTime] = useState<string>(configTime)

  // Atnaujinti kai puslapis gauna fokusą (pvz. grįžus iš grupių puslapio)
  useEffect(() => {
    async function refresh() {
      try {
        const res  = await fetch(`/api/tournaments/${tournamentId}/schedule`)
        const data = await res.json()
        if (data.ok && Array.isArray(data.data)) setMatches(data.data)
      } catch {}
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [tournamentId])
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')
  const [gF,      setGF]      = useState(initialGroup)
  const [cF,      setCF]      = useState(initialCourt)

  async function generate() {
    setLoading(true); setMsg('')
    const res  = await fetch(`/api/tournaments/${tournamentId}/schedule`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ startTime }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) window.location.reload()
    else setMsg(`Klaida: ${data.error}`)
  }

  const groups = [...new Set(matches.map(m=>m.group?.name).filter(Boolean))] as string[]
  const courts = [...new Set(matches.map(m=>m.court).filter(Boolean))].sort() as number[]
  const filtered = matches.filter(m => {
    if (gF !== 'all' && m.group?.name !== gF) return false
    if (cF !== 'all' && String(m.court) !== cF) return false
    return true
  })

  const byTime: Record<string,any[]> = {}
  filtered.forEach(m => {
    const t = m.scheduledAt
      ? new Date(m.scheduledAt).toLocaleTimeString('lt-LT', {hour:'2-digit', minute:'2-digit'})
      : '—'
    if (!byTime[t]) byTime[t] = []
    byTime[t].push(m)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Tvarkaraštis</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Pradžia:</span>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"/>
            {startTime !== configTime && (
              <button type="button" onClick={() => setStartTime(configTime)}
                className="text-xs text-gray-400 hover:text-gray-600 underline">
                ↺ {configTime}
              </button>
            )}
          </div>
          <form
            method="post"
            action={`/api/tournaments/${tournamentId}/schedule`}
            onSubmit={e => {
              if (typeof window !== 'undefined') {
                e.preventDefault()
                generate()
              }
            }}>
            <input type="hidden" name="startTime" value={startTime} />
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Generuojama...' : 'Generuoti tvarkaraštį'}
            </button>
          </form>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{msg}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-gray-400 self-center">Grupė:</span>
        {['all', ...groups].map(g => (
          <a key={g} href={`/tournament/${tournamentId}/schedule?group=${encodeURIComponent(g)}&court=${encodeURIComponent(cF)}`} onClick={() => setGF(g)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${gF===g ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {g === 'all' ? 'Visos' : `Gr.${g}`}
          </a>
        ))}
        <span className="text-xs text-gray-400 self-center ml-2">Aikštelė:</span>
        {['all', ...courts.map(String)].map(c => (
          <a key={c} href={`/tournament/${tournamentId}/schedule?group=${encodeURIComponent(gF)}&court=${encodeURIComponent(c)}`} onClick={() => setCF(c)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${cF===c ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {c === 'all' ? 'Visos' : `Aik.${c}`}
          </a>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400">
          <p className="text-lg mb-2">📅</p>
          <p>Tvarkaraštis negeneruotas. Spausk „Generuoti tvarkaraštį".</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byTime).sort(([a],[b]) => a.localeCompare(b)).map(([time, ms]) => (
            <div key={time}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-gray-500">⏰ {time}</span>
                <div className="flex-1 h-px bg-gray-200"/>
                <span className="text-xs text-gray-400">{ms.length} rungt.</span>
              </div>
              <div className="space-y-2">
                {ms.map((m:any) => {
                  const hW = m.status==='FINISHED' && (m.homeSets??0)>(m.awaySets??0)
                  const aW = m.status==='FINISHED' && (m.awaySets??0)>(m.homeSets??0)
                  return (
                    <div key={m.id} className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${m.status==='FINISHED' ? 'border-green-200 opacity-80' : 'border-gray-200'}`}>
                      <div className="w-12 text-center shrink-0">
                        <div className="text-xs font-medium bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">A.{m.court}</div>
                        {m.group && <div className="text-xs text-blue-600 mt-1">Gr.{m.group.name}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${hW ? 'font-semibold text-green-700' : aW ? 'text-gray-400' : 'text-gray-800'}`}>{m.homeTeam?.team?.name ?? '?'}</div>
                        <div className={`text-sm truncate mt-0.5 ${aW ? 'font-semibold text-green-700' : hW ? 'text-gray-400' : 'text-gray-600'}`}>{m.awayTeam?.team?.name ?? '?'}</div>
                      </div>
                      {m.status==='FINISHED' && (
                        <div className="shrink-0 font-semibold text-sm">
                          <span className={hW ? 'text-green-700' : 'text-gray-400'}>{(m.sets??[]).filter((s:any)=>s.homeScore>s.awayScore).length || m.homeSets}</span>
                          <span className="text-gray-300 mx-1">:</span>
                          <span className={aW ? 'text-green-700' : 'text-gray-400'}>{(m.sets??[]).filter((s:any)=>s.awayScore>s.homeScore).length || m.awaySets}</span>
                        </div>
                      )}
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${m.status==='FINISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.status==='FINISHED' ? 'Baigta' : 'Planuojama'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
