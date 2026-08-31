'use client'

import { Users } from 'lucide-react'

import { EVERYONE, type PersonFilter } from '@/lib/filter.ts'
import { personKey, personLabel } from '@/lib/labels.ts'
import type { Person } from '@/lib/okr.ts'

import { Dropdown, type DropdownOption } from './dropdown.tsx'
import { CHIP_PLAIN } from './person-picker.tsx'

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
  people: Person[]
  person: PersonFilter
  onChange: (person: PersonFilter) => void
}) {
  const filtering = person !== EVERYONE
  const chosen = people.find((candidate) => personKey(candidate) === person)
  // Keep the selection listed even if that person has just lost their last
  // owning role, so the control never displays something absent from its list.
  const listed =
    filtering && !chosen ? [{ name: person }, ...people] : people

  const peopleOptions: DropdownOption[] = [
    { value: ALL, label: ALL },
    ...listed.map((candidate) => ({
      value: personKey(candidate),
      label: personLabel(candidate),
      // The same chip the person wears throughout the file.
      chipClassName: CHIP_PLAIN,
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
        triggerClassName={`cursor-pointer rounded-full border py-0.5 pr-1.5 pl-2 text-xs
          focus:outline-none focus:ring-1 focus:ring-accent-dim
          ${
            filtering
              ? 'border-accent bg-accent-dim/40 font-medium text-ink'
              : 'border-line bg-surface-raised text-ink-muted'
          }`}
      />

      <span>
        {filtering
          ? `— only what ${personLabel(chosen ?? { name: person })} owns, is accountable or responsible for`
          : '— everything in the file'}
      </span>
    </div>
  )
}
