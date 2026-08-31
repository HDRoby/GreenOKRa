/**
 * Whether a key result is overdue a review.
 *
 * The initiative's `review_cadence` says how often its work is looked at; the
 * newest progress note says when this key result last was. The gap between the
 * two is the only thing here worth computing, and like every other percentage
 * and derived date in this project it is never written to the file.
 *
 * Nothing about this is a rule of the format. A file whose notes are years old
 * is perfectly valid; it is just not being looked after.
 */

import { type Cadence, CADENCES, type KeyResult, STATUSES, canonical } from './okr.ts'

/**
 * Days between reviews.
 *
 * `Bi-Weekly` is every two weeks, the usual reading in a planning context, not
 * twice a week. The longer periods are the calendar's average length rather
 * than any particular month or quarter: a review is late by roughly a month,
 * not by a month that happens to have 31 days in it.
 */
const INTERVAL_DAYS: Record<Cadence, number> = {
  Weekly: 7,
  'Bi-Weekly': 14,
  Monthly: 30,
  Quarterly: 91,
  '6 Months': 182,
  Yearly: 365,
}

export type Freshness =
  /** No cadence set, or the work is finished — nothing to be overdue for. */
  | 'exempt'
  /** Never reviewed: there are no notes to date from. */
  | 'never'
  /** Reviewed within the interval. */
  | 'fresh'
  /** Overdue, by less than a further interval. */
  | 'slipping'
  /** Overdue by more than twice the interval. */
  | 'stale'

export interface Review {
  state: Freshness
  /** Date of the newest progress note, `YYYY-MM-DD`. */
  lastReviewed: string | null
  daysSince: number | null
  intervalDays: number | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Whole days from one date to another, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number | null {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return null
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}

/**
 * The newest note's date.
 *
 * Reads the whole list rather than trusting position: the log is kept
 * newest-first, but a file edited by hand need not be.
 */
export function lastReviewed(keyResult: KeyResult): string | null {
  let newest: string | null = null
  for (const note of keyResult.progress_notes ?? []) {
    const date = note.date?.trim()
    if (!date || !ISO_DATE.test(date)) continue
    if (newest === null || date > newest) newest = date
  }
  return newest
}

export function cadenceOf(value: string | undefined): Cadence | null {
  return canonical(value, CADENCES) as Cadence | null
}

/**
 * How overdue a review is, as of `today` (`YYYY-MM-DD`).
 *
 * Completed and aborted key results are exempt: a finished thing does not need
 * reviewing, and flagging it would only teach people to ignore the indicator.
 */
export function reviewStatus(
  keyResult: KeyResult,
  cadence: string | undefined,
  today: string,
): Review {
  const interval = cadenceOf(cadence)
  const status = canonical(keyResult.status, STATUSES)
  const blank: Review = {
    state: 'exempt',
    lastReviewed: null,
    daysSince: null,
    intervalDays: null,
  }

  if (interval === null) return blank
  if (status === 'Completed' || status === 'Aborted') return blank

  const intervalDays = INTERVAL_DAYS[interval]
  const last = lastReviewed(keyResult)
  if (last === null) {
    return { state: 'never', lastReviewed: null, daysSince: null, intervalDays }
  }

  const daysSince = daysBetween(last, today)
  if (daysSince === null) {
    return { state: 'never', lastReviewed: last, daysSince: null, intervalDays }
  }

  // A note dated in the future is odd but not stale.
  const state: Freshness =
    daysSince <= intervalDays
      ? 'fresh'
      : daysSince <= intervalDays * 2
        ? 'slipping'
        : 'stale'

  return { state, lastReviewed: last, daysSince, intervalDays }
}

/** What the indicator should say on hover. */
export function reviewSummary(review: Review, cadence: string | undefined): string {
  const every = cadenceOf(cadence)
  switch (review.state) {
    case 'exempt':
      return ''
    case 'never':
      return `Never reviewed. ${every} review expected.`
    case 'fresh':
      return `Reviewed ${describeDays(review.daysSince)}, within the ${String(
        every,
      ).toLowerCase()} interval.`
    default:
      return `Reviewed ${describeDays(review.daysSince)} — overdue a ${String(
        every,
      ).toLowerCase()} review.`
  }
}

function describeDays(days: number | null): string {
  if (days === null) return 'at an unknown time'
  if (days < 0) return 'with a future date'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
