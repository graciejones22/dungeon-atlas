import { type FormEvent, useState } from 'react'
import { BookOpen, Eye, Heart, Link2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { getAuthToken, useMutations, useQuery } from 'deepspace'
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui'

const abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const
type AbilityName = (typeof abilityNames)[number]

interface AbilityScores {
  Strength: number
  Dexterity: number
  Constitution: number
  Intelligence: number
  Wisdom: number
  Charisma: number
}

interface HitPoints {
  current: number
  maximum: number
  temporary: number
}

interface CharacterInput {
  name: string
  ancestry: string
  className: string
  background: string
  level: number
  experience: number
  abilityScores: AbilityScores
  hitPoints: HitPoints
  notes: string
}

interface Character extends CharacterInput {
  ownerId: string
}

interface Party {
  partyId: string
  name: string
}

interface PartyCharacter {
  partyId: string
  characterId: string
}

interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

const emptyCharacter = (): CharacterInput => ({
  name: '',
  ancestry: '',
  className: '',
  background: '',
  level: 1,
  experience: 0,
  abilityScores: {
    Strength: 10,
    Dexterity: 10,
    Constitution: 10,
    Intelligence: 10,
    Wisdom: 10,
    Charisma: 10,
  },
  hitPoints: { current: 10, maximum: 10, temporary: 0 },
  notes: '',
})

function modifier(score: number): string {
  const value = Math.floor((score - 10) / 2)
  return value >= 0 ? `+${value}` : String(value)
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function callPartyAction<T>(name: 'linkCharacterToParty' | 'unlinkCharacterFromParty', params: Record<string, string>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in before linking a character.')

  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const result = (await response.json()) as ActionResponse<T>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'The character link could not be updated.')
  }
  return result.data
}

