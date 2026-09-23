import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  createParty,
  joinParty,
  linkCharacterToParty,
  removePartyMember,
  setPartyMemberRole,
  unlinkCharacterFromParty,
} from './party-actions'

export const actions: Record<string, ActionHandler<Env>> = {
  createParty,
  joinParty,
  setPartyMemberRole,
  removePartyMember,
  linkCharacterToParty,
  unlinkCharacterFromParty,
}
