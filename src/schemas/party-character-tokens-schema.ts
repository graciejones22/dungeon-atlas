/**
 * A character's placement on a specific party board. These records are kept
 * separate from Canvas shapes so a player can move only their own token while
 * the DM remains the sole editor for terrain and encounter objects.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const partyCharacterTokensSchema: CollectionSchema = {
  name: 'party_character_tokens',
  columns: [
    { name: 'partyId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'characterId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'characterName', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    // This is deliberately server-assigned rather than userBound: the DM
    // places a token for another party member. Client writes are disabled;
    // server actions verify both party membership and character ownership.
    { name: 'ownerId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'x', storage: 'number', interpretation: 'plain', required: true },
    { name: 'y', storage: 'number', interpretation: 'plain', required: true },
    { name: 'color', storage: 'text', interpretation: 'plain', immutable: true, default: '#4f46e5' },
    { name: 'label', storage: 'text', interpretation: 'plain', immutable: true, default: '?' },
  ],
  uniqueOn: ['partyId', 'characterId'],
  ownerField: 'ownerId',
  teamField: 'partyId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    // Movement is mediated by a server action so it can require an active
    // party membership as well as ownership of the linked character.
    member: { read: 'team', create: false, update: false, delete: false },
    admin: { read: 'team', create: false, update: false, delete: false },
  },
}
