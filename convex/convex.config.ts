import migrations from '@convex-dev/migrations/convex.config.js'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    CFB26_ADMIN_KEY: v.optional(v.string()),
    CFBD_API_KEY: v.optional(v.string()),
  },
})

app.use(migrations)

export default app
