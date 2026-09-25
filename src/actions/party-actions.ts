import { mintUlid, timingSafeEqualStrings, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  activeDungeonMasterCount,
  getActivePartyMembership,
  requireDungeonMaster,
  type PartyMembership,
  type PartyRole,
} from './party-permissions'

// Cloudflare Workers' WebCrypto currently caps PBKDF2 at 100,000 iterations.
// Keep this at the platform maximum so production party creation succeeds.
const PASSWORD_ITERATIONS = 100_000
const PASSWORD_BYTES = 32
const PARTY_CODE_BYTES = 8
const PASSWORD_SALT_BYTES = 16
const BOARD_WIDTH = 1200
const BOARD_HEIGHT = 720
const TOKEN_SIZE = 48
const CHARACTER_TOKEN_COLORS = ['#4f46e5', '#0891b2', '#059669', '#c2410c', '#9333ea', '#be123c']

interface PartyRecord extends Record<string, unknown> {
  partyId: string
  joinCode: string
}

interface PartySecretRecord extends Record<string, unknown> {
  passwordSalt: string
  passwordHash: string
}

interface CharacterOwnershipRecord extends Record<string, unknown> {
  ownerId: string
  name: string
  ancestry?: string
  className?: string
  background?: string
  level?: number
  experience?: number
  abilityScores?: unknown
  hitPoints?: unknown
  notes?: string
}

interface PartyCharacterRecord extends Record<string, unknown> {
  partyId: string
  characterId: string
  ownerId: string
  characterName?: string
}

interface PartyCharacterTokenRecord extends Record<string, unknown> {
  partyId: string
  characterId: string
  ownerId: string
}

interface PartyEnemyDetailsRecord extends Record<string, unknown> {
  partyId: string
  shapeId: string
  name: string
  hitPoints: number
  notes?: string
}

function requiredText(value: unknown, minLength: number, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length < minLength || text.length > maxLength) return null
  return text
}

function boardCoordinate(value: unknown, maximum: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) return null
  return Math.round(value)
}

function hitPointsFrom(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100_000) return null
  return value
}

function colorForCharacter(characterId: string): string {
  let value = 0
  for (const character of characterId) value = (value * 31 + character.charCodeAt(0)) >>> 0
  return CHARACTER_TOKEN_COLORS[value % CHARACTER_TOKEN_COLORS.length]
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes.buffer as ArrayBuffer
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(salt),
      iterations: PASSWORD_ITERATIONS,
    },
    passwordKey,
    PASSWORD_BYTES * 8,
  )
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function removePartyArtifacts(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  partyId: string,
): Promise<void> {
  await tools.remove('party_secrets', partyId)
  await tools.remove('parties', partyId)
}

async function removePartyScopedRecords(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  collection: string,
  where: Record<string, string>,
): Promise<{ success: true } | { success: false; error: string }> {
  const records = await tools.query<Record<string, unknown>>(collection, { where, limit: 500 })
  if (!records.success) return { success: false, error: records.error ?? `Could not read ${collection}.` }

  for (const record of records.data.records) {
    const remove = await tools.remove(collection, record.recordId)
    if (!remove.success) return { success: false, error: remove.error ?? `Could not remove ${collection}.` }
  }
  return { success: true }
}

export const createParty: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const name = requiredText(params.name, 1, 80)
  const password = requiredText(params.password, 8, 128)
  if (!name) return { success: false, error: 'Party name must be between 1 and 80 characters.' }
  if (!password) return { success: false, error: 'Password must be between 8 and 128 characters.' }

  const partyId = mintUlid()
  const joinCode = randomHex(PARTY_CODE_BYTES)
  const passwordSalt = randomHex(PASSWORD_SALT_BYTES)
  const passwordHash = await hashPassword(password, passwordSalt)

  const party = await tools.create('parties', { partyId, ownerId: userId, name, joinCode }, partyId)
  if (!party.success) return party

  const secret = await tools.create('party_secrets', { partyId, passwordSalt, passwordHash }, partyId)
  if (!secret.success) {
    await tools.remove('parties', partyId)
    return secret
  }

  const membership = await tools.create('team_members', {
    teamId: partyId,
    userId,
    role: 'dm',
    status: 'active',
  })
  if (!membership.success) {
    await removePartyArtifacts(tools, partyId)
    return membership
  }

  return { success: true, data: { partyId, joinCode, role: 'dm' } }
}

