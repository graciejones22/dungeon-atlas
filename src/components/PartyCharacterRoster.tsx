import { type FormEvent, useState } from 'react'
import { Eye, Heart, LoaderCircle, Save, Users } from 'lucide-react'
import { getAuthToken, useQuery } from 'deepspace'
import { Button, Input, Modal, useToast } from '@/components/ui'

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

interface InspectedCharacter {
  characterId: string
  canEditHitPoints: boolean
  details: CharacterDetails
}

interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function callPartyAction<T>(
  action: 'getPartyCharacterDetails' | 'updatePartyCharacterHitPoints',
  params: Record<string, string | number>,
): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in to manage character details.')

  const response = await fetch(`/api/actions/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const result = (await response.json()) as ActionResponse<T>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'Character details could not be loaded.')
  }
  return result.data
}

export function PartyCharacterRoster({
  partyId,
  isDungeonMaster,
  currentUserId,
  attendeeUserIds,
}: {
  partyId: string
  isDungeonMaster: boolean
  currentUserId: string
  attendeeUserIds: Set<string>
}) {
  const { records: links, status } = useQuery<PartyCharacter>('party_characters', {
    where: { partyId },
    orderBy: 'createdAt',
    orderDir: 'asc',
  })
  const { error } = useToast()
  const [inspectedCharacter, setInspectedCharacter] = useState<InspectedCharacter | null>(null)
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(null)
  const [currentHitPoints, setCurrentHitPoints] = useState<number | ''>(0)
  const [savingHitPoints, setSavingHitPoints] = useState(false)

  async function showCharacterDetails(characterId: string, ownerId: string) {
    const canEditHitPoints = isDungeonMaster || ownerId === currentUserId
    if (!canEditHitPoints) return
    setLoadingCharacterId(characterId)
    try {
      const details = await callPartyAction<CharacterDetails>('getPartyCharacterDetails', { partyId, characterId })
      setInspectedCharacter({ characterId, canEditHitPoints, details })
      setCurrentHitPoints(details.hitPoints.current ?? 0)
    } catch (caught) {
      error('Could not load character details', caught instanceof Error ? caught.message : undefined)
    } finally {
      setLoadingCharacterId(null)
    }
  }

  async function saveHitPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inspectedCharacter || !inspectedCharacter.canEditHitPoints || savingHitPoints) return
    if (typeof currentHitPoints !== 'number' || !Number.isInteger(currentHitPoints) || currentHitPoints < 0 || currentHitPoints > 100_000) return

    setSavingHitPoints(true)
    try {
      const result = await callPartyAction<{ hitPoints: CharacterDetails['hitPoints'] }>('updatePartyCharacterHitPoints', {
        partyId,
        characterId: inspectedCharacter.characterId,
        current: currentHitPoints,
      })
      setInspectedCharacter((character) => character ? {
        ...character,
        details: { ...character.details, hitPoints: result.hitPoints },
      } : null)
    } catch (caught) {
      error('Could not update hit points', caught instanceof Error ? caught.message : undefined)
    } finally {
      setSavingHitPoints(false)
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="party-roster-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />
          <h2 id="party-roster-heading" className="font-semibold text-card-foreground">Characters at the table</h2>
        </div>
        <p className="text-xs text-muted-foreground">{isDungeonMaster ? 'Select an icon to inspect and update a character.' : 'Select your character to inspect and update its HP.'}</p>
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
            const canInspect = isDungeonMaster || character.ownerId === currentUserId
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

            return canInspect ? (
              <button
                key={link.recordId}
                type="button"
                className="flex w-20 flex-col items-center gap-1 rounded-lg p-1 text-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => showCharacterDetails(character.characterId, character.ownerId)}
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

      <Modal open={inspectedCharacter !== null} onClose={() => setInspectedCharacter(null)} size="md">
        <Modal.Header>
          <Modal.Title>{inspectedCharacter?.details.name ?? 'Character details'}</Modal.Title>
          <Modal.Description>{isDungeonMaster ? 'Dungeon Master view — you can update current HP.' : 'Your character sheet — you can update current HP.'}</Modal.Description>
        </Modal.Header>
        {inspectedCharacter && (
          <Modal.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Class & ancestry</p>
                <p className="mt-1 text-sm text-foreground">{[inspectedCharacter.details.ancestry, inspectedCharacter.details.className].filter(Boolean).join(' · ') || 'Adventurer'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level & experience</p>
                <p className="mt-1 text-sm text-foreground">Level {inspectedCharacter.details.level} · {inspectedCharacter.details.experience.toLocaleString()} XP</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hit points</p>
                <form onSubmit={saveHitPoints} className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-sm font-medium text-foreground">
                    <span className="sr-only">Current HP</span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground"><Heart className="size-4 text-destructive" aria-hidden /> Current HP</span>
                    <Input
                      aria-label="Current HP"
                      type="number"
                      min="0"
                      max="100000"
                      value={currentHitPoints}
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber
                        setCurrentHitPoints(Number.isNaN(value) ? '' : value)
                      }}
                      className="w-28"
                    />
                  </label>
                  <p className="pb-2 text-sm text-muted-foreground">/ {inspectedCharacter.details.hitPoints.maximum ?? 0} HP {inspectedCharacter.details.hitPoints.temporary ? `(+${inspectedCharacter.details.hitPoints.temporary} temp)` : ''}</p>
                  <Button type="submit" size="sm" loading={savingHitPoints} disabled={typeof currentHitPoints !== 'number' || !Number.isInteger(currentHitPoints) || currentHitPoints < 0 || currentHitPoints > 100_000}>
                    <Save aria-hidden /> Save HP
                  </Button>
                </form>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ability scores</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Object.entries(inspectedCharacter.details.abilityScores).map(([ability, score]) => <span key={ability} className="rounded-md bg-muted px-2 py-1 text-center text-xs text-foreground">{ability.slice(0, 3).toUpperCase()} {score}</span>)}
                </div>
              </div>
              {inspectedCharacter.details.background && <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Background</p><p className="mt-1 text-sm text-foreground">{inspectedCharacter.details.background}</p></div>}
              {inspectedCharacter.details.notes && <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{inspectedCharacter.details.notes}</p></div>}
            </div>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline" onClick={() => setInspectedCharacter(null)}><Eye aria-hidden /> Close details</Button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
