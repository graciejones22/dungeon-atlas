import { mintUlid, timingSafeEqualStrings, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'

const PASSWORD_ITERATIONS = 600_000
const PASSWORD_BYTES = 32
const PARTY_CODE_BYTES = 8
const PASSWORD_SALT_BYTES = 16

interface PartyRecord extends Record<string, unknown> {
  partyId: string
  joinCode: string
}

interface PartySecretRecord extends Record<string, unknown> {
  passwordSalt: string
  passwordHash: string
}

function requiredText(value: unknown, label: string, minLength: number, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length < minLength || text.length > maxLength) return null
  return text
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

export const createParty: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const name = requiredText(params.name, 'Party name', 1, 80)
  const password = requiredText(params.password, 'Password', 8, 128)
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
  const joinCode = requiredText(params.joinCode, 'Party code', PARTY_CODE_BYTES * 2, PARTY_CODE_BYTES * 2)
  const password = requiredText(params.password, 'Password', 8, 128)
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

  const existingMembership = await tools.query('team_members', {
    where: { teamId: party.data.partyId, userId },
    limit: 1,
  })
  if (!existingMembership.success) return existingMembership
  if (existingMembership.data.records.length > 0) {
    return { success: true, data: { partyId: party.data.partyId, joined: false } }
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
