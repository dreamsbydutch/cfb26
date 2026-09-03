import { v } from 'convex/values'
import { env, internalAction } from './_generated/server'
import { probeCfbd } from './cfbdHealthProbe'
import type { CfbdHealthReport } from './cfbdHealthProbe'

export const probe = internalAction({
  args: { season: v.number(), week: v.number() },
  handler: async (_ctx, args): Promise<CfbdHealthReport> => {
    const season = Math.floor(args.season)
    const week = Math.floor(args.week)
    const currentSeason = new Date().getUTCFullYear()
    if (season < 2000 || season > currentSeason) {
      throw new Error(`Season must be between 2000 and ${currentSeason}.`)
    }
    if (week < 1 || week > 30) {
      throw new Error('Week must be between 1 and 30.')
    }
    return probeCfbd({
      apiKey: env.CFBD_API_KEY ?? '',
      season,
      week,
    })
  },
})
