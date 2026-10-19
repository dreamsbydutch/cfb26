import assert from 'node:assert/strict'
import test from 'node:test'
import {
  footballUrl,
  hasRetiredFootballControls,
} from '../src/features/michigan/footballNavigation.ts'

test('retired football bookmarks keep the season and discard obsolete view controls', () => {
  const target = footballUrl(
    '?season=2017&variant=B&view=lineup&players=a,b&preset=experience&source=bookmark',
  )
  assert.equal(target, '/?season=2017&source=bookmark')
  assert.equal(hasRetiredFootballControls(target.slice(1)), false)
})

test('football URLs without retired controls do not redirect again', () => {
  assert.equal(footballUrl(''), '/')
  assert.equal(hasRetiredFootballControls(''), false)
  assert.equal(hasRetiredFootballControls('?season=2026'), false)
  assert.equal(hasRetiredFootballControls('?variant='), true)
  assert.equal(footballUrl('?variant='), '/')
})
