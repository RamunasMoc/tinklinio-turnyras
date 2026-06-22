'use client'
// src/components/admin/TeamsClient.tsx
import { useState } from 'react'

type Player = { id:string; firstName:string; lastName:string; dateOfBirth:string|null; ageYears:number|null; shirtSize:string|null; playerOrder:number }
type Team   = { id:string; name:string; club:string|null; category:string|null; rating:number|null; teamAge:number|null }
type TT     = { id:string; seeded:boolean; seedRank:number|null; group:{name:string}|null; team:Team & {players:Player[]} }

const CAT_COLOR: Record<string,string> = { M:'bg-blue-100 text-blue-700', W:'bg-pink-100 text-pink-700', X:'bg-purple-100 text-purple-700' }
const CAT_LBL:   Record<string,string> = { M:'Vyrai', W:'Moterys', X:'Mix' }
type TeamsTab = 'list'|'favorites'|'add'

function readInitialTab(fallback: TeamsTab): TeamsTab {
  if (typeof window === 'undefined') return fallback
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === 'add' || tab === 'favorites' ? tab : 'list'
}

function ageDisplay(p: Player) {
  if (p.dateOfBirth) {
    const bd = new Date(p.dateOfBirth), now = new Date()
    let a = now.getFullYear() - bd.getFullYear()
    if (now.getMonth() - bd.getMonth() < 0) a--
    return `${a} m.`
  }
  if (p.ageYears) return `~${p.ageYears} m.`
  return '—'
}

