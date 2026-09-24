import { useState } from 'react'
import { Eye, Heart, LoaderCircle, Users } from 'lucide-react'
import { getAuthToken, useQuery } from 'deepspace'
import { Button, Modal, useToast } from '@/components/ui'

interface PartyCharacter {
  partyId: string
  characterId: string
  characterName?: string
  ownerId: string
}

interface CharacterDetails {
  name: string
  ancestry: string
  className: string
  background: string
  level: number
  experience: number
  abilityScores: Record<string, number>
  hitPoints: { current?: number; maximum?: number; temporary?: number }
  notes: string
}

interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function fetchCharacterDetails(partyId: string, characterId: string): Promise<CharacterDetails> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in to view character details.')

  const response = await fetch('/api/actions/getPartyCharacterDetails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ partyId, characterId }),
  })
  const result = (await response.json()) as ActionResponse<CharacterDetails>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'Character details could not be loaded.')
  }
  return result.data
}

export function PartyCharacterRoster({
  partyId,
  isDungeonMaster,
  attendeeUserIds,
}: {
  partyId: string
  isDungeonMaster: boolean
  attendeeUserIds: Set<string>
}) {
  const { records: links, status } = useQuery<PartyCharacter>('party_characters', {
    where: { partyId },
    orderBy: 'createdAt',
    orderDir: 'asc',
  })
  const { error } = useToast()
  const [details, setDetails] = useState<CharacterDetails | null>(null)
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(null)

  async function showCharacterDetails(characterId: string) {
    if (!isDungeonMaster) return
    setLoadingCharacterId(characterId)
    try {
      setDetails(await fetchCharacterDetails(partyId, characterId))
    } catch (caught) {
      error('Could not load character details', caught instanceof Error ? caught.message : undefined)
    } finally {
      setLoadingCharacterId(null)
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="party-roster-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />
          <h2 id="party-roster-heading" className="font-semibold text-card-foreground">Characters at the table</h2>
        </div>
        <p className="text-xs text-muted-foreground">{isDungeonMaster ? 'Select an icon to inspect that character.' : 'Your DM can inspect character sheets.'}</p>
      </div>

      {status === 'loading' ? (
        <div className="mt-4 flex gap-3">{[0, 1, 2].map((index) => <div key={index} className="size-14 animate-pulse rounded-full bg-muted" />)}</div>
      ) : links.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No characters are linked to this party yet. Link one from the Characters page.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {links.map((link) => {
            const character = link.data
            const atTable = attendeeUserIds.has(character.ownerId)
            const name = character.characterName?.trim() || 'Adventurer'
            const initial = name.slice(0, 1).toUpperCase() || '?'
            const content = (
              <>
                <span className={`relative flex size-12 items-center justify-center rounded-full border-2 text-sm font-bold ${atTable ? 'border-success bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground'}`}>
                  {initial}
                  <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${atTable ? 'bg-success' : 'bg-muted-foreground'}`} aria-label={atTable ? 'At the table' : 'Away from the table'} />
                </span>
                <span className="max-w-20 truncate text-xs font-medium text-foreground">{name}</span>
                <span className="text-[11px] text-muted-foreground">{atTable ? 'At table' : 'Away'}</span>
              </>
            )

            return isDungeonMaster ? (
              <button
                key={link.recordId}
                type="button"
                className="flex w-20 flex-col items-center gap-1 rounded-lg p-1 text-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => showCharacterDetails(character.characterId)}
                disabled={loadingCharacterId !== null}
                aria-label={`View ${name}'s character details`}
              >
                {loadingCharacterId === character.characterId ? <LoaderCircle className="size-7 animate-spin text-primary" aria-label="Loading character details" /> : content}
              </button>
            ) : (
              <div key={link.recordId} className="flex w-20 flex-col items-center gap-1 p-1 text-center">{content}</div>
            )
          })}
        </div>
      )}

      <Modal open={details !== null} onClose={() => setDetails(null)} size="md">
        <Modal.Header>
          <Modal.Title>{details?.name ?? 'Character details'}</Modal.Title>
          <Modal.Description>Visible only to the party’s Dungeon Master.</Modal.Description>
        </Modal.Header>
        {details && (
          <Modal.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Class & ancestry</p>
                <p className="mt-1 text-sm text-foreground">{[details.ancestry, details.className].filter(Boolean).join(' · ') || 'Adventurer'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level & experience</p>
                <p className="mt-1 text-sm text-foreground">Level {details.level} · {details.experience.toLocaleString()} XP</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hit points</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-foreground"><Heart className="size-4 text-destructive" aria-hidden /> {details.hitPoints.current ?? 0} / {details.hitPoints.maximum ?? 0} HP {details.hitPoints.temporary ? `(+${details.hitPoints.temporary} temp)` : ''}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ability scores</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Object.entries(details.abilityScores).map(([ability, score]) => <span key={ability} className="rounded-md bg-muted px-2 py-1 text-center text-xs text-foreground">{ability.slice(0, 3).toUpperCase()} {score}</span>)}
                </div>
              </div>
              {details.background && <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Background</p><p className="mt-1 text-sm text-foreground">{details.background}</p></div>}
              {details.notes && <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{details.notes}</p></div>}
            </div>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline" onClick={() => setDetails(null)}><Eye aria-hidden /> Close details</Button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
