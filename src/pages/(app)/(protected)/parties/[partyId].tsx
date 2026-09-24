import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Crown, Map } from 'lucide-react'
import { useAuthProfileReady, useQuery } from 'deepspace'
import { PartyBoardCanvas } from '@/components/PartyBoardCanvas'
import { PartyCharacterRoster } from '@/components/PartyCharacterRoster'

interface Party {
  partyId: string
  name: string
}

interface Membership {
  teamId: string
  role: 'dm' | 'player'
  status: 'active' | 'removed'
}

export default function PartyBoardPage() {
  const { partyId } = useParams()
  const { user } = useAuthProfileReady({ requireUser: true })
  const { records: parties, status } = useQuery<Party>('parties', {
    where: partyId ? { partyId } : { partyId: '__missing__' },
    limit: 1,
  })
  const { records: memberships } = useQuery<Membership>('team_members')
  const party = parties[0]
  const membership = memberships.find(
    (record) => record.data.teamId === partyId && record.data.status === 'active',
  )
  const [canvasAttendance, setCanvasAttendance] = useState<{ connected: boolean; userIds: string[] }>({
    connected: false,
    userIds: [],
  })
  const updateCanvasAttendance = useCallback(
    (attendance: { connected: boolean; userIds: string[] }) => setCanvasAttendance(attendance),
    [],
  )

  if (status === 'loading') {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading board…</div>
  }

  const attendeeUserIds = new Set(canvasAttendance.userIds)
  if (canvasAttendance.connected && user?.id) attendeeUserIds.add(user.id)

  if (!party || !partyId || !membership) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <Map className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Board unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">You need an active membership in this party to view its board.</p>
        <Link to="/home" className="mt-6 text-sm font-medium text-primary hover:underline">Return to your parties</Link>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Your parties
      </Link>
      <header className="mb-6 mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">Campaign board</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{party.data.name}</h1>
        </div>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {membership.data.role === 'dm' && <Crown className="size-4 text-primary" aria-hidden />}
          {membership.data.role === 'dm' ? 'Dungeon Master controls enabled' : 'Player view'}
        </p>
      </header>
      <PartyCharacterRoster
        partyId={partyId}
        isDungeonMaster={membership.data.role === 'dm'}
        attendeeUserIds={attendeeUserIds}
      />
      <PartyBoardCanvas partyId={partyId} onAttendanceChange={updateCanvasAttendance} />
    </main>
  )
}
