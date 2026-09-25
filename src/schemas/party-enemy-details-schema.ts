/**
 * DM-private details for an enemy Canvas shape. The shape is deliberately
 * public to party board members, but its encounter notes stay behind an
 * action that verifies the caller is this party's Dungeon Master.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const partyEnemyDetailsSchema: CollectionSchema = {
  name: 'party_enemy_details',
  columns: [
    { name: 'partyId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'shapeId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hitPoints', storage: 'number', interpretation: 'plain', required: true },
    { name: 'notes', storage: 'text', interpretation: 'plain', default: '' },
  ],
  uniqueOn: ['partyId', 'shapeId'],
  teamField: 'partyId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    // No direct client reads: a party member can see the red triangle but not
    // its private encounter notes. DM server actions are the only access path.
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
