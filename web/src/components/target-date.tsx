'use client'

import { PERIODS, isDate, periodEndIso, periodOf, resolveDate } from '@/lib/dates.ts'
import { today } from '@/lib/file-access.ts'

import { Dropdown, type DropdownOption } from './dropdown.tsx'

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

  const options: DropdownOption[] = [
    // A label the list does not recognise — "September", say — stays usable.
    ...(!exact && !period ? [{ value, label: value || '(not set)' }] : []),
    ...PERIODS.map((option) => ({ value: option, label: option })),
    { value: EXACT, label: 'Date…' },
  ]

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
      <Dropdown
        value={selection}
        options={options}
        onChange={choose}
        label={label}
        triggerClassName="cursor-pointer rounded-md border border-line bg-surface-raised
          py-0.5 pr-1.5 pl-2 text-xs text-ink-muted
          focus:outline-none focus:ring-1 focus:ring-accent-dim"
      />

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