export const joinParty: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const joinCode = requiredText(params.joinCode, PARTY_CODE_BYTES * 2, PARTY_CODE_BYTES * 2)
  const password = requiredText(params.password, 8, 128)
  if (!joinCode || !password) return { success: false, error: 'Invalid party code or password.' }

  const parties = await tools.query<PartyRecord>('parties', { where: { joinCode: joinCode.toLowerCase() }, limit: 1 })
  if (!parties.success) return parties
  const party = parties.data.records[0]
  if (!party) return { success: false, error: 'Invalid party code or password.' }

  const secret = await tools.get<PartySecretRecord>('party_secrets', party.recordId)
  if (!secret.success) return { success: false, error: 'Invalid party code or password.' }

  const attemptedHash = await hashPassword(password, secret.data.record.data.passwordSalt)
  if (!(await timingSafeEqualStrings(attemptedHash, secret.data.record.data.passwordHash))) {
    return { success: false, error: 'Invalid party code or password.' }
  }

  const existingMembership = await getActivePartyMembership(tools, party.data.partyId, userId)
  if (existingMembership.found) {
    return { success: true, data: { partyId: party.data.partyId, joined: false } }
  }

  const priorMemberships = await tools.query<PartyMembership>('team_members', {
    where: { teamId: party.data.partyId, userId },
    limit: 1,
  })
  if (!priorMemberships.success) return priorMemberships
  const priorMembership = priorMemberships.data.records[0]
  if (priorMembership) {
    const rejoin = await tools.update('team_members', priorMembership.recordId, {
      role: 'player',
      status: 'active',
    })
    if (!rejoin.success) return rejoin
    return { success: true, data: { partyId: party.data.partyId, joined: true } }
  }

  const membership = await tools.create('team_members', {
    teamId: party.data.partyId,
    userId,
    role: 'player',
    status: 'active',
  })
  if (!membership.success) return membership

  return { success: true, data: { partyId: party.data.partyId, joined: true } }
}

export const deleteParty: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  if (!partyId) return { success: false, error: 'Invalid party deletion request.' }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  // Delete party-scoped collaboration data, never the private characters that
  // party members own independently. The Canvas Durable Object becomes
  // unreachable once the party record and memberships are removed.
  for (const [collection, where] of [
    ['party_enemy_details', { partyId }],
    ['party_character_tokens', { partyId }],
    ['party_characters', { partyId }],
    ['team_members', { teamId: partyId }],
  ] as const) {
    const remove = await removePartyScopedRecords(tools, collection, where)
    if (!remove.success) return remove
  }

  const secret = await tools.remove('party_secrets', partyId)
  if (!secret.success) return secret
  const party = await tools.remove('parties', partyId)
  if (!party.success) return party
  return { success: true, data: { partyId, deleted: true } }
}

function partyIdFrom(params: Record<string, unknown>): string | null {
  return requiredText(params.partyId, 1, 64)
}

function userIdFrom(params: Record<string, unknown>): string | null {
  return requiredText(params.userId, 1, 128)
}

function roleFrom(params: Record<string, unknown>): PartyRole | null {
  return params.role === 'dm' || params.role === 'player' ? params.role : null
}

export const setPartyMemberRole: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const memberUserId = userIdFrom(params)
  const role = roleFrom(params)
  if (!partyId || !memberUserId || !role) return { success: false, error: 'Invalid party role request.' }

  const actor = await requireDungeonMaster(tools, partyId, userId)
  if (!actor.found) return { success: false, error: actor.error }

  const target = await getActivePartyMembership(tools, partyId, memberUserId)
  if (!target.found) return { success: false, error: target.error }
  if (target.membership.data.role === role) return { success: true, data: { partyId, userId: memberUserId, role } }

  if (target.membership.data.role === 'dm' && role === 'player') {
    const dungeonMasterCount = await activeDungeonMasterCount(tools, partyId)
    if (dungeonMasterCount === null) return { success: false, error: 'Could not verify party roles.' }
    if (dungeonMasterCount <= 1) {
      return { success: false, error: 'A party must always have at least one Dungeon Master.' }
    }
  }

  const update = await tools.update('team_members', target.membership.recordId, { role })
  if (!update.success) return update
  return { success: true, data: { partyId, userId: memberUserId, role } }
}

export const removePartyMember: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const memberUserId = userIdFrom(params)
  if (!partyId || !memberUserId) return { success: false, error: 'Invalid party member request.' }

  const actor = await requireDungeonMaster(tools, partyId, userId)
  if (!actor.found) return { success: false, error: actor.error }

  const target = await getActivePartyMembership(tools, partyId, memberUserId)
  if (!target.found) return { success: false, error: target.error }
  if (target.membership.data.role === 'dm') {
    const dungeonMasterCount = await activeDungeonMasterCount(tools, partyId)
    if (dungeonMasterCount === null) return { success: false, error: 'Could not verify party roles.' }
    if (dungeonMasterCount <= 1) {
      return { success: false, error: 'A party must always have at least one Dungeon Master.' }
    }
  }

  const update = await tools.update('team_members', target.membership.recordId, { status: 'removed' })
  if (!update.success) return update

  const tokens = await tools.query<PartyCharacterTokenRecord>('party_character_tokens', {
    where: { partyId, ownerId: memberUserId },
  })
  if (tokens.success) {
    await Promise.all(tokens.data.records.map((token) => tools.remove('party_character_tokens', token.recordId)))
  }
  return { success: true, data: { partyId, userId: memberUserId, status: 'removed' } }
}

