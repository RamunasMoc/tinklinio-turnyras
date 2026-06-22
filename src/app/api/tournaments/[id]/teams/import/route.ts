// ============================================================
// src/app/api/tournaments/[id]/teams/import/route.ts
// POST – importuoti komandas iš teksto
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { parseImportText, saveImportedTeams } from '@/lib/import'
import { requireAuth } from '@/lib/middleware/auth'

// ─── POST /api/tournaments/[id]/teams/import ────────────────
//
// Body (JSON):
//   { text: string, onDuplicate?: 'skip' | 'update' }
//
// arba multipart/form-data su failu:
//   file: File (csv/tsv/txt)
//
// Response:
//   { summary: ParseSummary, result?: ImportResult }
//
// Du veikimo režimai:
//   dry=true  – tik parse + validacija, nieko nerašoma į DB
//   dry=false – parse + išsaugojimas (numatyta)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth(['ADMIN'])
  if (!session) {
    return NextResponse.json({ error: 'Prieiga uždrausta' }, { status: 401 })
  }
  const tournamentId = params.id
  const dry = req.nextUrl.searchParams.get('dry') === 'true'

  let text: string
  let onDuplicate: 'skip' | 'update' = 'skip'

  // Failo įkėlimas arba JSON tekstas
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Failas nerastas' }, { status: 400 })
    }
    if (file.size > 1_048_576) {
      return NextResponse.json({ error: 'Failas per didelis (maks. 1 MB)' }, { status: 400 })
    }
    text = await file.text()
  } else {
    const body = await req.json().catch(() => null)
    if (!body?.text) {
      return NextResponse.json({ error: 'Trūksta „text" lauko' }, { status: 400 })
    }
    text = body.text as string
    onDuplicate = body.onDuplicate ?? 'skip'
  }

  // Parse
  const summary = parseImportText(text)

  if (dry) {
    return NextResponse.json({ summary })
  }

  // Išsaugoti tik validias eilutes
  const validRows = summary.rows.filter(r => r.ok) as import('@/lib/import').ParseOk[]

  if (!validRows.length) {
    return NextResponse.json({ summary, result: { imported: 0, skipped: 0, errors: [] } })
  }

  const result = await saveImportedTeams({
    tournamentId,
    rows: validRows,
    onDuplicate: (onDuplicate as any) ?? 'skip',
  })

  return NextResponse.json({ summary, result })
}
