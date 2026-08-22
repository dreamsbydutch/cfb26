import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'

export type RosterEntry = FunctionReturnType<typeof api.rosters.list>[number]
export type PlayerProfile = NonNullable<
  FunctionReturnType<typeof api.players.getProfile>
>
export type SeasonStatEntry = FunctionReturnType<
  typeof api.seasonalStats.listBySeason
>[number]

export type EnrichedPlayer = RosterEntry & {
  profile: PlayerProfile | undefined
}

const PROFILE_CONCURRENCY = 12
const PROFILE_BATCH_SIZE = 6
const ROSTER_POSITIONS = [
  'CB',
  'DL',
  'EDGE',
  'FB',
  'K',
  'LB',
  'LG',
  'LS',
  'LT',
  'NICKEL',
  'OC',
  'OG',
  'OT',
  'P',
  'QB',
  'RB',
  'RG',
  'RT',
  'S',
  'SLOT',
  'TE',
  'WR',
]

export function useMichiganRoster() {
  const client = useConvex()
  const { data: active } = useSuspenseQuery(
    convexQuery(api.rosters.list, {
      programKey: 'michigan',
      status: 'active',
      limit: 500,
    }),
  )
  const [archive, setArchive] = useState<Array<RosterEntry>>([])
  const [rosterIsComplete, setRosterIsComplete] = useState(false)
  const [rosterLoadFailed, setRosterLoadFailed] = useState(false)
  const [rosterRetryKey, setRosterRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setRosterLoadFailed(false)
    setRosterIsComplete(false)

    void Promise.all([
      client.query(api.rosters.list, {
        programKey: 'michigan',
        status: 'committed',
        limit: 500,
      }),
      ...ROSTER_POSITIONS.map((position) =>
        client.query(api.rosters.list, {
          programKey: 'michigan',
          status: 'departed',
          position,
          limit: 500,
        }),
      ),
    ])
      .then(([committed, ...positionGroups]) => {
        if (controller.signal.aborted) return
        const byId = new Map<string, RosterEntry>()
        for (const entry of [...committed, ...positionGroups.flat()]) {
          byId.set(entry.player._id, entry)
        }
        setArchive([...byId.values()])
        setRosterIsComplete(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setRosterLoadFailed(true)
      })

    return () => controller.abort()
  }, [client, rosterRetryKey])

  const roster = useMemo(() => [...active, ...archive], [active, archive])
  const [profiles, setProfiles] = useState<
    Partial<Record<string, PlayerProfile>>
  >({})
  const profilesRef = useRef(profiles)
  profilesRef.current = profiles
  const [failedProfiles, setFailedProfiles] = useState(0)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let nextIndex = 0
    let failures = 0
    const missing = roster.filter(
      (entry) => !profilesRef.current[entry.player._id],
    )

    async function worker() {
      let batch: Array<PlayerProfile> = []

      while (!controller.signal.aborted && nextIndex < missing.length) {
        const entry = missing[nextIndex]
        nextIndex += 1

        try {
          const profile = await client.query(api.players.getProfile, {
            playerId: entry.player._id,
          })
          if (profile) batch.push(profile)
        } catch {
          failures += 1
        }

        if (batch.length >= PROFILE_BATCH_SIZE) {
          const completed = batch
          batch = []
          setProfiles((current) => {
            const next = { ...current }
            for (const profile of completed) {
              next[profile.player._id] = profile
            }
            return next
          })
        }
      }

      if (batch.length > 0 && !controller.signal.aborted) {
        setProfiles((current) => {
          const next = { ...current }
          for (const profile of batch) next[profile.player._id] = profile
          return next
        })
      }
    }

    setFailedProfiles(0)
    void Promise.all(
      Array.from(
        { length: Math.min(PROFILE_CONCURRENCY, missing.length) },
        () => worker(),
      ),
    ).then(() => {
      if (!controller.signal.aborted) setFailedProfiles(failures)
    })

    return () => {
      controller.abort()
    }
  }, [client, retryKey, roster])

  const players = useMemo<Array<EnrichedPlayer>>(
    () =>
      roster.map((entry) => ({
        ...entry,
        profile: profiles[entry.player._id],
      })),
    [profiles, roster],
  )

  return {
    players,
    profileCount: Object.keys(profiles).length,
    failedProfiles,
    rosterIsComplete,
    rosterLoadFailed,
    retryRoster: () => setRosterRetryKey((value) => value + 1),
    retryProfiles: () => setRetryKey((value) => value + 1),
  }
}

export function useSeasonalStats(season: number) {
  return useQuery(
    convexQuery(api.seasonalStats.listBySeason, {
      programKey: 'michigan',
      season,
    }),
  )
}
