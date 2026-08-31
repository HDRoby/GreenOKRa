'use client'

import { ChevronDown } from 'lucide-react'

import { PERIODS, isDate, periodEndIso, periodOf, resolveDate } from '@/lib/dates.ts'
import { today } from '@/lib/file-access.ts'

const EXACT = 'Date'

/**
 * A target date is a period label or a real date.
 *
 * The label is what gets agreed in a review, so it is what the file stores.
 * The date it works out to is shown beside it in grey — derived, never written,
 * the same treatment percentages get.
 */
export function TargetDate({
  value,
  timeframe,
  onCommit,
  label,
}: {
  value: string
  timeframe: string | undefined
  onCommit: (value: string) => void
  label: string
}) {
  const exact = isDate(value)
  const period = periodOf(value)
  const selection = exact ? EXACT : (period ?? value)
  const resolved = resolveDate(value, timeframe)

  const choose = (choice: string) => {
    if (choice === EXACT) {
      // Start from the day the current period implies, rather than from nothing.
      onCommit(periodEndIso(value, timeframe) ?? today())
      return
    }
    onCommit(choice)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex">
        <select
          aria-label={label}
          value={selection}
          onChange={(event) => choose(event.target.value)}
          className="appearance-none cursor-pointer rounded-md border border-line
            bg-surface-raised py-0.5 pr-5 pl-2 text-xs text-ink-muted
            focus:outline-none focus:ring-1 focus:ring-accent-dim"
        >
          {!exact && !period && (
            <option value={value}>{value || '(not set)'}</option>
          )}
          {PERIODS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={EXACT}>Date…</option>
        </select>
        <ChevronDown
          size={11}
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-60"
        />
      </span>

      {exact ? (
        <input
          type="date"
          aria-label={`${label} date`}
          value={value}
          onChange={(event) => event.target.value && onCommit(event.target.value)}
          className="field w-32 font-mono text-xs text-ink-muted"
        />
      ) : (
        resolved && (
          <span
            title="The day this period ends"
            className="tabular-nums text-[11px] text-ink-faint"
          >
            {resolved}
          </span>
        )
      )}
    </span>
  )
}
