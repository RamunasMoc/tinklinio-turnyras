'use client'
import { useRouter } from 'next/navigation'
import { useState }  from 'react'

export default function TournamentActions({ id, status }: { id:string; status:string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(newStatus: string) {
    setLoading(true)
    await fetch(`/api/tournaments/${id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status:newStatus}),
    })
    setLoading(false)
    router.refresh()
  }

  const next: Record<string,{label:string;next:string}> = {
    DRAFT:    {label:'Atidaryti registraciją', next:'OPEN'},
    OPEN:     {label:'Uždaryti registraciją',  next:'CLOSED'},
    CLOSED:   {label:'Pradėti grupių etapą',   next:'GROUPS'},
    GROUPS:   {label:'Pereiti į atkrintamąsias', next:'KNOCKOUT'},
    KNOCKOUT: {label:'Pažymėti kaip baigtą',   next:'FINISHED'},
  }

  const action = next[status]
  if (!action) return null

  return (
    <button onClick={()=>updateStatus(action.next)} disabled={loading}
      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">
      {loading ? '...' : action.label}
    </button>
  )
}
