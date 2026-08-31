'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import {
  type InitiativeDraft,
  NEW_INITIATIVE,
  statusOptions,
  thisYear,
} from '@/lib/edit.ts'
import {
  type Indexed,
  type PersonFilter,
  ownsInitiative,
  visibleObjectives,
} from '@/lib/filter.ts'
import {
  CADENCES,
  type Initiative,
  type Person,
  decidedStatus,
  formatProgress,
  initiativeProgress,
} from '@/lib/okr.ts'

import { EnumSelect, TimeframeSelect, textToneFor } from './fields.tsx'
import { PersonPicker } from './person-picker.tsx'

/**
 * One tab. Title, how many things are inside it, and how far along it is.
 *
 * Shared by both strips so an objective tab and an initiative tab cannot drift
 * apart; `weight` is the only difference, initiatives being the larger of the
 * two.
 */
function TabButton({
  label,
  count,
  countLabel,
  progress,
  status,
  selected,
  title,
  weight,
  onClick,
}: {
  label: string
  count: number
  countLabel: string
  progress: number | null
  status: string | undefined
  selected: boolean
  title: string
  weight: 'primary' | 'secondary'
  onClick: () => void
}) {
  // A decision taken is reported as such, in its own colour.
  const decided = decidedStatus(status)

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      title={title}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 border-b-2 transition-colors
        ${weight === 'primary' ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-xs'}
        ${
          selected
            ? 'border-accent text-ink'
            : 'border-transparent text-ink-muted hover:border-line hover:text-ink'
        }`}
    >
      <span className={selected ? 'font-medium' : ''}>{label}</span>
      <span
        aria-label={countLabel}
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full
          px-1.5 text-[11px] tabular-nums
          ${selected ? 'bg-accent-dim/35 text-ink' : 'bg-surface-raised text-ink-faint'}`}
      >
        {count}
      </span>
      <span
        className={
          decided
            ? `text-xs font-medium ${textToneFor(decided)}`
            : 'text-xs tabular-nums text-ink-faint'
        }
      >
        {decided ?? formatProgress(progress)}
      </span>
    </button>
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * One tab per strategic initiative. There are only ever a handful, and each
 * carries a whole tree, so tabs keep the page to one initiative at a time.
 */
export function InitiativeTabs({
  initiatives,
  active,
  person,
  onSelect,
  onAdd,
  people,
  onAddPerson,
}: {
  /** Carrying their true positions, which may not be contiguous when filtered. */
  initiatives: Indexed<Initiative>[]
  active: number
  /** So the objective count matches what opening the tab will actually show. */
  person: PersonFilter
  onSelect: (index: number) => void
  onAdd: (draft: InitiativeDraft) => void
  /** The roster, so the form can offer an owner. */
  people: Person[]
  onAddPerson: (person: Person) => string
}) {
  const [adding, setAdding] = useState(false)
  // A file with nothing in it needs no toggle: there is only one thing to do,
  // so the form is simply open. A `+` to hunt for is what made a new file feel
  // broken rather than empty.
  const empty = initiatives.length === 0

  return (
    <div className="mb-5">
      <div
        role="tablist"
        aria-label="Strategic initiatives"
        className="flex items-stretch gap-1 overflow-x-auto border-b border-line"
      >
        {initiatives.map(({ item: initiative, index }) => {
          // Count what the tab will actually show, not the whole initiative,
          // so the badge does not promise objectives the filter has hidden.
          const objectives = visibleObjectives(
            initiative.objectives ?? [],
            person,
            ownsInitiative(initiative, person),
          ).length

          return (
            <TabButton
              key={initiative.id ?? index}
              label={initiative.title || 'Untitled'}
              count={objectives}
              countLabel={plural(objectives, 'objective')}
              progress={initiativeProgress(initiative)}
              status={initiative.status}
              selected={index === active}
              // The id is dropped from the label to keep it short, but stays
              // reachable on hover — it is what tickets and notes refer to.
              title={`${initiative.id ?? '?'} — ${plural(objectives, 'objective')}`}
              weight="primary"
              onClick={() => onSelect(index)}
            />
          )
        })}

        {!empty && (
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            aria-label={adding ? 'Cancel new initiative' : 'New initiative'}
            title="New strategic initiative"
            className="ml-1 shrink-0 self-center rounded-md border border-line p-1
              text-ink-faint hover:border-accent-dim hover:text-accent"
          >
            {adding ? <X size={14} /> : <Plus size={14} />}
          </button>
        )}
      </div>

      {(adding || empty) && (
        <>
          {empty && (
            <p className="mt-4 text-sm text-ink-muted">
              Name your first strategic initiative — a short code to refer to it
              by, and what it is called.
            </p>
          )}
          <NewInitiative
            people={people}
            onAddPerson={onAddPerson}
            onAdd={(draft) => {
              onAdd(draft)
              setAdding(false)
            }}
          />
        </>
      )}
    </div>
  )
}

/**
 * Everything an initiative needs, asked for once.
 *
 * The card behind it can edit all of this too, but a record created half-blank
 * and corrected afterwards is a record somebody forgets to correct. The
 * defaults are the answers worth guessing; the id and the title are not.
 */
function NewInitiative({
  people,
  onAddPerson,
  onAdd,
}: {
  people: Person[]
  onAddPerson: (person: Person) => string
  onAdd: (draft: InitiativeDraft) => void
}) {
  const [draft, setDraft] = useState<InitiativeDraft>({
    id: '',
    title: '',
    description: '',
    status: NEW_INITIATIVE.status,
    owner: '',
    timeframe: thisYear(),
    cadence: NEW_INITIATIVE.cadence,
  })
  const set = (patch: Partial<InitiativeDraft>) =>
    setDraft((current) => ({ ...current, ...patch }))

  // The id is permanent and the title is the label; nothing else is worth
  // blocking on, since every field can be edited afterwards.
  const valid = /^[A-Za-z]{2,5}$/.test(draft.id.trim()) && draft.title.trim() !== ''

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-line p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={draft.id}
          onChange={(event) => set({ id: event.target.value.toUpperCase() })}
          placeholder="ID"
          maxLength={5}
          aria-label="Initiative id"
          title="Two to five letters, e.g. TEK. Permanent once written."
          className="field w-14 shrink-0 font-mono text-sm uppercase"
        />
        <input
          value={draft.title}
          onChange={(event) => set({ title: event.target.value })}
          onKeyDown={(event) => event.key === 'Enter' && valid && onAdd(draft)}
          placeholder="Title"
          aria-label="Initiative title"
          // The size it will be once saved, so the form shows what you are making.
          className="field flex-1 text-lg font-semibold"
        />
      </div>

      <textarea
        rows={2}
        value={draft.description}
        onChange={(event) => set({ description: event.target.value })}
        placeholder="What this initiative is for (optional)"
        aria-label="Initiative description"
        className="field resize-y text-sm text-ink-muted"
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          status
          <EnumSelect
            label="New initiative status"
            value={draft.status}
            options={statusOptions(draft.status)}
            onChange={(status) => set({ status })}
          />
        </span>
        <span className="flex items-center gap-1.5">
          owner
          <PersonPicker
            identities={draft.owner ? [draft.owner] : []}
            known={people}
            multiple={false}
            clearable
            label="New initiative owner"
            onChange={(chosen) => set({ owner: chosen[0] ?? '' })}
            onEditPerson={() => {}}
            onAddPerson={onAddPerson}
          />
        </span>
        <span className="flex items-center gap-1.5">
          timeframe
          <TimeframeSelect
            value={draft.timeframe}
            onChange={(timeframe) => set({ timeframe })}
          />
        </span>
        <span className="flex items-center gap-1.5">
          review cadence
          <EnumSelect
            label="New initiative review cadence"
            value={draft.cadence}
            options={CADENCES}
            onChange={(cadence) => set({ cadence })}
          />
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">
          Objectives are added afterwards.
        </span>
        <button
          type="button"
          onClick={() => valid && onAdd(draft)}
          disabled={!valid}
          className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5
            py-1 text-xs enabled:hover:border-accent-dim disabled:opacity-40"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  )
}
