import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { probeCfbd } from '../convex/cfbdHealthProbe.ts'

const responses = JSON.parse(
  readFileSync(new URL('./fixtures/cfbd/health.json', import.meta.url), 'utf8'),
)

test('live probe validates every official input without writing data', async () => {
  const requestedPaths = []
  const report = await probeCfbd({
    apiKey: 'test-token',
    fetchImpl: async (url) => {
      const parsed = new URL(String(url))
      requestedPaths.push(parsed.pathname)
      const response = responses[parsed.pathname]
      assert.notEqual(
        response,
        undefined,
        `Unexpected endpoint ${parsed.pathname}`,
      )
      return Response.json(response)
    },
    now: () => 1_000,
    season: 2024,
    week: 1,
  })

  assert.equal(report.configured, true)
  assert.equal(report.ok, true)
  assert.equal(report.endpoints.length, 10)
  assert.equal(
    report.endpoints.every((endpoint) => endpoint.status === 'ok'),
    true,
  )
  assert.deepEqual(requestedPaths.sort(), Object.keys(responses).sort())
})

test('live probe fails closed when a required endpoint rejects credentials', async () => {
  const report = await probeCfbd({
    apiKey: 'should-never-appear',
    fetchImpl: async (url) => {
      const path = new URL(String(url)).pathname
      if (path === '/games') return new Response(null, { status: 401 })
      return Response.json(responses[path] ?? [])
    },
    now: () => 1_000,
    season: 2024,
    week: 1,
  })

  assert.equal(report.ok, false)
  const games = report.endpoints.find((endpoint) => endpoint.name === 'games')
  assert.equal(games?.status, 'error')
  assert.equal(games?.errorKind, 'authentication')
  assert.equal(games?.warning?.includes('should-never-appear'), false)
})

test('live probe reports optional source failure without failing core health', async () => {
  const report = await probeCfbd({
    apiKey: 'test-token',
    fetchImpl: async (url) => {
      const path = new URL(String(url)).pathname
      if (path === '/talent') return new Response(null, { status: 403 })
      return Response.json(responses[path] ?? [])
    },
    now: () => 1_000,
    season: 2024,
    week: 1,
  })

  assert.equal(report.ok, true)
  const talent = report.endpoints.find((endpoint) => endpoint.name === 'talent')
  assert.equal(talent?.status, 'error')
  assert.equal(talent?.required, false)
})
