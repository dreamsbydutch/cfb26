export type MarginTreatment = 'capped' | 'huber' | 'censored'

/** Preserve regulation scores; bound influence by prediction error, not winning margin. */
export function resultMargin(
  home: number,
  away: number,
  overtime: number,
  treatment: MarginTreatment,
) {
  const margin = home - away
  if (
    ![home, away, overtime].every(Number.isFinite) ||
    home < 0 ||
    away < 0 ||
    overtime < 0
  )
    throw new Error('Invalid result.')
  const limit = overtime > 0 ? 7 : treatment === 'huber' ? Infinity : 35
  return Math.max(-limit, Math.min(limit, margin))
}

/** A clipped tail is an inequality, not an exact observation of 35 points. */
export function censoredMargin(capped: number, raw: number, expected: number) {
  if (![capped, raw, expected].every(Number.isFinite))
    throw new Error('Invalid censored margin.')
  if (raw > 35) return Math.max(capped, expected)
  if (raw < -35) return Math.min(capped, expected)
  return capped
}

export function marginInfluence(
  observed: number,
  expected: number,
  threshold = 21,
) {
  if (![observed, expected, threshold].every(Number.isFinite) || threshold <= 0)
    throw new Error('Invalid margin influence.')
  const residual = Math.abs(observed - expected)
  return residual <= threshold ? 1 : threshold / residual
}
