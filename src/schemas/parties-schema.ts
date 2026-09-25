/**
 * Party metadata visible only to active party members. Password material lives
 * in the server-only party_secrets collection.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const partiesSchema: CollectionSchema = {
  name: 'parties',
  columns: [
    {
      name: 'partyId',
      storage: 'text',
      interpretation: 'plain',
      immutable: true,
      required: true,
    },
    {
      name: 'ownerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
      required: true,
    },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'joinCode',
      storage: 'text',
      interpretation: 'plain',
      immutable: true,
      required: true,
    },
  ],
  uniqueOn: ['joinCode'],
  ownerField: 'ownerId',
  teamField: 'partyId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'team', create: false, update: false, delete: false },
    // The app owner is an SDK admin but is not automatically a member of
    // every DungeonAtlas party. Party actions are the only privileged path.
    admin: { read: 'team', create: false, update: false, delete: false },
  },
}
