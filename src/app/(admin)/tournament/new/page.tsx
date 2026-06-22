'use client'
// src/app/(admin)/tournament/new/page.tsx
import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import Link            from 'next/link'

export default function NewTournamentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [form, setForm] = useState({
    name:'', organizer:'', location:'',
    startsAt: new Date().toISOString().slice(0,16),
    category:'M',
    // Config
    numGroups:'4', groupSetFormat:'BO2_21', groupTiebreakPoints:'15',
    groupTimeMinutes:'45', groupCourts:'4', groupPointSystem:'TWO_ONE',
    groupBreakMinutes:'10', drawMethod:'SEEDED_RANDOM', numSeeds:'4',
    clubRule:true,
    knockoutFormat:'SINGLE_ELIMINATION', knockoutSetFormat:'BO2_21',
    knockoutTiebreakPoints:'15', finalSetFormat:'BO2_21',
    knockoutTimeMinutes:'60', knockoutCourts:'2', thirdPlaceMatch:true,
    knockoutStartsAt:'',
  })

  const set = (k:string, v:any) => setForm(f=>({...f,[k]:v}))
  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    // 1. Sukurti turnyra
    const tRes  = await fetch('/api/tournaments',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:form.name, organizer:form.organizer||undefined,
        location:form.location||undefined,
        startsAt:new Date(form.startsAt).toISOString(),
        category:form.category,
      }),
    })
    const tData = await tRes.json()
    if (!tData.ok) { setError(tData.error); setSaving(false); return }
    const id = tData.data.id
    // 2. Išsaugoti konfigūraciją
    await fetch(`/api/tournaments/${id}/config`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        numGroups:           parseInt(form.numGroups),
        groupSetFormat:      form.groupSetFormat,
        groupTiebreakPoints: parseInt(form.groupTiebreakPoints),
        groupTimeMinutes:    parseInt(form.groupTimeMinutes),
        groupCourts:         parseInt(form.groupCourts),
        groupPointSystem:    form.groupPointSystem,
        groupBreakMinutes:   parseInt(form.groupBreakMinutes),
        drawMethod:          form.drawMethod,
        numSeeds:            parseInt(form.numSeeds),
        clubRule:            form.clubRule,
        knockoutFormat:      form.knockoutFormat,
        knockoutSetFormat:   form.knockoutSetFormat,
        knockoutTiebreakPoints: parseInt(form.knockoutTiebreakPoints),
        finalSetFormat:      form.finalSetFormat,
        knockoutTimeMinutes: parseInt(form.knockoutTimeMinutes),
        knockoutCourts:      parseInt(form.knockoutCourts),
        thirdPlaceMatch:     form.thirdPlaceMatch,
        knockoutStartsAt:    form.knockoutStartsAt ? new Date(form.knockoutStartsAt).toISOString() : null,
      }),
    })
    router.push(`/tournament/${id}/teams`)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <span className="text-gray-700">Naujas turnyras</span>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Naujas turnyras</h1>

      {error && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pagrindinė info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pagrindinė informacija</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2"><label className={lbl}>Pavadinimas *</label><input value={form.name} onChange={e=>set('name',e.target.value)} className={inp} required placeholder="pvz. Palangos paplūdimio tinklinis 2025"/></div>
            <div><label className={lbl}>Organizatorius</label><input value={form.organizer} onChange={e=>set('organizer',e.target.value)} className={inp} placeholder="Klubas / federacija"/></div>
            <div><label className={lbl}>Vieta</label><input value={form.location} onChange={e=>set('location',e.target.value)} className={inp} placeholder="Miestas, paplūdimys"/></div>
            <div><label className={lbl}>Pradžia *</label><input type="datetime-local" value={form.startsAt} onChange={e=>set('startsAt',e.target.value)} className={inp} required/></div>
            <div><label className={lbl}>Kategorija *</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)} className={inp}>
                <option value="M">♂ Vyrai</option><option value="W">♀ Moterys</option><option value="X">⚥ Mix</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grupių konfigūracija */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Grupių etapas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Grupių skaičius</label><input type="number" value={form.numGroups} onChange={e=>set('numGroups',e.target.value)} className={inp} min="1" max="32"/></div>
            <div><label className={lbl}>Setų formatas</label>
              <select value={form.groupSetFormat} onChange={e=>set('groupSetFormat',e.target.value)} className={inp}>
                <option value="BO2_21">Best of 2 · iki 21</option><option value="BO2_15">Best of 2 · iki 15</option>
                <option value="ONE_21">1 setas · iki 21</option><option value="ONE_15">1 setas · iki 15</option>
              </select>
            </div>
            <div><label className={lbl}>Tiebreak iki (t.)</label>
              <select value={form.groupTiebreakPoints} onChange={e=>set('groupTiebreakPoints',e.target.value)} className={inp}>
                <option value="15">15</option><option value="11">11</option>
              </select>
            </div>
            <div><label className={lbl}>Rungtynių trukmė (min.)</label><input type="number" value={form.groupTimeMinutes} onChange={e=>set('groupTimeMinutes',e.target.value)} className={inp} min="15" max="180"/></div>
            <div><label className={lbl}>Aikštelių skaičius</label><input type="number" value={form.groupCourts} onChange={e=>set('groupCourts',e.target.value)} className={inp} min="1" max="20"/></div>
            <div><label className={lbl}>Pertrauka tarp rungt. (min.)</label><input type="number" value={form.groupBreakMinutes} onChange={e=>set('groupBreakMinutes',e.target.value)} className={inp} min="0"/></div>
            <div><label className={lbl}>Burtų metodas</label>
              <select value={form.drawMethod} onChange={e=>set('drawMethod',e.target.value)} className={inp}>
                <option value="RANDOM">Atsitiktinai</option><option value="SEEDED_RANDOM">Sėjamosios + burtai</option>
                <option value="SNAKE">Serpentinas</option><option value="MANUAL">Rankinis</option>
              </select>
            </div>
            <div><label className={lbl}>Sėjamųjų skaičius</label><input type="number" value={form.numSeeds} onChange={e=>set('numSeeds',e.target.value)} className={inp} min="0"/></div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="clubRule" checked={form.clubRule} onChange={e=>set('clubRule',e.target.checked)} className="w-4 h-4"/>
              <label htmlFor="clubRule" className="text-sm text-gray-600">Klubo apribojimas (vienas klubas — viena grupė)</label>
            </div>
          </div>
        </div>

        {/* Atkrintamosios */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Atkrintamosios</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Sistema</label>
              <select value={form.knockoutFormat} onChange={e=>set('knockoutFormat',e.target.value)} className={inp}>
                <option value="SINGLE_ELIMINATION">Single elimination</option>
                <option value="LUCKY_LOSER">FIVB · Lucky Loser (rekomenduojama)</option>
                <option value="DOUBLE_ELIMINATION">Double elimination</option>
                <option value="ROUND_ROBIN">Apskritasis</option>
              </select>
            </div>
            <div><label className={lbl}>Setų formatas</label>
              <select value={form.knockoutSetFormat} onChange={e=>set('knockoutSetFormat',e.target.value)} className={inp}>
                <option value="BO2_21">Best of 2 · iki 21</option><option value="BO2_15">Best of 2 · iki 15</option>
                <option value="ONE_21">1 setas · iki 21</option><option value="ONE_15">1 setas · iki 15</option>
              </select>
            </div>
            <div><label className={lbl}>Tiebreak iki (t.)</label>
              <select value={form.knockoutTiebreakPoints} onChange={e=>set('knockoutTiebreakPoints',e.target.value)} className={inp}>
                <option value="15">15</option><option value="11">11</option>
              </select>
            </div>
            <div><label className={lbl}>Aikštelių skaičius</label><input type="number" value={form.knockoutCourts} onChange={e=>set('knockoutCourts',e.target.value)} className={inp} min="1"/></div>
            <div><label className={lbl}>Rungtynių trukmė (min.)</label><input type="number" value={form.knockoutTimeMinutes} onChange={e=>set('knockoutTimeMinutes',e.target.value)} className={inp} min="15"/></div>
            <div><label className={lbl}>Atkrintamųjų pradžia</label><input type="datetime-local" value={form.knockoutStartsAt} onChange={e=>set('knockoutStartsAt',e.target.value)} className={inp}/></div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="3rd" checked={form.thirdPlaceMatch} onChange={e=>set('thirdPlaceMatch',e.target.checked)} className="w-4 h-4"/>
              <label htmlFor="3rd" className="text-sm text-gray-600">Rungtynės dėl 3 vietos</label>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
          {saving ? 'Kuriama...' : 'Sukurti turnyra →'}
        </button>
      </form>
    </div>
  )
}
