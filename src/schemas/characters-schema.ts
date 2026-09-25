/**
 * Character sheets are private to their creator for the first product
 * increment. Party-level visibility and Dungeon Master access will be added
 * through party membership records rather than the app-wide SDK roles.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const charactersSchema: CollectionSchema = {
  name: 'characters',
  columns: [
    {
      name: 'ownerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
      required: true,
    },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ancestry', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'className', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'background', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'level', storage: 'number', interpretation: 'plain', default: 1 },
    { name: 'experience', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'abilityScores', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'hitPoints', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'notes', storage: 'text', interpretation: 'plain', default: '' },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: {
      read: 'own',
      create: true,
      update: 'own',
      delete: 'own',
      writableFields: [
        'name',
        'ancestry',
        'className',
        'background',
        'level',
        'experience',
        'abilityScores',
        'hitPoints',
        'notes',
      ],
    },
    // App-level admins are regular players in DungeonAtlas too. Dungeon
    // Master access to a linked character sheet is granted only through the
    // party-scoped server action, never by broadening this private collection.
    admin: {
      read: 'own',
      create: true,
      update: 'own',
      delete: 'own',
      writableFields: [
        'name',
        'ancestry',
        'className',
        'background',
        'level',
        'experience',
        'abilityScores',
        'hitPoints',
        'notes',
      ],
    },
  },
}
