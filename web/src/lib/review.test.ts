import { describe, expect, test } from 'vitest'

import { CADENCES, type KeyResult } from './okr.ts'
import {
  cadenceOf,
  daysBetween,
  lastReviewed,
  reviewStatus,
  reviewSummary,
} from './review.ts'

const TODAY = '2026-08-31'

const withNotes = (dates: string[], status = 'In Progress'): KeyResult => ({
  status,
  progress_notes: dates.map((date) => ({ date, note: 'A note.' })),
})

describe('cadence', () => {
  test('reads the fixed values, leniently', () => {
    expect(cadenceOf('Weekly')).toBe('Weekly')
    expect(cadenceOf('bi-weekly')).toBe('Bi-Weekly')
    expect(cadenceOf('BI_WEEKLY')).toBe('Bi-Weekly')
    expect(cadenceOf('Monthly')).toBe('Monthly')
    expect(cadenceOf('6 months')).toBe('6 Months')
    expect(cadenceOf('6-Months')).toBe('6 Months')
  })

  test('rejects anything else', () => {
    expect(cadenceOf('Monthly review, quarterly sponsor review')).toBeNull()
    expect(cadenceOf('Fortnightly')).toBeNull()
    expect(cadenceOf(undefined)).toBeNull()
  })
})

describe('days between dates', () => {
  test('counts whole days', () => {
    expect(daysBetween('2026-08-24', '2026-08-31')).toBe(7)
    expect(daysBetween('2026-08-31', '2026-08-31')).toBe(0)
  })

  test('crosses a month and a year without drifting', () => {
    expect(daysBetween('2026-01-31', '2026-03-01')).toBe(29)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })

  test('gives up on anything that is not a date', () => {
    expect(daysBetween('Q3', '2026-08-31')).toBeNull()
    expect(daysBetween('2026-08-31', '')).toBeNull()
  })
})

describe('the last review', () => {
  test('is the newest note, whatever order the file holds them in', () => {
    expect(lastReviewed(withNotes(['2026-08-01', '2026-06-01']))).toBe('2026-08-01')
    // A hand-edited file need not be sorted.
    expect(lastReviewed(withNotes(['2026-06-01', '2026-08-01']))).toBe('2026-08-01')
  })

  test('ignores unparseable dates', () => {
    expect(lastReviewed(withNotes(['soon', '2026-06-01']))).toBe('2026-06-01')
  })

  test('is null when there are no notes', () => {
    expect(lastReviewed({ status: 'In Progress' })).toBeNull()
  })
})

describe('freshness', () => {
  test('is fresh inside the interval', () => {
    const review = reviewStatus(withNotes(['2026-08-27']), 'Weekly', TODAY)
    expect(review.state).toBe('fresh')
    expect(review.daysSince).toBe(4)
    expect(review.intervalDays).toBe(7)
  })

  test('is fresh on the very day it falls due', () => {
    expect(reviewStatus(withNotes(['2026-08-24']), 'Weekly', TODAY).state).toBe('fresh')
  })

  test('slips once the interval passes', () => {
    // 8 days on a weekly cadence.
    expect(reviewStatus(withNotes(['2026-08-23']), 'Weekly', TODAY).state).toBe(
      'slipping',
    )
  })

  test('goes stale beyond twice the interval', () => {
    // 15 days on a weekly cadence.
    expect(reviewStatus(withNotes(['2026-08-16']), 'Weekly', TODAY).state).toBe('stale')
  })

  test('scales with the cadence', () => {
    const twoMonthsAgo = withNotes(['2026-07-01'])
    // 61 days: overdue weekly and monthly, comfortably inside a quarter.
    expect(reviewStatus(twoMonthsAgo, 'Weekly', TODAY).state).toBe('stale')
    expect(reviewStatus(twoMonthsAgo, 'Monthly', TODAY).state).toBe('stale')
    expect(reviewStatus(twoMonthsAgo, 'Quarterly', TODAY).state).toBe('fresh')
    expect(reviewStatus(twoMonthsAgo, 'Yearly', TODAY).state).toBe('fresh')
  })

  test('a month is thirty days, not four weeks', () => {
    // 29 days ago is still inside a monthly interval; 4 weeks would not be.
    expect(reviewStatus(withNotes(['2026-08-02']), 'Monthly', TODAY).state).toBe('fresh')
    // 31 days ago has passed it.
    expect(reviewStatus(withNotes(['2026-07-31']), 'Monthly', TODAY).state).toBe(
      'slipping',
    )
  })

  test('every cadence has an interval, so none silently does nothing', () => {
    for (const cadence of CADENCES) {
      const review = reviewStatus(withNotes(['2020-01-01']), cadence, TODAY)
      expect(review.intervalDays).toBeGreaterThan(0)
      expect(review.state).toBe('stale')
    }
  })

  test('reports never reviewed rather than guessing', () => {
    const review = reviewStatus({ status: 'In Progress' }, 'Weekly', TODAY)
    expect(review.state).toBe('never')
    expect(review.lastReviewed).toBeNull()
  })

  test('treats a future note as fresh, not stale', () => {
    expect(reviewStatus(withNotes(['2026-12-01']), 'Weekly', TODAY).state).toBe('fresh')
  })
})

describe('what is exempt', () => {
  /**
   * Flagging finished work as overdue would only teach people to ignore the
   * indicator.
   */
  test('completed and aborted key results', () => {
    for (const status of ['Completed', 'Aborted']) {
      const review = reviewStatus(withNotes(['2020-01-01'], status), 'Weekly', TODAY)
      expect(review.state).toBe('exempt')
    }
  })

  test('an initiative with no cadence set, or one nobody recognises', () => {
    expect(reviewStatus(withNotes(['2020-01-01']), undefined, TODAY).state).toBe('exempt')
    expect(reviewStatus(withNotes(['2020-01-01']), 'Fortnightly', TODAY).state).toBe(
      'exempt',
    )
  })
})

describe('the summary', () => {
  test('says when and against what', () => {
    expect(reviewSummary(reviewStatus(withNotes(['2026-08-30']), 'Weekly', TODAY), 'Weekly'))
      .toBe('Reviewed yesterday, within the weekly interval.')
    expect(reviewSummary(reviewStatus(withNotes(['2026-08-01']), 'Weekly', TODAY), 'Weekly'))
      .toBe('Reviewed 30 days ago — overdue a weekly review.')
    expect(reviewSummary(reviewStatus({ status: 'In Progress' }, 'Weekly', TODAY), 'Weekly'))
      .toBe('Never reviewed. Weekly review expected.')
  })

  test('is empty when exempt, so nothing is rendered', () => {
    expect(reviewSummary(reviewStatus(withNotes([]), undefined, TODAY), undefined)).toBe('')
  })
})