export default function TeamsClient({ tournamentId, initialTeams, initialTab = 'list' }: { tournamentId:string; initialTeams:TT[]; initialTab?: TeamsTab }) {
  const [teams, setTeams]   = useState<TT[]>(initialTeams)
  const [search, setSearch] = useState('')
  const [catF, setCatF]     = useState('')
  const [tab, setTab]       = useState<TeamsTab>(() => readInitialTab(initialTab))
  const [saving,   setSaving]   = useState(false)
  const [editing,  setEditing]  = useState<any|null>(null)  // komanda kurią redaguojame
  const [editForm, setEditForm] = useState<any>({})
  const [msg, setMsg]       = useState('')

  // Add form state
  const [form, setForm] = useState({
    name:'', club:'', category:'', rating:'', teamAge:'', ageGroup:'',
    p1f:'', p1l:'', p1dob:'', p1age:'', p1shirt:'',
    p2f:'', p2l:'', p2dob:'', p2age:'', p2shirt:'',
  })

  const filtered = teams.filter(tt => {
    if (catF && tt.team.category !== catF) return false
    if (search) {
      const hay = [tt.team.name, tt.team.club, tt.team.players[0]?.firstName, tt.team.players[0]?.lastName,
                   tt.team.players[1]?.firstName, tt.team.players[1]?.lastName].join(' ').toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })
  const seededTeams = teams
    .filter(tt => tt.seeded)
    .sort((a, b) => (a.seedRank ?? 9999) - (b.seedRank ?? 9999))

  async function toggleSeeded(tt: TT) {
    const res  = await fetch(`/api/tournaments/${tournamentId}/teams/${tt.id}`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ seeded: !tt.seeded }),
    })
    const data = await res.json()
    if (data.ok) setTeams(prev => prev.map(t => t.id===tt.id ? { ...t, seeded: !tt.seeded } : t))
  }

  function openEdit(tt: TT) {
    const [p1, p2] = tt.team.players
    setEditing(tt)
    setEditForm({
      name:   tt.team.name,
      club:   tt.team.club ?? '',
      rating: tt.team.rating  ? String(tt.team.rating)  : '',
      teamAge:  (tt.team as any).teamAge ? String((tt.team as any).teamAge) : '',
      p1f: p1?.firstName ?? '', p1l: p1?.lastName ?? '',
      p1dob:   p1?.dateOfBirth ? new Date(p1.dateOfBirth).toISOString().slice(0,10) : '',
      p1age:   p1?.ageYears   ? String(p1.ageYears)  : '',
      p1shirt: (p1 as any)?.shirtSize ?? '',
      p2f: p2?.firstName ?? '', p2l: p2?.lastName ?? '',
      p2dob:   p2?.dateOfBirth ? new Date(p2.dateOfBirth).toISOString().slice(0,10) : '',
      p2age:   p2?.ageYears   ? String(p2.ageYears)  : '',
      p2shirt: (p2 as any)?.shirtSize ?? '',
    })
    setMsg('')
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setMsg('')
    const res = await fetch(`/api/tournaments/${tournamentId}/teams/${editing.id}`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        name:   editForm.name || undefined,
        club:   editForm.club || null,
        rating:   editForm.rating   ? parseInt(editForm.rating)   : null,
        teamAge:  editForm.teamAge  ? parseInt(editForm.teamAge)  : null,
        player1: { firstName:editForm.p1f, lastName:editForm.p1l,
          dateOfBirth: editForm.p1dob||null, ageYears: editForm.p1age?parseInt(editForm.p1age):null,
          shirtSize: editForm.p1shirt||null },
        player2: { firstName:editForm.p2f, lastName:editForm.p2l,
          dateOfBirth: editForm.p2dob||null, ageYears: editForm.p2age?parseInt(editForm.p2age):null,
          shirtSize: editForm.p2shirt||null },
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      setTeams(prev => prev.map(t => t.id===editing.id ? data.data : t))
      setEditing(null)
      setMsg('✓ Komanda atnaujinta')
    } else {
      setMsg(`Klaida: ${data.error}`)
    }
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!form.p1f||!form.p1l||!form.p2f||!form.p2l||!form.category) {
      setMsg('Užpildykite kategoriją ir abiejų žaidėjų vardus/pavardes')
      return
    }
    setSaving(true); setMsg('')
    const body = {
      name:     form.name || undefined,
      club:     form.club || null,
      category: form.category,
      rating:   form.rating ? parseInt(form.rating) : null,
      ageGroup: form.ageGroup || null,
      teamAge:  (form as any).teamAge ? parseInt((form as any).teamAge) : null,
      player1:  { firstName:form.p1f, lastName:form.p1l, dateOfBirth:form.p1dob||null, ageYears:form.p1age?parseInt(form.p1age):null, shirtSize:(form as any).p1shirt||null },
      player2:  { firstName:form.p2f, lastName:form.p2l, dateOfBirth:form.p2dob||null, ageYears:form.p2age?parseInt(form.p2age):null, shirtSize:(form as any).p2shirt||null },
    }
    const res = await fetch(`/api/tournaments/${tournamentId}/teams`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      setTeams(prev => [...prev, data.data])
      setForm({name:'',club:'',category:'',rating:'',teamAge:'',ageGroup:'',p1f:'',p1l:'',p1dob:'',p1age:'',p1shirt:'',p2f:'',p2l:'',p2dob:'',p2age:'',p2shirt:''})
      setMsg('✓ Komanda pridėta')
      setTab('list')
    } else {
      setMsg(`Klaida: ${data.error}`)
    }
  }

  async function deleteTeam(ttId: string) {
    if (!confirm('Ištrinti komandą?')) return
    await fetch(`/api/tournaments/${tournamentId}/teams/${ttId}`, { method:'DELETE' })
    setTeams(prev => prev.filter(t => t.id !== ttId))
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Komandos ({teams.length})</h1>
        <div className="flex gap-2">
          <a href={`/tournament/${tournamentId}/teams?tab=list`} onClick={()=>setTab('list')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab==='list'?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>Sąrašas</a>
          <a href={`/tournament/${tournamentId}/teams?tab=favorites`} onClick={()=>setTab('favorites')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab==='favorites'?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>Favoritai</a>
          <a href={`/tournament/${tournamentId}/teams?tab=add`} onClick={()=>setTab('add')}  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab==='add' ?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>+ Pridėti</a>
        </div>
      </div>

      {msg && <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.startsWith('✓')?'bg-green-50 text-green-700 border border-green-200':'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

      {/* Redagavimo forma */}
      {editing && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Redaguoti: {editing.team.name}</h2>
            <button onClick={()=>setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Pavadinimas</label>
                <input value={editForm.name} onChange={e=>setEditForm((f:any)=>({...f,name:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Klubas</label>
                <input value={editForm.club} onChange={e=>setEditForm((f:any)=>({...f,club:e.target.value}))} className={inp}/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Reitingas</label>
                <input type="number" value={editForm.rating} onChange={e=>setEditForm((f:any)=>({...f,rating:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Bendras komandos amžius</label>
                <input type="number" value={editForm.teamAge} onChange={e=>setEditForm((f:any)=>({...f,teamAge:e.target.value}))} className={inp} min="20" max="200" placeholder="pvz. 65"/></div>
            </div>
            {[{n:'1',ff:'p1f',lf:'p1l',df:'p1dob',af:'p1age',sf:'p1shirt'},{n:'2',ff:'p2f',lf:'p2l',df:'p2dob',af:'p2age',sf:'p2shirt'}].map(p=>(
              <div key={p.n} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">{p.n} žaidėjas</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><label className={lbl}>Vardas *</label>
                    <input value={editForm[p.ff]} onChange={e=>setEditForm((f:any)=>({...f,[p.ff]:e.target.value}))} className={inp} required/></div>
                  <div><label className={lbl}>Pavardė *</label>
                    <input value={editForm[p.lf]} onChange={e=>setEditForm((f:any)=>({...f,[p.lf]:e.target.value}))} className={inp} required/></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={lbl}>Gimimo data</label>
                    <input type="date" value={editForm[p.df]} onChange={e=>setEditForm((f:any)=>({...f,[p.df]:e.target.value,[p.af]:''}))} className={inp}/></div>
                  <div><label className={lbl}>Arba amžius</label>
                    <input type="number" value={editForm[p.af]} onChange={e=>setEditForm((f:any)=>({...f,[p.af]:e.target.value,[p.df]:''}))} className={inp} min="10" max="100"/></div>
                  <div><label className={lbl}>Marškinėlių dydis</label>
                    <select value={editForm[p.sf]} onChange={e=>setEditForm((f:any)=>({...f,[p.sf]:e.target.value}))} className={inp}>
                      <option value="">—</option>
                      {['XS','S','M','L','XL','XXL'].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={()=>setEditing(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Atšaukti</button>
              <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving?'Saugoma...':'Išsaugoti pakeitimus'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="flex gap-3 mb-4">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ieškoti..." className={inp+' flex-1'} />
            <select value={catF} onChange={e=>setCatF(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Visos</option>
              <option value="M">Vyrai</option>
              <option value="W">Moterys</option>
              <option value="X">Mix</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {teams.length === 0 ? 'Nėra komandų. Pridėkite pirmą.' : 'Nerasta.'}
            </div>
          ) : (
            <div className="space-y-2">
              {teams.some(t => t.seeded) && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 px-1">
                  <span className="text-yellow-500">⭐</span>
                  <span>Sėjamosios komandos bus skirstomos į skirtingas grupes</span>
                </div>
              )}
              {filtered.map((tt, i) => {
                const [p1, p2] = tt.team.players
                return (
                  <div key={tt.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                    <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{tt.team.name}</span>
                        {tt.team.club && <span className="text-xs text-gray-400">{tt.team.club}</span>}
                        {tt.team.category && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[tt.team.category]}`}>{CAT_LBL[tt.team.category]}</span>}

                        {tt.group && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Grupė {tt.group.name}</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {p1 && <span>{p1.firstName} {p1.lastName} {ageDisplay(p1)}</span>}
                        {p1 && p2 && <span className="mx-1 text-gray-300">/</span>}
                        {p2 && <span>{p2.firstName} {p2.lastName} {ageDisplay(p2)}</span>}
                      </div>
                    </div>
                    {tt.team.rating && <span className="text-sm font-medium text-gray-700 shrink-0">{tt.team.rating}</span>}
                    <button
                      onClick={()=>toggleSeeded(tt)}
                      className="text-sm shrink-0 mr-1 transition-colors"
                      style={{ opacity: tt.seeded ? 1 : 0.25, filter: tt.seeded ? 'none' : 'grayscale(1)' }}
                      title={tt.seeded?'Pašalinti iš sėjamųjų':'Pažymėti kaip sėjamuosius'}>
                      ⭐
                    </button>
                    <button onClick={()=>openEdit(tt)} className="text-gray-300 hover:text-blue-500 transition-colors text-sm shrink-0 mr-1" title="Redaguoti">✏️</button>
                    <button onClick={()=>deleteTeam(tt.id)} className="text-gray-300 hover:text-red-500 transition-colors text-sm shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'favorites' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {seededTeams.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nėra sėjamųjų komandų.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-12">Nr.</th>
                    <th className="px-4 py-3 text-left font-medium">Komanda</th>
                    <th className="px-4 py-3 text-left font-medium">Komandos amžius</th>
                    <th className="px-4 py-3 text-left font-medium">1 žaidėjas</th>
                    <th className="px-4 py-3 text-left font-medium">Dydis</th>
                    <th className="px-4 py-3 text-left font-medium">2 žaidėjas</th>
                    <th className="px-4 py-3 text-left font-medium">Dydis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {seededTeams.map((tt, i) => {
                    const [p1, p2] = tt.team.players
                    return (
                      <tr key={tt.id}>
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{tt.team.name}</td>
                        <td className="px-4 py-3 text-gray-600">{tt.team.teamAge ? `${tt.team.teamAge} m.` : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p1 ? p1.firstName : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{p1?.shirtSize || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p2 ? p2.firstName : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{p2?.shirtSize || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'add' && (
        <form onSubmit={addTeam} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Pavadinimas</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp} placeholder="Sugeneruojamas automatiškai"/></div>
            <div><label className={lbl}>Klubas</label><input value={form.club} onChange={e=>setForm(f=>({...f,club:e.target.value}))} className={inp} placeholder="Klubo pavadinimas"/></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Kategorija *</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={inp} required>
                <option value="">—</option>
                <option value="M">♂ Vyrai</option>
                <option value="X">⚥ Mix</option>
                <option value="W">♀ Moterys</option>
              </select>
            </div>
            <div><label className={lbl}>Reitingas</label><input type="number" value={form.rating} onChange={e=>setForm(f=>({...f,rating:e.target.value}))} className={inp} placeholder="pvz. 850"/></div>
            <div><label className={lbl}>Komandos amžius</label><input type="number" value={(form as any).teamAge} onChange={e=>setForm(f=>({...f,teamAge:e.target.value} as any))} className={inp} placeholder="pvz. 65" min="20" max="200"/></div>
            <div>
              <label className={lbl}>Amžiaus grupė</label>
              <select value={form.ageGroup} onChange={e=>setForm(f=>({...f,ageGroup:e.target.value}))} className={inp}>
                <option value="">—</option>
                <option value="U18">U18</option><option value="U21">U21</option><option value="U23">U23</option>
                <option value="Open">Open</option>
                <option value="40+">40+ (vieno amžius)</option><option value="50+">50+ (vieno amžius)</option>
                <option value="60+">60+ (vieno amžius)</option>
                <option value="90+">90+ (dviejų suma)</option><option value="100+">100+ (dviejų suma)</option>
              </select>
            </div>
          </div>
          <hr className="border-gray-100"/>
          {[{n:'1',ff:'p1f',lf:'p1l',df:'p1dob',af:'p1age',sf:'p1shirt'},{n:'2',ff:'p2f',lf:'p2l',df:'p2dob',af:'p2age',sf:'p2shirt'}].map(p=>(
            <div key={p.n} className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">{p.n} žaidėjas</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className={lbl}>Vardas *</label><input value={(form as any)[p.ff]} onChange={e=>setForm(f=>({...f,[p.ff]:e.target.value}))} className={inp} placeholder="Vardas" required/></div>
                <div><label className={lbl}>Pavardė *</label><input value={(form as any)[p.lf]} onChange={e=>setForm(f=>({...f,[p.lf]:e.target.value}))} className={inp} placeholder="Pavardė" required/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lbl}>Gimimo data</label><input type="date" value={(form as any)[p.df]} onChange={e=>setForm(f=>({...f,[p.df]:e.target.value,[p.af]:''}))} className={inp}/></div>
                <div><label className={lbl}>Arba amžius</label><input type="number" value={(form as any)[p.af]} onChange={e=>setForm(f=>({...f,[p.af]:e.target.value,[p.df]:''}))} className={inp} placeholder="pvz. 28" min="10" max="100"/></div>
                <div><label className={lbl}>Marškinėlių dydis</label>
                  <select value={(form as any)[p.sf]} onChange={e=>setForm(f=>({...f,[p.sf]:e.target.value} as any))} className={inp}>
                    <option value="">—</option>
                    {['XS','S','M','L','XL','XXL'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving} className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {saving ? 'Saugoma...' : '+ Pridėti komandą'}
          </button>
        </form>
      )}
    </div>
  )
}
