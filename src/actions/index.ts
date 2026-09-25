import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  createParty,
  getPartyCharacterDetails,
  joinParty,
  linkCharacterToParty,
  movePartyCharacterToken,
  placePartyCharacterToken,
  removePartyMember,
  removePartyCharacterToken,
  setPartyMemberRole,
  unlinkCharacterFromParty,
} from './party-actions'

export const actions: Record<string, ActionHandler<Env>> = {
  createParty,
  getPartyCharacterDetails,
  joinParty,
  setPartyMemberRole,
  removePartyMember,
  linkCharacterToParty,
  unlinkCharacterFromParty,
  placePartyCharacterToken,
  movePartyCharacterToken,
  removePartyCharacterToken,
}
