'use client'

import { Users } from 'lucide-react'

import { EVERYONE, type PersonFilter } from '@/lib/filter.ts'
import { labelTint } from '@/lib/labels.ts'

import { Dropdown, type DropdownOption } from './dropdown.tsx'

const ALL = 'Everyone'

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

  const peopleOptions: DropdownOption[] = [
    { value: ALL, label: ALL },
    ...options.map((name) => ({
      value: name,
      label: name,
      // The same chip the person wears throughout the file.
      chipClassName: 'inline-block rounded-full border px-2 py-0.5 text-xs',
      chipStyle: labelTint(name),
    })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
      <span>showing</span>

      <Dropdown
        value={person ?? ALL}
        options={peopleOptions}
        onChange={(next) => onChange(next === ALL ? EVERYONE : next)}
        label={WHAT_IT_DOES}
        icon={<Users size={11} className="shrink-0 opacity-70" />}
        triggerStyle={filtering ? labelTint(person, true) : undefined}
        triggerClassName={`cursor-pointer rounded-full border py-0.5 pr-1.5 pl-2 text-xs
          focus:outline-none focus:ring-1 focus:ring-accent-dim
          ${filtering ? 'font-medium' : 'border-line bg-surface-raised text-ink-muted'}`}
      />

      <span>
        {filtering
          ? `— only what ${person} owns, is accountable or responsible for`
          : '— everything in the file'}
      </span>
    </div>
  )
}
