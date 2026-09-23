import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAuthToken, useAuthProfileReady, useQuery } from 'deepspace'
import { Crown, DoorOpen, Plus, Shield, Users } from 'lucide-react'
import { Button, Input, Label, useToast } from '@/components/ui'

interface Party {
  partyId: string
  name: string
  joinCode: string
}

interface Membership {
  teamId: string
  role: 'dm' | 'player'
  status: 'active' | 'removed'
}

interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function callAction<T>(name: 'createParty' | 'joinParty', params: Record<string, string>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in before managing parties.')

  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const result = (await response.json()) as ActionResponse<T>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'The party request could not be completed.')
  }
  return result.data
}

export default function HomePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const { records: parties, status: partiesStatus } = useQuery<Party>('parties', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { records: memberships } = useQuery<Membership>('team_members')
  const { success, error } = useToast()
  const [pending, setPending] = useState<'create' | 'join' | null>(null)

  const rolesByPartyId = useMemo(
    () =>
      new Map(
        memberships
          .filter((membership) => membership.data.status === 'active')
          .map((membership) => [membership.data.teamId, membership.data.role]),
      ),
    [memberships],
  )

  async function createParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setPending('create')
    try {
      const result = await callAction<{ partyId: string; joinCode: string }>('createParty', {
        name: String(form.get('name') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      formElement.reset()
      success('Party created', `Share code ${result.joinCode} and the password with your players.`)
    } catch (caught) {
      error('Could not create party', caught instanceof Error ? caught.message : undefined)
    } finally {
      setPending(null)
    }
  }

  async function joinParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setPending('join')
    try {
      const result = await callAction<{ partyId: string; joined: boolean }>('joinParty', {
        joinCode: String(form.get('joinCode') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      formElement.reset()
      success(result.joined ? 'Joined party' : 'Already in party', 'Your party is ready when the board arrives.')
    } catch (caught) {
      error('Could not join party', caught instanceof Error ? caught.message : undefined)
    } finally {
      setPending(null)
    }
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto flex min-h-full max-w-5xl items-center px-6 py-16">
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">DungeonAtlas</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Every campaign begins at the table.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Sign in to create a party, join your adventuring group, and prepare for the shared board.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">Your adventuring company</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Welcome back, {user?.name ?? user?.email?.split('@')[0] ?? 'adventurer'}.
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Create a password-protected party for your campaign, or enter a party code to join one.
        </p>
      </header>

      <section aria-labelledby="party-list-heading" className="py-8">
        <div className="mb-4 flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />
          <h2 id="party-list-heading" className="text-lg font-semibold text-foreground">Your parties</h2>
        </div>

        {partiesStatus === 'loading' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="h-40 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        ) : parties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <Shield className="mx-auto size-7 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium text-foreground">No party yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start a new campaign below, or join one with a code.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {parties.map((party) => {
              const role = rolesByPartyId.get(party.data.partyId) ?? 'player'
              return (
                <article key={party.recordId} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-card-foreground">{party.data.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Board coming soon</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      {role === 'dm' && <Crown className="size-3" aria-hidden />}
                      {role === 'dm' ? 'Dungeon Master' : 'Player'}
                    </span>
                  </div>
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Party code</p>
                    <code className="mt-1 block select-all text-sm font-semibold tracking-[0.12em] text-foreground">{party.data.joinCode}</code>
                  </div>
                  <Link
                    to={`/parties/${party.data.partyId}`}
                    className="mt-5 inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    Open board
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section aria-label="Party actions" className="grid gap-5 border-t border-border pt-8 lg:grid-cols-2">
        <form onSubmit={createParty} className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Plus className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-card-foreground">Create a party</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">You will be its Dungeon Master. Give players the generated code and password.</p>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="party-name">Party name</Label>
              <Input id="party-name" name="name" required maxLength={80} placeholder="The Silver Hand" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-party-password">Party password</Label>
              <Input id="create-party-password" name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full" loading={pending === 'create'} disabled={pending !== null}>
            Create party
          </Button>
        </form>

        <form onSubmit={joinParty} className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <DoorOpen className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-card-foreground">Join a party</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask your Dungeon Master for the party code and password.</p>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="join-code">Party code</Label>
              <Input id="join-code" name="joinCode" required minLength={16} maxLength={16} placeholder="a1b2c3d4e5f60708" className="font-mono lowercase" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-party-password">Party password</Label>
              <Input id="join-party-password" name="password" type="password" required minLength={8} maxLength={128} autoComplete="current-password" />
            </div>
          </div>
          <Button type="submit" variant="secondary" className="mt-6 w-full" loading={pending === 'join'} disabled={pending !== null}>
            Join party
          </Button>
        </form>
      </section>
    </main>
  )
}
