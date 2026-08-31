'use client'

import { Check, Mail, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { findPerson, personKey, personLabel } from '@/lib/labels.ts'
import type { Person } from '@/lib/okr.ts'

import { Dropdown, type DropdownOption } from './dropdown.tsx'

const NEW = ' new'
const CHIP =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs'

/**
 * Neutral, not per-person, but not faint either.
 *
 * A hue hashed from a name distinguishes nothing useful — the reader cannot
 * learn what a colour means, and eight names produce eight arbitrary ones. So
 * the box carries the emphasis instead: full-strength text and a border light
 * enough to read as a box against the card behind it. The only colour worth
 * spending is on the person being filtered on.
 */
export const CHIP_PLAIN = `${CHIP} border-ink-faint/45 bg-surface-raised text-ink`
const CHIP_HIGHLIGHT = `${CHIP} border-accent bg-accent-dim/50 text-ink`

/**
 * People as chips, picked from those already in the file.
 *
 * A person is a name and, where it is known, an address. The chip shows the
 * name; the address is behind the pencil, the way a link hides its URL. Editing
 * one updates that person everywhere in the file rather than only here, because
 * the address is their identity — correcting it in one key result and leaving
 * nineteen others wrong would be worse than not offering the edit.
 *
 * `multiple` is false where the field holds one person — accountable, an
 * initiative's owner — so choosing replaces rather than appends.
 */
export function PersonPicker({
  identities,
  known,
  multiple,
  clearable = false,
  label,
  placeholder = '(not set)',
  highlight,
  onChange,
  onEditPerson,
  onAddPerson,
}: {
  /** Who is named here, as references into the roster. */
  identities: string[]
  /** The roster: everyone the file defines. */
  known: Person[]
  multiple: boolean
  clearable?: boolean
  label: string
  placeholder?: string
  /** Identity of the person being filtered on, filled in solid. */
  highlight?: string | null
  onChange: (identities: string[]) => void
  /** Correct this person in the roster; references follow. */
  onEditPerson: (identity: string, person: Person) => void
  /** Put somebody new in the roster, returning how to refer to them. */
  onAddPerson: (person: Person) => string
}) {
  const [mode, setMode] = useState<'idle' | 'pick' | 'new'>('idle')
  const [editing, setEditing] = useState<string | null>(null)

  const held = new Set(identities)
  const available = known.filter((person) => !held.has(personKey(person)))
  const removable = multiple || clearable

  const addKnown = (identity: string) => {
    setMode('idle')
    if (!identity || held.has(identity)) return
    onChange(multiple ? [...identities, identity] : [identity])
  }

  const addNew = (person: Person) => {
    setMode('idle')
    if (!person.name?.trim() && !person.email?.trim()) return
    addKnown(onAddPerson(person))
  }

  const start = () => setMode(available.length > 0 ? 'pick' : 'new')

  const beingEdited = editing === null ? undefined : findPerson(known, editing)
  if (beingEdited) {
    return (
      <PersonForm
        person={beingEdited}
        label={label}
        onCancel={() => setEditing(null)}
        onSave={(updated) => {
          onEditPerson(personKey(beingEdited), updated)
          setEditing(null)
        }}
      />
    )
  }

  if (mode === 'new') {
    return (
      <PersonForm
        person={{}}
        label={label}
        onCancel={() => setMode('idle')}
        onSave={addNew}
      />
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {identities.map((identity) => {
        // A reference the roster does not know is shown as itself, so a
        // hand-broken file is legible rather than blank.
        const person = findPerson(known, identity) ?? { name: identity }
        return (
          <span
            key={identity}
            title={
              person.email
                ? `${personLabel(person)} — ${person.email}`
                : personLabel(person)
            }
            className={`group ${identity === highlight ? CHIP_HIGHLIGHT : CHIP_PLAIN}`}
          >
            {personLabel(person)}
            {person.email && <Mail size={9} className="opacity-60" />}
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-70">
              <button
                type="button"
                onClick={() => setEditing(identity)}
                aria-label={`Edit ${personLabel(person)}`}
                className="hover:!opacity-100"
              >
                <Pencil size={9} />
              </button>
              {removable && (
                <button
                  type="button"
                  onClick={() =>
                    onChange(identities.filter((other) => other !== identity))
                  }
                  aria-label={`Remove ${personLabel(person)} from ${label}`}
                  className="hover:!opacity-100"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          </span>
        )
      })}

      {mode === 'idle' && (identities.length === 0 || multiple) && (
        <button
          type="button"
          onClick={start}
          aria-label={`Add to ${label}`}
          title={`Add to ${label}`}
          className="rounded-full border border-dashed border-line p-0.5 text-ink-faint
            hover:border-accent-dim hover:text-accent"
        >
          <Plus size={11} />
        </button>
      )}

      {mode === 'pick' && (
        <Dropdown
          defaultOpen
          value=""
          options={optionsFor(available)}
          onChange={(chosen) => {
            if (chosen === NEW) {
              setMode('new')
              return
            }
            addKnown(chosen)
          }}
          onClose={() => setMode((current) => (current === 'pick' ? 'idle' : current))}
          label={`Choose ${label}`}
          placeholder="Choose…"
          triggerClassName="cursor-pointer rounded-md border border-line bg-surface px-1.5
            py-0.5 text-xs text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent-dim"
        />
      )}

      {identities.length === 0 && mode === 'idle' && (
        <span className="text-xs italic text-ink-faint">{placeholder}</span>
      )}
    </div>
  )
}

function optionsFor(people: Person[]): DropdownOption[] {
  return [
    ...people.map((person) => ({
      value: personKey(person),
      label: person.email
        ? `${personLabel(person)} · ${person.email}`
        : personLabel(person),
      chipClassName: CHIP_PLAIN,
    })),
    { value: NEW, label: 'New person…' },
  ]
}

/** Name and address as two labelled fields, the same shape a link edits in. */
function PersonForm({
  person,
  label,
  onSave,
  onCancel,
}: {
  person: Person
  label: string
  onSave: (person: Person) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(person.name ?? '')
  const [email, setEmail] = useState(person.email ?? '')

  const save = () => {
    if (!name.trim() && !email.trim()) {
      onCancel()
      return
    }
    onSave({ name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) })
  }

  return (
    <div className="space-y-1 rounded-md border border-accent-dim/50 bg-canvas p-2">
      <label className="flex items-center gap-2 text-xs text-ink-faint">
        <span className="w-12 shrink-0 text-right">name</span>
        <input
          autoFocus
          value={name}
          placeholder="Who it is"
          aria-label={`Name for ${label}`}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') onCancel()
          }}
          className="field text-ink-muted"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-ink-faint">
        <span className="w-12 shrink-0 text-right">email</span>
        <input
          value={email}
          placeholder="optional, but it is what lasts"
          aria-label={`Email for ${label}`}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') onCancel()
          }}
          className="field font-mono text-ink-muted"
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-ink-faint hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
        >
          <Check size={12} />
          Done
        </button>
      </div>
    </div>
  )
}
