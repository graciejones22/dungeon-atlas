import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  createParty,
  createPartyEnemyDetails,
  getPartyCharacterDetails,
  getPartyEnemyDetails,
  joinParty,
  linkCharacterToParty,
  movePartyCharacterToken,
  placePartyCharacterToken,
  removePartyMember,
  removePartyCharacterToken,
  removePartyEnemyDetails,
  setPartyMemberRole,
  unlinkCharacterFromParty,
} from './party-actions'

export const actions: Record<string, ActionHandler<Env>> = {
  createParty,
  createPartyEnemyDetails,
  getPartyCharacterDetails,
  getPartyEnemyDetails,
  joinParty,
  setPartyMemberRole,
  removePartyMember,
  linkCharacterToParty,
  unlinkCharacterFromParty,
  placePartyCharacterToken,
  movePartyCharacterToken,
  removePartyCharacterToken,
  removePartyEnemyDetails,
}
