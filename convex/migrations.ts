import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import schema from './schema'

export const migrations = new Migrations(components.migrations, { schema })

export const retireUnversionedBackupManifests = migrations.define({
  table: 'backupManifests',
  migrateOne: async (ctx, manifest) => {
    if (manifest.dataRevision !== undefined) return
    const now = Date.now()
    await ctx.db.insert('ownerAuditEvents', {
      action: 'retire_unversioned_backup_manifest',
      actor: 'migration',
      completedAt: now,
      result: 'succeeded',
      startedAt: now,
      target: String(manifest._id),
      warnings: [
        'The server-side manifest predated Michigan data revisions. Downloaded backup files were not changed.',
      ],
    })
    await ctx.db.delete('backupManifests', manifest._id)
  },
})

export const run = migrations.runner([
  internal.migrations.retireUnversionedBackupManifests,
])
