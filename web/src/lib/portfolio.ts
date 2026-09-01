/**
 * Key results sorted into three bands, for the portfolio snapshot.
 *
 * Three, not six. Started, In Progress and In Completion all say the same
 * thing from this distance — somebody is working on it — and a bar cut six ways
 * at a glance tells you less than a bar cut three.
 *
 * A view's grouping rather than a format rule, so it lives here and not in
 * `okr.ts`. What it does take from the format is the ladder itself and the
 * standing rule that `Aborted` is set aside from rollups rather than scored
 * zero: abandoned work is not work outstanding, so it must not lengthen a bar.
 */

import { type KeyResult, STATUSES, canonical } from './okr.ts'

export const BANDS = ['Not Started', 'In Progress', 'Completed'] as const

export type Band = (typeof BANDS)[number]

/** Aborted is absent on purpose — it has no band. */
const BAND_OF: Record<string, Band> = {
  'Not Started': 'Not Started',
  Started: 'In Progress',
  'In Progress': 'In Progress',
  'In Completion': 'In Progress',
  Completed: 'Completed',
}

/** The band a status falls in, or null where it is not counted at all. */
export function bandOf(status: string | undefined): Band | null {
  const value = canonical(status, STATUSES)
  if (value === 'Aborted') return null
  // No status, or one nobody recognises, counts as not started. Dropping it
  // instead would shorten the bar and quietly deny the work exists, which is a
  // worse reading than assuming nobody has begun it.
  return (value === null ? undefined : BAND_OF[value]) ?? 'Not Started'
}

export interface Tally extends Record<Band, number> {
  /** The three bands added up: the length of the bar. */
  counted: number
  /** Set aside, and reported, so a short bar is explicable. */
  aborted: number
}

export function tally(keyResults: KeyResult[]): Tally {
  const totals: Tally = {
    'Not Started': 0,
    'In Progress': 0,
    Completed: 0,
    counted: 0,
    aborted: 0,
  }

  for (const keyResult of keyResults) {
    const band = bandOf(keyResult.status)
    if (band === null) {
      totals.aborted += 1
    } else {
      totals[band] += 1
      totals.counted += 1
    }
  }

  return totals
}
