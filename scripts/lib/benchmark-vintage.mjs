import { createHash } from 'node:crypto'

/** Download time cannot establish which publisher edition an API response contains. */
export function benchmarkVintage(snapshot, { season, throughWeek, cutoffAt }) {
  const edition = snapshot.publisherEdition
  if (
    !edition ||
    edition.status !== 'verified' ||
    !edition.url ||
    !/^[a-f0-9]{64}$/.test(edition.contentSha256 ?? '')
  )
    return { eligible: false, reason: 'Publisher edition is unverified.' }
  const rowsHash = createHash('sha256')
    .update(JSON.stringify(snapshot.rows ?? []))
    .digest('hex')
  if (edition.snapshotRowsSha256 !== rowsHash)
    return {
      eligible: false,
      reason: 'Verification does not match these downloaded ratings.',
    }
  if (
    ![
      snapshot.observedAt,
      edition.publishedAt,
      edition.verifiedAt,
      cutoffAt,
    ].every(Number.isFinite) ||
    edition.publishedAt > snapshot.observedAt ||
    edition.verifiedAt < snapshot.observedAt ||
    Math.max(snapshot.observedAt, edition.verifiedAt) > cutoffAt
  )
    return {
      eligible: false,
      reason: 'Edition was not verified and available at forecast cutoff.',
    }
  if (
    snapshot.season !== season ||
    edition.season !== season ||
    edition.throughWeek !== throughWeek
  )
    return {
      eligible: false,
      reason: 'Publisher season or completed week does not match.',
    }
  return { eligible: true, reason: null }
}
