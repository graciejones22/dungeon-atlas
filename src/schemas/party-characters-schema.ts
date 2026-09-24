/**
 * Links a privately owned character to one or more parties. The link is
 * party-scoped so every active party member can see that a character is in the
 * roster, while the character sheet itself remains private to its owner.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const partyCharactersSchema: CollectionSchema = {
  name: 'party_characters',
  columns: [
    { name: 'partyId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'characterId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'characterName', storage: 'text', interpretation: 'plain', immutable: true, default: '' },
    {
      name: 'ownerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
      required: true,
    },
  ],
  uniqueOn: ['partyId', 'characterId'],
  ownerField: 'ownerId',
  teamField: 'partyId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'team', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
