/**
 * Password verifiers are intentionally never synchronized to browser clients.
 * Party actions are the sole reader and writer for this collection.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const partySecretsSchema: CollectionSchema = {
  name: 'party_secrets',
  columns: [
    { name: 'partyId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'passwordSalt', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'passwordHash', storage: 'text', interpretation: 'plain', immutable: true, required: true },
  ],
  uniqueOn: ['partyId'],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
