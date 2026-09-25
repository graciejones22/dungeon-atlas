import { describe, expect, it } from 'vitest'
import { partiesSchema } from './parties-schema'
import { partyMembersSchema } from './party-members-schema'
import { partyCharactersSchema } from './party-characters-schema'
import { partyCharacterTokensSchema } from './party-character-tokens-schema'

describe('party access schemas', () => {
  it('does not let the app owner bypass DungeonAtlas party membership', () => {
    expect(partiesSchema.permissions.admin).toEqual(partiesSchema.permissions.member)
    expect(partyMembersSchema.permissions.admin).toEqual(partyMembersSchema.permissions.member)
    expect(partyCharactersSchema.permissions.admin).toEqual(partyCharactersSchema.permissions.member)
    expect(partyCharacterTokensSchema.permissions.admin).toEqual(partyCharacterTokensSchema.permissions.member)
  })
})
