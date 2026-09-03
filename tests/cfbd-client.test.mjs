import assert from 'node:assert/strict'
import test from 'node:test'

import { CfbdClientError, createCfbdClient } from '../convex/cfbdClient.ts'

test('CFBD client returns validated games from the requested season and week', async () => {
  const requests = []
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async (url, init) => {
      requests.push({ init, url: String(url) })
      return Response.json([
        {
          awayClassification: 'fbs',
          awayId: 2,
          awayPoints: 13,
          awayTeam: 'Fresno State',
          completed: true,
          homeClassification: 'fbs',
          homeId: 1,
          homePoints: 30,
          homeTeam: 'Michigan',
          id: 401628455,
          neutralSite: false,
          season: 2024,
          seasonType: 'regular',
          startDate: '2024-08-31T23:30:00.000Z',
          week: 1,
        },
      ])
    },
  })

  const games = await client.getGames({
    classification: 'fbs',
    season: 2024,
    seasonType: 'both',
    week: 1,
  })

  assert.equal(games.length, 1)
  assert.equal(games[0]?.id, 401628455)
  assert.deepEqual(requests, [
    {
      init: {
        headers: { Authorization: 'Bearer test-token' },
        signal: undefined,
      },
      url: 'https://api.collegefootballdata.com/games?year=2024&week=1&seasonType=both&classification=fbs',
    },
  ])
})

test('CFBD client classifies authentication failures without exposing its key', async () => {
  const client = createCfbdClient({
    apiKey: 'should-never-appear',
    fetchImpl: async () => new Response('unauthorized', { status: 401 }),
  })

  await assert.rejects(
    () =>
      client.getGames({
        classification: 'fbs',
        season: 2024,
        seasonType: 'both',
      }),
    (error) => {
      assert.ok(error instanceof CfbdClientError)
      assert.equal(error.kind, 'authentication')
      assert.equal(error.retryable, false)
      assert.equal(error.status, 401)
      assert.equal(error.message.includes('should-never-appear'), false)
      return true
    },
  )
})

test('CFBD client retries transient rate limits before returning data', async () => {
  let attempts = 0
  const delays = []
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () => {
      attempts += 1
      if (attempts === 1) return new Response(null, { status: 429 })
      return Response.json([])
    },
    maxAttempts: 2,
    sleep: async (milliseconds) => {
      delays.push(milliseconds)
    },
  })

  const games = await client.getGames({
    classification: 'fbs',
    season: 2024,
    seasonType: 'both',
  })

  assert.deepEqual(games, [])
  assert.equal(attempts, 2)
  assert.deepEqual(delays, [250])
})

test('CFBD client reports response contract drift as a structured error', async () => {
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () =>
      Response.json([
        {
          awayClassification: 'fbs',
          awayId: 2,
          awayTeam: 'Fresno State',
          completed: true,
          homeClassification: 'fbs',
          homeId: 'not-a-number',
          homeTeam: 'Michigan',
          id: 401628455,
          neutralSite: false,
          season: 2024,
          seasonType: 'regular',
          startDate: '2024-08-31T23:30:00.000Z',
          week: 1,
        },
      ]),
  })

  await assert.rejects(
    () =>
      client.getGames({
        classification: 'fbs',
        season: 2024,
        seasonType: 'both',
      }),
    (error) => {
      assert.ok(error instanceof CfbdClientError)
      assert.equal(error.kind, 'contract')
      assert.equal(error.endpoint, '/games')
      return true
    },
  )
})

test('CFBD client validates two-team box scores', async () => {
  let requestedUrl = ''
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async (url) => {
      requestedUrl = String(url)
      return Response.json([
        {
          id: 401628455,
          teams: [
            {
              conference: 'Big Ten',
              homeAway: 'home',
              points: 30,
              stats: [{ category: 'totalYards', stat: '269' }],
              team: 'Michigan',
              teamId: 1,
            },
            {
              conference: 'Mountain West',
              homeAway: 'away',
              points: 13,
              stats: [{ category: 'totalYards', stat: '244' }],
              team: 'Fresno State',
              teamId: 2,
            },
          ],
        },
      ])
    },
  })

  const boxScores = await client.getTeamGameStats({
    classification: 'fbs',
    season: 2024,
    seasonType: 'both',
    week: 1,
  })

  assert.equal(boxScores[0]?.teams.length, 2)
  assert.equal(
    requestedUrl,
    'https://api.collegefootballdata.com/games/teams?year=2024&week=1&seasonType=both&classification=fbs',
  )
})

test('CFBD client rejects a successful response with a non-JSON content type', async () => {
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () =>
      new Response('[]', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }),
  })

  await assert.rejects(
    () =>
      client.getGames({
        classification: 'fbs',
        season: 2024,
        seasonType: 'both',
      }),
    (error) => {
      assert.ok(error instanceof CfbdClientError)
      assert.equal(error.kind, 'invalid_json')
      return true
    },
  )
})
