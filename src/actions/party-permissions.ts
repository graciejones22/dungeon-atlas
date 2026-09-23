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
  if (membership.membership.data.role !== 'dm') {
    return { found: false, error: 'Only a Dungeon Master can manage party roles.' }
  }
  return membership
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