async function requireOwnedCharacter(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  characterId: string,
  userId: string,
) {
  const character = await tools.get<CharacterOwnershipRecord>('characters', characterId)
  if (!character.success) return { found: false as const, error: 'Character not found.' }
  if (character.data.record.data.ownerId !== userId) {
    return { found: false as const, error: 'You can only link your own characters.' }
  }
  return { found: true as const, character: character.data.record.data }
}

export const linkCharacterToParty: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const characterId = requiredText(params.characterId, 1, 128)
  if (!partyId || !characterId) return { success: false, error: 'Invalid character link request.' }

  const membership = await getActivePartyMembership(tools, partyId, userId)
  if (!membership.found) return { success: false, error: membership.error }
  const character = await requireOwnedCharacter(tools, characterId, userId)
  if (!character.found) return { success: false, error: character.error }

  const existingLinks = await tools.query<PartyCharacterRecord>('party_characters', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!existingLinks.success) return existingLinks
  if (existingLinks.data.records.length > 0) return { success: true, data: { partyId, characterId, linked: false } }

  const link = await tools.create('party_characters', {
    partyId,
    characterId,
    characterName: character.character.name,
    ownerId: userId,
  })
  if (!link.success) return link
  return { success: true, data: { partyId, characterId, linked: true } }
}

export const unlinkCharacterFromParty: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const characterId = requiredText(params.characterId, 1, 128)
  if (!partyId || !characterId) return { success: false, error: 'Invalid character link request.' }

  const membership = await getActivePartyMembership(tools, partyId, userId)
  if (!membership.found) return { success: false, error: membership.error }
  const character = await requireOwnedCharacter(tools, characterId, userId)
  if (!character.found) return { success: false, error: character.error }

  const links = await tools.query<PartyCharacterRecord>('party_characters', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!links.success) return links
  const link = links.data.records[0]
  if (!link) return { success: true, data: { partyId, characterId, linked: false } }

  const remove = await tools.remove('party_characters', link.recordId)
  if (!remove.success) return remove
  const tokens = await tools.query<PartyCharacterTokenRecord>('party_character_tokens', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (tokens.success && tokens.data.records[0]) {
    await tools.remove('party_character_tokens', tokens.data.records[0].recordId)
  }
  return { success: true, data: { partyId, characterId, linked: false } }
}

export const placePartyCharacterToken: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const characterId = requiredText(params.characterId, 1, 128)
  const x = boardCoordinate(params.x, BOARD_WIDTH - TOKEN_SIZE)
  const y = boardCoordinate(params.y, BOARD_HEIGHT - TOKEN_SIZE)
  if (!partyId || !characterId || x === null || y === null) {
    return { success: false, error: 'Invalid character token placement.' }
  }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  const links = await tools.query<PartyCharacterRecord>('party_characters', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!links.success) return links
  const link = links.data.records[0]
  if (!link) return { success: false, error: 'Link this character to the party before placing their token.' }

  const existing = await tools.query<PartyCharacterTokenRecord>('party_character_tokens', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!existing.success) return existing
  const token = existing.data.records[0]
  if (token) {
    const update = await tools.update('party_character_tokens', token.recordId, { x, y })
    if (!update.success) return update
    return { success: true, data: { partyId, characterId, placed: false } }
  }

  const characterName = link.data.characterName?.trim() || 'Adventurer'
  const create = await tools.create('party_character_tokens', {
    partyId,
    characterId,
    characterName,
    ownerId: link.data.ownerId,
    x,
    y,
    color: colorForCharacter(characterId),
    label: characterName.slice(0, 2).toUpperCase() || '?',
  })
  if (!create.success) return create
  return { success: true, data: { partyId, characterId, placed: true } }
}

export const movePartyCharacterToken: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const characterId = requiredText(params.characterId, 1, 128)
  const x = boardCoordinate(params.x, BOARD_WIDTH - TOKEN_SIZE)
  const y = boardCoordinate(params.y, BOARD_HEIGHT - TOKEN_SIZE)
  if (!partyId || !characterId || x === null || y === null) {
    return { success: false, error: 'Invalid character token movement.' }
  }

  const membership = await getActivePartyMembership(tools, partyId, userId)
  if (!membership.found) return { success: false, error: membership.error }

  const tokens = await tools.query<PartyCharacterTokenRecord>('party_character_tokens', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!tokens.success) return tokens
  const token = tokens.data.records[0]
  if (!token) return { success: false, error: 'That character is not placed on this board.' }
  if (membership.membership.data.role !== 'dm' && token.data.ownerId !== userId) {
    return { success: false, error: 'You can only move your own character token.' }
  }

  const update = await tools.update('party_character_tokens', token.recordId, { x, y })
  if (!update.success) return update
  return { success: true, data: { partyId, characterId, x, y } }
}

