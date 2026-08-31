'use client'

import { Clock, TimerOff } from 'lucide-react'

import { type KeyResult } from '@/lib/okr.ts'
import { reviewStatus, reviewSummary } from '@/lib/review.ts'

/** Green while reviewed on time, amber once overdue, red once badly overdue. */
const TONES: Record<string, string> = {
  never: 'text-ink-faint',
  fresh: 'text-done',
  slipping: 'text-warn',
  stale: 'text-dropped',
}

/**
 * How overdue this key result is a review, measured against its initiative's
 * cadence and its own newest progress note.
 *
 * Renders nothing at all when there is nothing to say — no cadence set, or the
 * work is finished. An indicator that is always present but often meaningless
 * gets ignored.
 */
export function ReviewBadge({
  keyResult,
  cadence,
  today,
}: {
  keyResult: KeyResult
  cadence: string | undefined
  today: string
}) {
  const review = reviewStatus(keyResult, cadence, today)
  if (review.state === 'exempt') return null

  const Icon = review.state === 'never' ? TimerOff : Clock
  const overdue = review.state === 'slipping' || review.state === 'stale'

  return (
    <span
      title={reviewSummary(review, cadence)}
      aria-label={reviewSummary(review, cadence)}
      className={`flex shrink-0 items-center gap-0.5 text-xs ${TONES[review.state]}`}
    >
      <Icon size={12} />
      {overdue && review.daysSince !== null && (
        <span className="tabular-nums">{review.daysSince}d</span>
      )}
    </span>
  )
}
