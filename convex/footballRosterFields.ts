import { v } from 'convex/values'

export const listedClass = v.union(
  v.literal('FR'),
  v.literal('SO'),
  v.literal('JR'),
  v.literal('SR'),
  v.literal('5TH'),
  v.literal('GR'),
)
