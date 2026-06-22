'use client'

import { useMemo, useState } from 'react'
import PublicMatchCard from './PublicMatchCard'

export default function PublicScheduleClient({ matches }: { matches: any[] }) {
  const [groupFilter, setGroupFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')

  const groups = useMemo(() => {
    return [...new Set(matches.map(match => match.group?.name).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, 'lt'))
  }, [matches])

  const teams = useMemo(() => {
    const byId = new Map<string, string>()
    for (const match of matches) {
      if (match.homeTeam?.id && match.homeTeam?.team?.name) byId.set(match.homeTeam.id, match.homeTeam.team.name)
      if (match.awayTeam?.id && match.awayTeam?.team?.name) byId.set(match.awayTeam.id, match.awayTeam.team.name)
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'lt'))
  }, [matches])

  const filtered = useMemo(() => matches.filter(match => {
    if (groupFilter === 'knockout' && match.group) return false
    if (groupFilter.startsWith('group:') && match.group?.name !== groupFilter.slice(6)) return false
    if (teamFilter !== 'all' && match.homeTeamId !== teamFilter && match.awayTeamId !== teamFilter) return false
    return true
  }), [matches, groupFilter, teamFilter])

  const sections = useMemo(() => {
    const result = new Map<string, Map<string, any[]>>()
    for (const match of filtered) {
      const date = match.scheduledAt
        ? new Date(match.scheduledAt).toLocaleDateString('lt-LT', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Laikas dar nepaskirtas'
      const time = match.scheduledAt
        ? new Date(match.scheduledAt).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
        : '—'
      if (!result.has(date)) result.set(date, new Map())
      const times = result.get(date)!
      times.set(time, [...(times.get(time) ?? []), match])
    }
    return result
  }, [filtered])

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Stebėtojo aplinka</p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-950">Tvarkaraštis ir rezultatai</h2>
        </div>
        <span className="shrink-0 text-sm text-gray-400">{filtered.length} rungt.</span>
      </div>

      <div className="mb-7 grid gap-3 border-y border-gray-200 py-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Grupė</span>
          <select
            value={groupFilter}
            onChange={event => setGroupFilter(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
          >
            <option value="all">Visos grupės ir atkrintamosios</option>
            {groups.map(group => <option key={group} value={`group:${group}`}>Grupė {group}</option>)}
            <option value="knockout">Atkrintamosios</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Komanda</span>
          <select
            value={teamFilter}
            onChange={event => setTeamFilter(event.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
          >
            <option value="all">Visos komandos</option>
            {teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-400">Pagal pasirinktus filtrus rungtynių nėra</div>
      ) : (
        <div className="space-y-8">
          {[...sections.entries()].map(([date, times]) => (
            <section key={date}>
              <h3 className="mb-3 text-sm font-semibold capitalize text-gray-700">{date}</h3>
              <div className="space-y-5">
                {[...times.entries()].map(([time, timeMatches]) => (
                  <div key={time}>
                    <div className="mb-2 flex items-center gap-3">
                      <span className="w-12 text-sm font-semibold text-gray-900">{time}</span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {timeMatches.map(match => <PublicMatchCard key={match.id} match={match} compact />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
