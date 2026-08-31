'use client'

import { ChevronDown, Users } from 'lucide-react'

import { EVERYONE, type PersonFilter } from '@/lib/filter.ts'
import { labelTint } from '@/lib/labels.ts'

const ALL = 'All'

const WHAT_IT_DOES =
  'Show only the initiatives, objectives and key results this person owns, ' +
  'is accountable for, or is responsible for.'

/**
 * Narrow the whole view to one person's work.
 *
 * The control says in words what it is about to do, and what it is doing now —
 * "showing" alone does not tell anyone whether it hides things, or on what
 * basis. While filtering, it fills with that person's colour, the one their
 * chips use as a border, so it is obvious the page holds a subset and whose.
 */
export function PersonFilterSelect({
  people,
  person,
  onChange,
}: {
  people: string[]
  person: PersonFilter
  onChange: (person: PersonFilter) => void
}) {
  const filtering = person !== EVERYONE
  // Keep a name selectable even if it has just lost its last owning role, so
  // the control never displays something that is not in its own list.
  const options = filtering && !people.includes(person) ? [person, ...people] : people

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
      <span>showing</span>

      <div className="relative inline-flex">
        <select
          aria-label="Show only one person's work"
          title={WHAT_IT_DOES}
          value={person ?? ALL}
          onChange={(event) =>
            onChange(event.target.value === ALL ? EVERYONE : event.target.value)
          }
          style={filtering ? labelTint(person, true) : undefined}
          className={`appearance-none cursor-pointer rounded-full border py-0.5 pr-6 pl-6
            text-xs focus:outline-none focus:ring-1 focus:ring-accent-dim
            ${filtering ? 'font-medium' : 'border-line bg-surface-raised text-ink-muted'}`}
        >
          <option value={ALL} className="bg-surface text-ink">
            Everyone
          </option>
          {options.map((name) => (
            <option key={name} value={name} className="bg-surface text-ink">
              {name}
            </option>
          ))}
        </select>
        <Users
          size={11}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 opacity-70"
        />
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60"
        />
      </div>

      <span>
        {filtering
          ? `— only what ${person} owns, is accountable or responsible for`
          : '— everything in the file'}
      </span>
    </div>
  )
}
