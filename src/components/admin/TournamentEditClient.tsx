'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORY_OPTIONS = [
  { value:'M', label:'♂ Vyrai' },
  { value:'W', label:'♀ Moterys' },
  { value:'X', label:'⚥ Mix' },
]
const AGE_OPTIONS = [
  { value:'', label:'— (visi amžiai)' },
  { value:'U18', label:'U18' },
  { value:'U21', label:'U21' },
  { value:'U23', label:'U23' },
  { value:'OPEN', label:'Open' },
  { value:'PLUS40', label:'40+' },
  { value:'PLUS50', label:'50+' },
  { value:'PLUS100', label:'100+' },
]

export default function TournamentEditClient({ tournament }: { tournament: any }) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [form,    setForm]    = useState({
    name:      tournament.name,
    organizer: tournament.organizer ?? '',
    location:  tournament.location  ?? '',
    startsAt:  tournament.startsAt
      ? new Date(tournament.startsAt).toISOString().slice(0,10)
      : '',
    category:  tournament.category ?? 'M',
    ageGroup:  tournament.ageGroup  ?? '',
    slug:      tournament.slug      ?? '',
  })

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg('')
    const res  = await fetch(`/api/tournaments/${tournament.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:      form.name,
        organizer: form.organizer || null,
        location:  form.location  || null,
        startsAt:  form.startsAt  ? new Date(form.startsAt).toISOString() : undefined,
        category:  form.category,
        ageGroup:  form.ageGroup  || null,
        slug:      form.slug      || undefined,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      setMsg('✓ Išsaugota')
      router.refresh()
      setTimeout(() => { setOpen(false); setMsg('') }, 800)
    } else {
      setMsg(`Klaida: ${data.error}`)
    }
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const lbl = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        ✏️ Redaguoti
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Redaguoti turnyro informaciją</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={save} className="px-6 py-5 space-y-4">
              <div>
                <label className={lbl}>Pavadinimas *</label>
                <input value={form.name} onChange={e=>set('name',e.target.value)}
                  className={inp} required placeholder="pvz. Palangos tinklinis 2025"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Kategorija</label>
                  <select value={form.category} onChange={e=>set('category',e.target.value)} className={inp}>
                    {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Amžiaus grupė</label>
                  <select value={form.ageGroup} onChange={e=>set('ageGroup',e.target.value)} className={inp}>
                    {AGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Data</label>
                <input type="date" value={form.startsAt} onChange={e=>set('startsAt',e.target.value)} className={inp}/>
              </div>
              <div>
                <label className={lbl}>Vieta</label>
                <input value={form.location} onChange={e=>set('location',e.target.value)}
                  className={inp} placeholder="pvz. Palanga, Basanavičiaus g. 5"/>
              </div>
              <div>
                <label className={lbl}>Organizatorius</label>
                <input value={form.organizer} onChange={e=>set('organizer',e.target.value)}
                  className={inp} placeholder="pvz. Palangos sporto centras"/>
              </div>
              <div>
                <label className={lbl}>Nuorodos kodas (slug)</label>
                <input value={form.slug} onChange={e=>set('slug',e.target.value.toLowerCase().replace(/\s+/g,'-'))}
                  className={inp} placeholder="pvz. palanga-2025"/>
                <p className="text-xs text-gray-400 mt-1">Viešos nuorodos adresas: /t/{form.slug || '...'}</p>
              </div>

              {msg && (
                <div className={`px-3 py-2 rounded-lg text-sm ${msg.startsWith('✓')
                  ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {msg}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Atšaukti
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {saving ? 'Saugoma...' : 'Išsaugoti'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
