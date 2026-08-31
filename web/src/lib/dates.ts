/**
 * Target dates are either a period label (`Q3`, `H2`) or a real date.
 *
 * A label is what people actually agree in a review, so it stays the stored
 * value. The concrete date it implies is derived from the initiative's
 * timeframe and shown alongside, never written to the file — the same rule the
 * format applies to percentages.
 */

export const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2'] as const
export type Period = (typeof PERIODS)[number]

/** The last day of each period: what "due Q3" actually means. */
const PERIOD_END: Record<Period, [number, number]> = {
  Q1: [3, 31],
  Q2: [6, 30],
  Q3: [9, 30],
  Q4: [12, 31],
  H1: [6, 30],
  H2: [12, 31],
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isDate(value: string): boolean {
  return ISO_DATE.test(value.trim())
}

/** Match a period label leniently, so `q3` and `Q3` are the same thing. */
export function periodOf(value: string): Period | null {
  const key = value.trim().toUpperCase()
  return PERIODS.find((period) => period === key) ?? null
}

/** The year an initiative runs in: `2026`, `2026-Q3` and `H1-2026` all give 2026. */
export function yearOf(timeframe: string | undefined): number | null {
  const found = timeframe?.match(/\d{4}/)
  return found ? Number(found[0]) : null
}

/**
 * The concrete date a target date implies, as `YYYY/MM/DD`.
 *
 * Null when it cannot be worked out — an unrecognised label, or a period with
 * no year to anchor it to.
 */
export function resolveDate(
  value: string | undefined,
  timeframe: string | undefined,
): string | null {
  if (!value) return null
  if (isDate(value)) return value.trim().replace(/-/g, '/')

  const period = periodOf(value)
  const year = yearOf(timeframe)
  if (!period || year === null) return null

  const [month, day] = PERIOD_END[period]
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

/**
 * An initiative's timeframe is a year, optionally narrowed to a half or a
 * quarter: `2026`, `2026.H1`, `2026.Q3`.
 */
export const TIMEFRAME_SUFFIXES = ['', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4'] as const

export interface TimeframeGroup {
  year: number
  values: string[]
}

/** Timeframes to offer: this year and next, each as a year, half or quarter. */
export function timeframeGroups(fromYear: number, years = 2): TimeframeGroup[] {
  return Array.from({ length: years }, (_, offset) => {
    const year = fromYear + offset
    return {
      year,
      values: TIMEFRAME_SUFFIXES.map((suffix) =>
        suffix === '' ? String(year) : `${year}.${suffix}`,
      ),
    }
  })
}

/** The half or quarter a timeframe narrows to, if it narrows at all. */
export function timeframePeriod(timeframe: string | undefined): Period | null {
  const found = timeframe?.match(/[.\-\s]([QH][1-4])$/i)
  return found?.[1] ? periodOf(found[1]) : null
}

/** The ISO form of a period's last day, for switching a label to a real date. */
export function periodEndIso(
  value: string | undefined,
  timeframe: string | undefined,
): string | null {
  const resolved = resolveDate(value, timeframe)
  return resolved ? resolved.replace(/\//g, '-') : null
}
