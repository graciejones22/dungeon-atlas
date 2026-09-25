import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('party actions require authentication', async ({ request }) => {
    const actions = [
      ['createParty', { name: 'The Silver Hand', password: 'sufficiently-long-password' }],
      ['setPartyMemberRole', { partyId: 'party_1', userId: 'user_1', role: 'dm' }],
      ['removePartyMember', { partyId: 'party_1', userId: 'user_1' }],
      ['linkCharacterToParty', { partyId: 'party_1', characterId: 'character_1' }],
      ['unlinkCharacterFromParty', { partyId: 'party_1', characterId: 'character_1' }],
      ['getPartyCharacterDetails', { partyId: 'party_1', characterId: 'character_1' }],
      ['placePartyCharacterToken', { partyId: 'party_1', characterId: 'character_1', x: 0, y: 0 }],
      ['movePartyCharacterToken', { partyId: 'party_1', characterId: 'character_1', x: 0, y: 0 }],
      ['removePartyCharacterToken', { partyId: 'party_1', characterId: 'character_1' }],
      ['createPartyEnemyDetails', { partyId: 'party_1', shapeId: 'shape_1', name: 'Goblin', hitPoints: 7, notes: '' }],
      ['getPartyEnemyDetails', { partyId: 'party_1', shapeId: 'shape_1' }],
      ['removePartyEnemyDetails', { partyId: 'party_1', shapeId: 'shape_1' }],
    ]

    for (const [action, data] of actions) {
      const res = await request.post(`/api/actions/${action}`, { data })
      expect(res.status()).toBe(401)
    }
  })

  test('party board WebSocket requires authentication', async ({ request }) => {
    const res = await request.get('/ws/canvas/party_1')
    expect(res.status()).toBe(401)
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})
