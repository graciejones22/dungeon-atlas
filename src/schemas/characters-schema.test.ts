import { describe, expect, it } from 'vitest'
import { charactersSchema } from './characters-schema'

describe('charactersSchema', () => {
  it('keeps character sheets private for every signed-in app role', () => {
    expect(charactersSchema.ownerField).toBe('ownerId')
    expect(charactersSchema.columns.find((column) => column.name === 'ownerId')).toMatchObject({
      userBound: true,
      immutable: true,
      required: true,
    })

    for (const role of ['member', 'admin'] as const) {
      expect(charactersSchema.permissions[role]).toMatchObject({
        read: 'own',
        create: true,
        update: 'own',
        delete: 'own',
      })
    }
  })
})
