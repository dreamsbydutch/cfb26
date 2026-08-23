import { defineApp } from 'convex/server'
import { v } from 'convex/values'

export default defineApp({
  env: {
    CFB26_ADMIN_KEY: v.optional(v.string()),
    CFBD_API_KEY: v.optional(v.string()),
  },
})
