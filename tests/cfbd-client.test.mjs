import assert from 'node:assert/strict'
import test from 'node:test'

import { CfbdClientError, createCfbdClient } from '../convex/cfbdClient.ts'

const draftPick = {
  name: 'Example Player',
  collegeTeam: 'Michigan',
  nflTeam: 'Detroit Lions',
  overall: 12,
  pick: 12,
  round: 1,
  year: 2025,
  position: 'QB',
}

test('game evidence requests include both season types and validate drive scores', async () => {
  const urls = []
  const drive = {
    id: 'drive-1',
    gameId: 10,
    isHomeOffense: true,
    startPeriod: 1,
    endPeriod: 1,
    startOffenseScore: 0,
    startDefenseScore: 0,
    endOffenseScore: 7,
    endDefenseScore: 0,
    plays: 8,
    driveResult: 'TD',
  }
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async (url) => {
      urls.push(new URL(url))
      return Response.json(
        String(url).includes('/drives')
          ? [drive]
          : [
              {
                gameId: 10,
                season: 2025,
                week: 2,
                team: 'A',
                opponent: 'B',
                offense: {},
                defense: {},
              },
            ],
      )
    },
  })
  assert.equal(
    (await client.getAdvancedGameStats({ season: 2025 }))[0].gameId,
    10,
  )
  assert.deepEqual(await client.getDrives({ season: 2025, week: 2 }), [drive])
  assert.equal(urls[0].searchParams.get('excludeGarbageTime'), 'true')
  assert.equal(urls[0].searchParams.get('seasonType'), 'both')
  assert.equal(urls[1].searchParams.get('classification'), 'fbs')
  assert.equal(urls[1].searchParams.get('week'), '2')
  const broken = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () => Response.json([{ ...drive, endOffenseScore: null }]),
  })
  await assert.rejects(
    () => broken.getDrives({ season: 2025 }),
    (error) =>
      error.kind === 'contract' && error.message.includes('endOffenseScore'),
  )
})

test('diagnostics bound field values, omit unrelated payloads, and redact the configured key', async () => {
  const client = createCfbdClient({
    apiKey: 'test-private-key',
    fetchImpl: async () =>
      Response.json([
        {
          ...draftPick,
          name: 'test-private-key',
          round: 'x'.repeat(10000),
          authorization: 'private-payload',
        },
      ]),
  })
  await assert.rejects(
    () => client.getDraftPicks({ season: 2025 }),
    (error) => {
      assert.ok(error.message.includes('<REDACTED>'))
      assert.ok(!error.message.includes('test-private-key'))
      assert.ok(!error.message.includes('private-payload'))
      assert.ok(error.message.length < 1500)
      return true
    },
  )
})

test('non-object records report their position and received type', async () => {
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () => Response.json([draftPick, null]),
  })
  await assert.rejects(
    () => client.getDraftPicks({ season: 2025 }),
    (error) => {
      assert.ok(error.message.includes('record 2 of 2 (null)'), error.message)
      return true
    },
  )
})

test('draft names map from the provider name field', async () => {
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () => Response.json([draftPick]),
  })
  assert.equal(
    (await client.getDraftPicks({ season: 2025 }))[0].playerName,
    draftPick.name,
  )
})

test('contract errors identify the request, record, and invalid value', async () => {
  const client = createCfbdClient({
    apiKey: 'test-token',
    fetchImpl: async () =>
      Response.json([draftPick, { ...draftPick, round: 'one' }]),
  })
  await assert.rejects(
    () => client.getDraftPicks({ season: 2025 }),
    (error) => {
      assert.equal(error.kind, 'contract')
      assert.equal(error.endpoint, '/draft/picks?year=2025')
      for (const detail of [
        'record 2',
        'Example Player',
        'Michigan',
        'overall=12',
        'invalid round',
        'expected finite number',
        'received string "one"',
      ]) {
        assert.ok(error.message.includes(detail), error.message)
      }
      return true
    },
  )
})

test('missing names still identify the draft selection and distinguish missing from null', async () => {
  for (const [name, expected] of [
    [undefined, 'missing'],
    [null, 'null'],
    ['', 'string ""'],
  ]) {
    const client = createCfbdClient({
      apiKey: 'test-token',
      fetchImpl: async () => Response.json([{ ...draftPick, name }]),
    })
    await assert.rejects(
      () => client.getDraftPicks({ season: 2025 }),
      (error) => {
        assert.ok(error.message.includes(`received ${expected}`), error.message)
        assert.ok(error.message.includes('overall=12'), error.message)
        return true
      },
    )
  }
})

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
      assert.equal(
        error.endpoint,
        '/games?year=2024&seasonType=both&classification=fbs',
      )
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