export const removePartyCharacterToken: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const characterId = requiredText(params.characterId, 1, 128)
  if (!partyId || !characterId) return { success: false, error: 'Invalid character token request.' }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  const tokens = await tools.query<PartyCharacterTokenRecord>('party_character_tokens', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!tokens.success) return tokens
  const token = tokens.data.records[0]
  if (!token) return { success: true, data: { partyId, characterId, removed: false } }

  const remove = await tools.remove('party_character_tokens', token.recordId)
  if (!remove.success) return remove
  return { success: true, data: { partyId, characterId, removed: true } }
}

export const createPartyEnemyDetails: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const shapeId = requiredText(params.shapeId, 1, 128)
  const name = requiredText(params.name, 1, 80)
  const hitPoints = hitPointsFrom(params.hitPoints)
  const notes = requiredText(params.notes ?? '', 0, 2_000)
  if (!partyId || !shapeId || !name || hitPoints === null || notes === null) {
    return { success: false, error: 'Invalid enemy details.' }
  }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  const existing = await tools.query<PartyEnemyDetailsRecord>('party_enemy_details', {
    where: { partyId, shapeId },
    limit: 1,
  })
  if (!existing.success) return existing
  const current = existing.data.records[0]
  if (current) {
    const update = await tools.update('party_enemy_details', current.recordId, { name, hitPoints, notes })
    if (!update.success) return update
  } else {
    const create = await tools.create('party_enemy_details', { partyId, shapeId, name, hitPoints, notes })
    if (!create.success) return create
  }
  return { success: true, data: { partyId, shapeId, name, hitPoints, notes } }
}

export const getPartyEnemyDetails: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const shapeId = requiredText(params.shapeId, 1, 128)
  if (!partyId || !shapeId) return { success: false, error: 'Invalid enemy details request.' }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  const details = await tools.query<PartyEnemyDetailsRecord>('party_enemy_details', {
    where: { partyId, shapeId },
    limit: 1,
  })
  if (!details.success) return details
  const enemy = details.data.records[0]
  if (!enemy) return { success: false, error: 'No private details were saved for this enemy.' }
  return {
    success: true,
    data: {
      name: enemy.data.name,
      hitPoints: enemy.data.hitPoints,
      notes: enemy.data.notes ?? '',
    },
  }
}

export const removePartyEnemyDetails: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const shapeId = requiredText(params.shapeId, 1, 128)
  if (!partyId || !shapeId) return { success: false, error: 'Invalid enemy details request.' }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  const details = await tools.query<PartyEnemyDetailsRecord>('party_enemy_details', {
    where: { partyId, shapeId },
    limit: 1,
  })
  if (!details.success) return details
  const enemy = details.data.records[0]
  if (!enemy) return { success: true, data: { partyId, shapeId, removed: false } }

  const remove = await tools.remove('party_enemy_details', enemy.recordId)
  if (!remove.success) return remove
  return { success: true, data: { partyId, shapeId, removed: true } }
}

export const getPartyCharacterDetails: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const partyId = partyIdFrom(params)
  const characterId = requiredText(params.characterId, 1, 128)
  if (!partyId || !characterId) return { success: false, error: 'Invalid character details request.' }

  const dungeonMaster = await requireDungeonMaster(tools, partyId, userId)
  if (!dungeonMaster.found) return { success: false, error: dungeonMaster.error }

  const links = await tools.query<PartyCharacterRecord>('party_characters', {
    where: { partyId, characterId },
    limit: 1,
  })
  if (!links.success) return links
  const link = links.data.records[0]
  if (!link) return { success: false, error: 'That character is not linked to this party.' }

  const character = await tools.get<CharacterOwnershipRecord>('characters', characterId)
  if (!character.success || character.data.record.data.ownerId !== link.data.ownerId) {
    return { success: false, error: 'Character details are unavailable.' }
  }

  const sheet = character.data.record.data
  return {
    success: true,
    data: {
      name: sheet.name,
      ancestry: sheet.ancestry ?? '',
      className: sheet.className ?? '',
      background: sheet.background ?? '',
      level: sheet.level ?? 1,
      experience: sheet.experience ?? 0,
      abilityScores: sheet.abilityScores ?? {},
      hitPoints: sheet.hitPoints ?? {},
      notes: sheet.notes ?? '',
    },
  }
}
