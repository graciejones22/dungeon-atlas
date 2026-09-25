/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { charactersSchema } from './schemas/characters-schema'
import { partiesSchema } from './schemas/parties-schema'
import { partyMembersSchema } from './schemas/party-members-schema'
import { partySecretsSchema } from './schemas/party-secrets-schema'
import { partyCharactersSchema } from './schemas/party-characters-schema'
import { partyCharacterTokensSchema } from './schemas/party-character-tokens-schema'
import { partyEnemyDetailsSchema } from './schemas/party-enemy-details-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  charactersSchema,
  partiesSchema,
  partyMembersSchema,
  partySecretsSchema,
  partyCharactersSchema,
  partyCharacterTokensSchema,
  partyEnemyDetailsSchema,
]
