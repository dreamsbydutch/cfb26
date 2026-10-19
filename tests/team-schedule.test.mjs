import assert from 'node:assert/strict'
import test from 'node:test'
import {
  scheduleOpponentKey,
  scheduleOpponentOptions,
} from '../src/features/teams/teamScheduleModel.ts'

test('opponent filters group actual school variants but keep shared-ID tournament placeholders separate', () => {
  const games = [
    { opponentId: '440', opponent: 'Michigan State University' },
    { opponentId: '440', opponent: '#25/-- Michigan State' },
    { opponentId: '440', opponent: 'Michigan State (#3)' },
    { opponentId: '474', opponent: 'Big Ten Tournament (Quarterfinals)' },
    { opponentId: '474', opponent: 'Big Ten Tournament (Semifinals)' },
    { opponentId: '10', opponent: 'Oakland (ex)' },
    { opponentId: '10', opponent: 'Oakland' },
  ]
  const options = scheduleOpponentOptions(games)
  assert.equal(options.length, 4)
  assert.equal(
    games.filter(
      (game) => scheduleOpponentKey(game) === scheduleOpponentKey(games[0]),
    ).length,
    3,
  )
  assert.notEqual(scheduleOpponentKey(games[3]), scheduleOpponentKey(games[4]))
  assert.equal(scheduleOpponentKey(games[5]), scheduleOpponentKey(games[6]))
  assert.deepEqual(
    games.map((game) => game.opponent),
    [
      'Michigan State University',
      '#25/-- Michigan State',
      'Michigan State (#3)',
      'Big Ten Tournament (Quarterfinals)',
      'Big Ten Tournament (Semifinals)',
      'Oakland (ex)',
      'Oakland',
    ],
  )
})
