import { type FormEvent, useState } from 'react'
import { BookOpen, Heart, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useMutations, useQuery } from 'deepspace'
import { Button, Input, Textarea, useToast } from '@/components/ui'

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

export default function CharactersPage() {
  const { records: characters, status, error: queryError } = useQuery<Character>('characters', {
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })
  const { ready, createConfirmed, putConfirmed, removeConfirmed } = useMutations<CharacterInput>('characters')
  const { success, error } = useToast()
  const [draft, setDraft] = useState<CharacterInput>(emptyCharacter)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
      success('Character deleted', `${name} was removed from your roster.`)
    } catch (caught) {
      error('Could not delete character', caught instanceof Error ? caught.message : undefined)
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              {characters.map((character) => {
                const sheet = character.data
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
                    <div className="mt-5 flex gap-2">
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
    </main>
  )
}
