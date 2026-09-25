/** Server-side party authorization helpers for all party-scoped actions. */

import type { ActionTools } from 'deepspace/worker'

export type PartyRole = 'dm' | 'player'

export interface PartyMembership extends Record<string, unknown> {
  teamId: string
  userId: string
  role: PartyRole
  status: 'active' | 'removed'
}

type MembershipLookup =
  | { found: true; membership: PartyMembershipRecord }
  | { found: false; error: string }

interface PartyMembershipRecord {
  recordId: string
  data: PartyMembership
}

interface PartyOwnerRecord extends Record<string, unknown> {
  ownerId: string
}

export async function getActivePartyMembership(
  tools: ActionTools,
  partyId: string,
  userId: string,
): Promise<MembershipLookup> {
  const memberships = await tools.query<PartyMembership>('team_members', {
    where: { teamId: partyId, userId },
    limit: 1,
  })
  if (!memberships.success) return { found: false, error: memberships.error }

  const membership = memberships.data.records.find((record) => record.data.status === 'active')
  if (!membership) return { found: false, error: 'You are not an active member of this party.' }
  return { found: true, membership }
}

export async function requireDungeonMaster(
  tools: ActionTools,
  partyId: string,
  userId: string,
): Promise<MembershipLookup> {
  const membership = await getActivePartyMembership(tools, partyId, userId)
  if (!membership.found) return membership
  if (membership.membership.data.role === 'dm') return membership

  // Creating a party is an immutable ownership claim. Treat its creator as a
  // DM even if a stale membership role is observed, while still requiring the
  // active membership above so removed users cannot retain board access.
  const party = await tools.get<PartyOwnerRecord>('parties', partyId)
  if (party.success && party.data.record.data.ownerId === userId) return membership

  return { found: false, error: 'Only a Dungeon Master can manage party roles.' }
}

export async function activeDungeonMasterCount(tools: ActionTools, partyId: string): Promise<number | null> {
  const memberships = await tools.query<PartyMembership>('team_members', {
    where: { teamId: partyId },
    limit: 500,
  })
  if (!memberships.success) return null
  return memberships.data.records.filter(
    (membership) => membership.data.status === 'active' && membership.data.role === 'dm',
  ).length
}
