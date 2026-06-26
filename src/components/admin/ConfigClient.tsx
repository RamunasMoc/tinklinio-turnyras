'use client'
import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import Link                    from 'next/link'
import { combineDateAndTimeInZone } from '@/lib/timezone'
import { isBestOfTwoSetFormat, THREE_TWO_ONE_ZERO } from '@/lib/tournament/points'

type ConfigForm = {
  numGroups:string; advancePerGroup:string; advanceTotal:string; advanceMode:string; groupSetFormat:string; groupTiebreakPoints:string
  groupTimeMinutes:string; groupCourts:string; groupPointSystem:string
  groupStartsAt:string; groupBreakMinutes:string; drawMethod:string; clubRule:boolean
  knockoutFormat:string; knockoutSetFormat:string
  knockoutTiebreakPoints:string; finalSetFormat:string
  knockoutTimeMinutes:string; knockoutCourts:string; thirdPlaceMatch:boolean
  knockoutStartsAt:string
}

export default function ConfigClient({
  tournamentId,
  tName: initialTName,
  initialForm,
  initialHasGroups,
  initialHasResults,
}: {
  tournamentId: string
  tName: string
  initialForm: ConfigForm
  initialHasGroups: boolean
  initialHasResults: boolean
}) {
  const router   = useRouter()
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [tName] = useState(initialTName)
  const [hasGroups] = useState(initialHasGroups)
  const [hasResults] = useState(initialHasResults)
  const [showWarn,   setShowWarn]   = useState(false)
  const [origForm,   setOrigForm]   = useState<any>(initialForm)

  const [form, setForm] = useState(initialForm)

  const set = (k: string, v: any) => setForm(f => ({...f, [k]: v}))
  const groupPointSystemSupportsSetScore = isBestOfTwoSetFormat(form.groupSetFormat)

  useEffect(() => {
    if (!groupPointSystemSupportsSetScore && form.groupPointSystem === THREE_TWO_ONE_ZERO) {
      set('groupPointSystem', 'TWO_ONE')
    }
  }, [groupPointSystemSupportsSetScore, form.groupPointSystem])

  const criticalChanged = origForm && (
    form.numGroups !== origForm.numGroups ||
    form.groupSetFormat !== origForm.groupSetFormat ||
    form.groupPointSystem !== origForm.groupPointSystem ||
    form.knockoutFormat !== origForm.knockoutFormat
  )

  async function doSave(resetData: boolean) {
    setSaving(true); setMsg(''); setShowWarn(false)
    if (resetData) {
      // Vienas endpoint'as ištrina viską: grupes, mačus, setus, statistiką
      await fetch(`/api/tournaments/${tournamentId}/groups/clear`, { method: 'POST' })
    }
    // Gauti turnyro datą kad sujungtume su KO laiku
    const tDateRes  = await fetch(`/api/tournaments/${tournamentId}`)
    const tDateData = await tDateRes.json()
    const tournamentDate = tDateData.ok ? new Date(tDateData.data.startsAt) : new Date()

    const res = await fetch(`/api/tournaments/${tournamentId}/config`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        numGroups: parseInt(form.numGroups),
        advancePerGroup: parseInt(form.advancePerGroup || '2'),
        advanceTotal: parseInt(form.advanceTotal || '8'),
        advanceMode: form.advanceMode || 'fixed',
        groupSetFormat: form.groupSetFormat,
        groupTiebreakPoints: parseInt(form.groupTiebreakPoints), groupTimeMinutes: parseInt(form.groupTimeMinutes),
        groupCourts: parseInt(form.groupCourts), groupPointSystem: form.groupPointSystem,
        groupStartsAt: form.groupStartsAt || null,
        groupBreakMinutes: parseInt(form.groupBreakMinutes), drawMethod: form.drawMethod,
        clubRule: form.clubRule,
        knockoutFormat: form.knockoutFormat, knockoutSetFormat: form.knockoutSetFormat,
        knockoutTiebreakPoints: parseInt(form.knockoutTiebreakPoints), finalSetFormat: form.finalSetFormat,
        knockoutTimeMinutes: parseInt(form.knockoutTimeMinutes), knockoutCourts: parseInt(form.knockoutCourts),
        thirdPlaceMatch: form.thirdPlaceMatch,
        knockoutStartsAt: (() => {
          if (!form.knockoutStartsAt) return null
          return combineDateAndTimeInZone(tournamentDate, form.knockoutStartsAt).toISOString()
        })(),
        lunchBreakMinutes: null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      setMsg(resetData ? '✓ Išsaugota. Grupės ir rezultatai išvalyti.' : '✓ Konfigūracija išsaugota')
      setOrigForm(form)
      setTimeout(() => { router.refresh(); router.push(`/tournament/${tournamentId}`) }, 1200)
    } else setMsg(`Klaida: ${data.error}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (criticalChanged && (hasGroups || hasResults)) { setShowWarn(true) }
    else doSave(false)
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${tournamentId}`}>{tName}</Link><span>/</span>
        <span className="text-gray-700">Konfigūracija</span>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Konfigūracija</h1>
        <Link href={`/tournament/${tournamentId}/rules`} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          ? Nustatymų paaiškinimas
        </Link>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.startsWith('✓')
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>
      )}

      {showWarn && (
        <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Pasikeitė kritiniai nustatymai</p>
          <p className="text-sm text-yellow-700 mb-3">
            {hasGroups && 'Esamos grupės bus ištrintos. '}
            {hasResults && 'Visi rezultatai bus išvalyti. '}
            Kaip norite tęsti?
          </p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowWarn(false)}
              className="px-3 py-1.5 border border-yellow-300 rounded-lg text-sm text-yellow-800 hover:bg-yellow-100">
              Atšaukti
            </button>
            <button onClick={() => doSave(true)}
              className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700">
              Išsaugoti ir išvalyti duomenis
            </button>
            <button onClick={() => doSave(false)}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
              Išsaugoti be valymo
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Grupių etapas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Grupių skaičius</label><input type="number" value={form.numGroups} onChange={e=>set('numGroups',e.target.value)} className={inp} min="1" max="32"/></div>

            {/* Patekimas į atkrintamąsias */}
            <div className="col-span-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-2">Patekimas į atkrintamąsias</label>
              <div className="flex gap-1 mb-3 p-0.5 bg-gray-200 rounded-md w-fit">
                <button type="button" onClick={()=>set('advanceMode','fixed')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${form.advanceMode==='fixed'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                  Fiksuotas iš grupės
                </button>
                <button type="button" onClick={()=>set('advanceMode','total')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${form.advanceMode==='total'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                  Iš viso + geriausios
                </button>
              </div>
              {form.advanceMode === 'fixed' ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Iš kiekvienos grupės:</span>
                    <input type="number" value={form.advancePerGroup} min={1} max={10}
                      onChange={e=>set('advancePerGroup',e.target.value)}
                      className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"/>
                  </div>
                  <span className="text-xs text-gray-400">
                    → iš viso <strong className="text-gray-700">{parseInt(form.advancePerGroup||'2') * parseInt(form.numGroups||'4')}</strong> komandų
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Garantuojama iš grupės:</span>
                      <input type="number" value={form.advancePerGroup} min={1} max={10}
                        onChange={e=>set('advancePerGroup',e.target.value)}
                        className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"/>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Iš viso patenka:</span>
                      <input type="number" value={form.advanceTotal} min={parseInt(form.numGroups||'4')} max={64}
                        onChange={e=>set('advanceTotal',e.target.value)}
                        className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"/>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {parseInt(form.numGroups||'4')} grupių × {form.advancePerGroup||2} = <strong>{parseInt(form.advancePerGroup||'2')*parseInt(form.numGroups||'4')}</strong> tiesioginių
                    {parseInt(form.advanceTotal||'8') > parseInt(form.advancePerGroup||'2')*parseInt(form.numGroups||'4') &&
                      ` + ${parseInt(form.advanceTotal||'8') - parseInt(form.advancePerGroup||'2')*parseInt(form.numGroups||'4')} geriausių likusių`}
                  </p>
                </div>
              )}
            </div>

            <div><label className={lbl}>Setų formatas</label>
              <select value={form.groupSetFormat} onChange={e=>set('groupSetFormat',e.target.value)} className={inp}>
                <option value="BO2_21">Best of 2 · iki 21</option><option value="BO2_15">Best of 2 · iki 15</option>
                <option value="ONE_21">1 setas · iki 21</option><option value="ONE_15">1 setas · iki 15</option>
              </select></div>
            <div><label className={lbl}>Tiebreak iki (t.)</label>
              <select value={form.groupTiebreakPoints} onChange={e=>set('groupTiebreakPoints',e.target.value)} className={inp}>
                <option value="15">15</option><option value="11">11</option>
              </select></div>
            <div><label className={lbl}>Rungtynių trukmė (min.)</label><input type="number" value={form.groupTimeMinutes} onChange={e=>set('groupTimeMinutes',e.target.value)} className={inp} min="15" max="180"/></div>
            <div><label className={lbl}>Aikštelių skaičius</label><input type="number" value={form.groupCourts} onChange={e=>set('groupCourts',e.target.value)} className={inp} min="1" max="20"/></div>
            <div><label className={lbl}>Grupių pradžios laikas</label><input type="time" value={form.groupStartsAt} onChange={e=>set('groupStartsAt',e.target.value)} className={inp}/></div>
            <div><label className={lbl}>Pertrauka tarp rungt. (min.)</label><input type="number" value={form.groupBreakMinutes} onChange={e=>set('groupBreakMinutes',e.target.value)} className={inp} min="0"/></div>
            <div><label className={lbl}>Laimėjimo sistema</label>
              <select value={form.groupPointSystem} onChange={e=>set('groupPointSystem',e.target.value)} className={inp}>
                <option value="TWO_ONE">2 Taškai - Laimėjimas/ 1 Taškas - Pralaimėjimas</option>
                {groupPointSystemSupportsSetScore && (
                  <option value={THREE_TWO_ONE_ZERO}>3 Taškai - 2:0 / 2 Taškai - 2:1 / 1 Taškas - 1:2 / 0 Taškų - 0:2</option>
                )}
                <option value="WIN_LOSS">1 Taškas - Laimėjimas/ 0 Taškų - Pralaimėjimas</option>
                <option value="SET_RATIO">Setų santykis (Taškas už laimėtą setą)</option>
              </select></div>
            
            <div><label className={lbl}>Burtų metodas</label>
              <select value={form.drawMethod} onChange={e=>set('drawMethod',e.target.value)} className={inp}>
                <option value="RANDOM">Atsitiktinis (sėjamosios atskirai)</option>
                <option value="SEEDED_RANDOM">Sėjamosios pagal reitingą</option>
                <option value="SNAKE">Gyvatėlė pagal reitingą</option>
                <option value="MANUAL">Rankinis</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-2">
              <input type="checkbox" id="clubRule" checked={form.clubRule} onChange={e=>set('clubRule',e.target.checked)} className="w-4 h-4"/>
              <label htmlFor="clubRule" className="text-sm text-gray-600">Klubo apribojimas — tos pačios klubo komandos bus skirstomos į skirtingas grupes</label>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Atkrintamosios</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Sistema</label>
              <select value={form.knockoutFormat} onChange={e=>set('knockoutFormat',e.target.value)} className={inp}>
                <option value="SINGLE_ELIMINATION">Single elimination</option>
                <option value="LUCKY_LOSER">FIVB · Lucky Loser (rekomenduojama)</option>
                <option value="DOUBLE_ELIMINATION">Double elimination</option>
                <option value="ROUND_ROBIN">Apskritasis</option>
              </select></div>
            <div><label className={lbl}>Setų formatas</label>
              <select value={form.knockoutSetFormat} onChange={e=>set('knockoutSetFormat',e.target.value)} className={inp}>
                <option value="BO2_21">Best of 2 · iki 21</option><option value="BO2_15">Best of 2 · iki 15</option>
                <option value="ONE_21">1 setas · iki 21</option><option value="ONE_15">1 setas · iki 15</option>
              </select></div>
            <div><label className={lbl}>Tiebreak iki (t.)</label>
              <select value={form.knockoutTiebreakPoints} onChange={e=>set('knockoutTiebreakPoints',e.target.value)} className={inp}>
                <option value="15">15</option><option value="11">11</option>
              </select></div>
            <div><label className={lbl}>Aikštelių skaičius</label><input type="number" value={form.knockoutCourts} onChange={e=>set('knockoutCourts',e.target.value)} className={inp} min="1"/></div>
            <div><label className={lbl}>Rungtynių trukmė (min.)</label><input type="number" value={form.knockoutTimeMinutes} onChange={e=>set('knockoutTimeMinutes',e.target.value)} className={inp} min="15"/></div>

            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="3rd" checked={form.thirdPlaceMatch} onChange={e=>set('thirdPlaceMatch',e.target.checked)} className="w-4 h-4"/>
              <label htmlFor="3rd" className="text-sm text-gray-600">Rungtynės dėl 3 vietos</label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/tournament/${tournamentId}`} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Atšaukti</Link>
          <button type="submit" disabled={saving || showWarn} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Saugoma...' : 'Išsaugoti konfigūraciją'}
          </button>
        </div>
      </form>
    </div>
  )
}
