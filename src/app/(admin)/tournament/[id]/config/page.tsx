import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ConfigClient from '@/components/admin/ConfigClient'
import { timeOnlyString, timeStringInZone } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

export default async function ConfigPage({ params }: { params: { id: string } }) {
  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { config: true },
  })
  if (!t) notFound()

  const groupsCount = await prisma.group.count({
    where: { tournamentId: params.id },
  })
  const finishedMatchesCount = await prisma.match.count({
    where: { tournamentId: params.id, status: 'FINISHED' },
  })

  const c = t.config
  const initialForm = {
    numGroups: String(c?.numGroups ?? 4),
    advancePerGroup: String(c?.advancePerGroup ?? 2),
    advanceTotal: String(c?.advanceTotal ?? ((c?.numGroups ?? 4) * 2)),
    advanceMode: c?.advanceMode ?? 'fixed',
    groupSetFormat: c?.groupSetFormat ?? 'BO2_21',
    groupTiebreakPoints: String(c?.groupTiebreakPoints ?? 15),
    groupTimeMinutes: String(c?.groupTimeMinutes ?? 45),
    groupCourts: String(c?.groupCourts ?? 4),
    groupPointSystem: c?.groupPointSystem ?? 'TWO_ONE',
    groupStartsAt: timeOnlyString(c?.groupStartsAt, '09:00'),
    groupBreakMinutes: String(c?.groupBreakMinutes ?? 10),
    drawMethod: c?.drawMethod ?? 'SEEDED_RANDOM',
    clubRule: c?.clubRule ?? true,
    knockoutFormat: c?.knockoutFormat ?? 'SINGLE_ELIMINATION',
    knockoutSetFormat: c?.knockoutSetFormat ?? 'BO2_21',
    knockoutTiebreakPoints: String(c?.knockoutTiebreakPoints ?? 15),
    finalSetFormat: c?.finalSetFormat ?? 'BO2_21',
    knockoutTimeMinutes: String(c?.knockoutTimeMinutes ?? 60),
    knockoutCourts: String(c?.knockoutCourts ?? 2),
    thirdPlaceMatch: c?.thirdPlaceMatch ?? true,
    knockoutStartsAt: timeStringInZone(c?.knockoutStartsAt, '15:00'),
  }

  return (
    <ConfigClient
      tournamentId={params.id}
      tName={t.name}
      initialForm={initialForm}
      initialHasGroups={groupsCount > 0}
      initialHasResults={finishedMatchesCount > 0}
    />
  )
}
