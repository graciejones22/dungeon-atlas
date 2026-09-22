/**
 * DeepSpace resolves `team` permissions from a collection named
 * `team_members`. `teamId` is a DungeonAtlas party ID.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const partyMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    {
      name: 'userId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
      required: true,
    },
    {
      name: 'role',
      storage: 'text',
      interpretation: { kind: 'select', options: ['dm', 'player'] },
      immutable: true,
      required: true,
    },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['active', 'removed'] },
      default: 'active',
      required: true,
    },
  ],
  uniqueOn: ['teamId', 'userId'],
  ownerField: 'userId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
