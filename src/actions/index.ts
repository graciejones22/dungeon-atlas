import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createParty, joinParty, removePartyMember, setPartyMemberRole } from './party-actions'

export const actions: Record<string, ActionHandler<Env>> = {
  createParty,
  joinParty,
  setPartyMemberRole,
  removePartyMember,
}