export default function CharactersPage() {
  const { records: characters, status, error: queryError } = useQuery<Character>('characters', {
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })
  const { records: parties } = useQuery<Party>('parties', { orderBy: 'name', orderDir: 'asc' })
  const { records: partyCharacters } = useQuery<PartyCharacter>('party_characters')
  const { ready, createConfirmed, putConfirmed, removeConfirmed } = useMutations<CharacterInput>('characters')
  const { success, error } = useToast()
  const [draft, setDraft] = useState<CharacterInput>(emptyCharacter)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedPartyByCharacter, setSelectedPartyByCharacter] = useState<Record<string, string>>({})
  const [linkingCharacterId, setLinkingCharacterId] = useState<string | null>(null)
  const [viewingCharacter, setViewingCharacter] = useState<{ recordId: string; sheet: Character } | null>(null)

  function startNewCharacter() {
    setEditingId(null)
    setDraft(emptyCharacter())
  }

  function startEditing(character: Character, recordId: string) {
    setEditingId(recordId)
    setDraft({
      name: character.name,
      ancestry: character.ancestry,
      className: character.className,
      background: character.background,
      level: character.level,
      experience: character.experience,
      abilityScores: character.abilityScores,
      hitPoints: character.hitPoints,
      notes: character.notes,
    })
  }

  async function saveCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || !draft.name.trim()) return

    setSaving(true)
    const character = { ...draft, name: draft.name.trim() }
    try {
      if (editingId) {
        await putConfirmed(editingId, character)
        success('Character updated', `${character.name} is ready for the next session.`)
      } else {
        await createConfirmed(character)
        success('Character created', `${character.name} has joined your roster.`)
      }
      startNewCharacter()
    } catch (caught) {
      error('Could not save character', caught instanceof Error ? caught.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function deleteCharacter(recordId: string, name: string) {
    if (!ready) return
    try {
      await removeConfirmed(recordId)
      if (editingId === recordId) startNewCharacter()
      if (viewingCharacter?.recordId === recordId) setViewingCharacter(null)
      success('Character deleted', `${name} was removed from your roster.`)
    } catch (caught) {
      error('Could not delete character', caught instanceof Error ? caught.message : undefined)
    }
  }

  async function linkCharacter(recordId: string, name: string) {
    const partyId = selectedPartyByCharacter[recordId]
    if (!partyId) return
    setLinkingCharacterId(recordId)
    try {
      await callPartyAction('linkCharacterToParty', { partyId, characterId: recordId })
      setSelectedPartyByCharacter((selected) => ({ ...selected, [recordId]: '' }))
      const party = parties.find((item) => item.data.partyId === partyId)
      success('Character linked', `${name} is now part of ${party?.data.name ?? 'the party'}.`)
    } catch (caught) {
      error('Could not link character', caught instanceof Error ? caught.message : undefined)
    } finally {
      setLinkingCharacterId(null)
    }
  }

  async function unlinkCharacter(recordId: string, partyId: string, name: string) {
    setLinkingCharacterId(recordId)
    try {
      await callPartyAction('unlinkCharacterFromParty', { partyId, characterId: recordId })
      const party = parties.find((item) => item.data.partyId === partyId)
      success('Character unlinked', `${name} is no longer linked to ${party?.data.name ?? 'that party'}.`)
    } catch (caught) {
      error('Could not unlink character', caught instanceof Error ? caught.message : undefined)
    } finally {
      setLinkingCharacterId(null)
    }
  }

  function updateAbility(ability: AbilityName, value: string) {
    setDraft((character) => ({
      ...character,
      abilityScores: { ...character.abilityScores, [ability]: numericValue(value, 10) },
    }))
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">Character roster</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Your characters</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Character sheets are private to you. Choose one to edit before bringing it to a party board.</p>
        </div>
        <Button onClick={startNewCharacter} variant="outline"><Plus aria-hidden /> New character</Button>
      </header>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section aria-labelledby="character-list-heading">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="size-5 text-primary" aria-hidden />
            <h2 id="character-list-heading" className="text-lg font-semibold text-foreground">Roster</h2>
          </div>

          {status === 'loading' ? (
            <div className="grid gap-4">
              {[0, 1].map((index) => <div key={index} className="h-44 animate-pulse rounded-xl border border-border bg-card" />)}
            </div>
          ) : status === 'error' ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{queryError ?? 'Could not load your characters.'}</p>
          ) : characters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <BookOpen className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-medium text-foreground">No characters yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first adventurer using the sheet beside this roster.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {characters.map((character) => {
                const sheet = character.data
                const characterLinks = partyCharacters.filter((link) => link.data.characterId === character.recordId)
                const linkedPartyIds = new Set(characterLinks.map((link) => link.data.partyId))
                const availableParties = parties.filter((party) => !linkedPartyIds.has(party.data.partyId))
                return (
                  <article key={character.recordId} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-card-foreground">{sheet.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{[sheet.ancestry, sheet.className].filter(Boolean).join(' · ') || 'Adventurer'}</p>
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">Level {sheet.level}</span>
                    </div>
                    <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                      <Heart className="size-4 text-destructive" aria-hidden />
                      {sheet.hitPoints.current} / {sheet.hitPoints.maximum} HP
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Linked parties</p>
                      {characterLinks.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">Not linked to a party yet.</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {characterLinks.map((link) => {
                            const party = parties.find((item) => item.data.partyId === link.data.partyId)
                            if (!party) return null
                            return (
                              <span key={link.recordId} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                                {party.data.name}
                                <button
                                  type="button"
                                  aria-label={`Unlink ${sheet.name} from ${party.data.name}`}
                                  className="rounded-sm hover:text-destructive"
                                  onClick={() => unlinkCharacter(character.recordId, party.data.partyId, sheet.name)}
                                  disabled={linkingCharacterId === character.recordId}
                                >
                                  <X className="size-3" aria-hidden />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {availableParties.length > 0 && (
                        <div className="mt-3 flex gap-2">
                          <select
                            aria-label={`Link ${sheet.name} to a party`}
                            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
                            value={selectedPartyByCharacter[character.recordId] ?? ''}
                            onChange={(event) => setSelectedPartyByCharacter((selected) => ({ ...selected, [character.recordId]: event.target.value }))}
                            disabled={linkingCharacterId === character.recordId}
                          >
                            <option value="">Choose a party</option>
                            {availableParties.map((party) => <option key={party.recordId} value={party.data.partyId}>{party.data.name}</option>)}
                          </select>
                          <Button size="sm" variant="outline" onClick={() => linkCharacter(character.recordId, sheet.name)} disabled={!selectedPartyByCharacter[character.recordId] || linkingCharacterId === character.recordId} loading={linkingCharacterId === character.recordId}>
                            <Link2 aria-hidden /> Link
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewingCharacter({ recordId: character.recordId, sheet })}>
                        <Eye aria-hidden /> View sheet
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEditing(sheet, character.recordId)}><Pencil aria-hidden /> Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteCharacter(character.recordId, sheet.name)} disabled={!ready}>
                        <Trash2 aria-hidden /> Delete
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="character-editor-heading" className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="character-editor-heading" className="text-lg font-semibold text-card-foreground">{editingId ? 'Edit character' : 'New character'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">The essentials for your first DungeonAtlas sheet.</p>
            </div>
            {editingId && <Button size="icon" variant="ghost" onClick={startNewCharacter} aria-label="Cancel editing"><X aria-hidden /></Button>}
          </div>

          <form onSubmit={saveCharacter} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Character name
                <Input value={draft.name} onChange={(event) => setDraft((character) => ({ ...character, name: event.target.value }))} required maxLength={80} placeholder="Ari Emberfall" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Ancestry
                <Input value={draft.ancestry} onChange={(event) => setDraft((character) => ({ ...character, ancestry: event.target.value }))} maxLength={80} placeholder="Elf" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Class
                <Input value={draft.className} onChange={(event) => setDraft((character) => ({ ...character, className: event.target.value }))} maxLength={80} placeholder="Ranger" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2">
                Background
                <Input value={draft.background} onChange={(event) => setDraft((character) => ({ ...character, background: event.target.value }))} maxLength={120} placeholder="Outlander" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Level
                <Input type="number" min="1" max="20" value={draft.level} onChange={(event) => setDraft((character) => ({ ...character, level: numericValue(event.target.value, 1) }))} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Experience
                <Input type="number" min="0" value={draft.experience} onChange={(event) => setDraft((character) => ({ ...character, experience: numericValue(event.target.value, 0) }))} />
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Ability scores</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {abilityNames.map((ability) => (
                  <label key={ability} className="grid gap-1 rounded-lg border border-border p-2 text-center text-xs font-medium text-muted-foreground">
                    {ability.slice(0, 3).toUpperCase()}
                    <Input type="number" min="1" max="30" className="h-8 px-2 text-center" value={draft.abilityScores[ability]} onChange={(event) => updateAbility(ability, event.target.value)} />
                    <span className="text-foreground">{modifier(draft.abilityScores[ability])}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Hit points</legend>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {(['current', 'maximum', 'temporary'] as const).map((field) => (
                  <label key={field} className="grid gap-2 text-sm font-medium capitalize text-muted-foreground">
                    {field === 'temporary' ? 'Temp' : field}
                    <Input type="number" min="0" value={draft.hitPoints[field]} onChange={(event) => setDraft((character) => ({ ...character, hitPoints: { ...character.hitPoints, [field]: numericValue(event.target.value, 0) } }))} />
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              Notes
              <Textarea value={draft.notes} onChange={(event) => setDraft((character) => ({ ...character, notes: event.target.value }))} maxLength={3000} rows={4} placeholder="Personality, gear, story hooks…" />
            </label>

            <Button type="submit" className="w-full" loading={saving} disabled={!ready || !draft.name.trim()}>
              <Save aria-hidden /> {editingId ? 'Save changes' : 'Create character'}
            </Button>
          </form>
        </section>
      </div>

      <Modal open={viewingCharacter !== null} onClose={() => setViewingCharacter(null)} size="md">
        <Modal.Header>
          <Modal.Title>{viewingCharacter?.sheet.name ?? 'Character sheet'}</Modal.Title>
          <Modal.Description>Your private character sheet.</Modal.Description>
        </Modal.Header>
        {viewingCharacter && (
          <Modal.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Class & ancestry</p>
                <p className="mt-1 text-sm text-foreground">{[viewingCharacter.sheet.ancestry, viewingCharacter.sheet.className].filter(Boolean).join(' · ') || 'Adventurer'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level & experience</p>
                <p className="mt-1 text-sm text-foreground">Level {viewingCharacter.sheet.level} · {viewingCharacter.sheet.experience.toLocaleString()} XP</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hit points</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-foreground">
                  <Heart className="size-4 text-destructive" aria-hidden />
                  {viewingCharacter.sheet.hitPoints.current} / {viewingCharacter.sheet.hitPoints.maximum} HP
                  {viewingCharacter.sheet.hitPoints.temporary ? ` (+${viewingCharacter.sheet.hitPoints.temporary} temp)` : ''}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ability scores</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {abilityNames.map((ability) => (
                    <span key={ability} className="rounded-md bg-muted px-2 py-1 text-center text-xs text-foreground">
                      {ability.slice(0, 3).toUpperCase()} {viewingCharacter.sheet.abilityScores[ability]}
                    </span>
                  ))}
                </div>
              </div>
              {viewingCharacter.sheet.background && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Background</p>
                  <p className="mt-1 text-sm text-foreground">{viewingCharacter.sheet.background}</p>
                </div>
              )}
              {viewingCharacter.sheet.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{viewingCharacter.sheet.notes}</p>
                </div>
              )}
            </div>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline" onClick={() => setViewingCharacter(null)}><Eye aria-hidden /> Close sheet</Button>
        </Modal.Footer>
      </Modal>
    </main>
  )
}
