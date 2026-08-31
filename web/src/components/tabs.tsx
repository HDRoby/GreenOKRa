'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import {
  type Indexed,
  type PersonFilter,
  ownsInitiative,
  ownsObjective,
  visibleKeyResults,
  visibleObjectives,
} from '@/lib/filter.ts'
import {
  type Initiative,
  type Objective,
  decidedStatus,
  formatProgress,
  initiativeProgress,
  objectiveProgress,
} from '@/lib/okr.ts'

import { textToneFor } from './fields.tsx'

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
}: {
  /** Carrying their true positions, which may not be contiguous when filtered. */
  initiatives: Indexed<Initiative>[]
  active: number
  /** So the objective count matches what opening the tab will actually show. */
  person: PersonFilter
  onSelect: (index: number) => void
  onAdd: (id: string, title: string, timeframe: string) => void
}) {
  const [adding, setAdding] = useState(false)

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
      </div>

      {adding && (
        <NewInitiative
          onAdd={(id, title, timeframe) => {
            onAdd(id, title, timeframe)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * One tab per objective, inside the selected initiative.
 *
 * Same reasoning a level down: an objective carries a list of key results, and
 * stacking several of those makes a page nobody scrolls to the bottom of.
 */
export function ObjectiveTabs({
  objectives,
  active,
  person,
  inherited,
  onSelect,
  onAdd,
}: {
  objectives: Indexed<Objective>[]
  active: number
  person: PersonFilter
  /** True when the initiative itself is the filtered person's. */
  inherited: boolean
  onSelect: (index: number) => void
  onAdd: () => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Objectives"
      className="flex items-stretch gap-1 overflow-x-auto border-b border-line/70"
    >
      {objectives.map(({ item: objective, index }) => {
        const keyResults = visibleKeyResults(
          objective.key_results ?? [],
          person,
          inherited || ownsObjective(objective, person),
        ).length

        return (
          <TabButton
            key={objective.id ?? index}
            label={objective.title || 'Untitled'}
            count={keyResults}
            countLabel={plural(keyResults, 'key result')}
            progress={objectiveProgress(objective)}
            status={objective.status}
            selected={index === active}
            title={`${objective.id ?? '?'} — ${plural(keyResults, 'key result')}`}
            weight="secondary"
            onClick={() => onSelect(index)}
          />
        )
      })}

      <button
        type="button"
        onClick={onAdd}
        aria-label="New objective"
        title="New objective"
        className="ml-1 shrink-0 self-center rounded-md border border-line p-1
          text-ink-faint hover:border-accent-dim hover:text-accent"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

/** New initiatives need an id up front, since ids are permanent. */
function NewInitiative({
  onAdd,
}: {
  onAdd: (id: string, title: string, timeframe: string) => void
}) {
  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const valid = /^[A-Za-z]{2,5}$/.test(id.trim()) && title.trim() !== ''

  const add = () => {
    if (!valid) return
    onAdd(id, title, timeframe.trim() || String(new Date().getFullYear()))
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-line p-3">
      <input
        autoFocus
        value={id}
        onChange={(event) => setId(event.target.value.toUpperCase())}
        placeholder="ID"
        maxLength={5}
        title="Two to five letters, e.g. TEK"
        className="field w-16 font-mono text-sm uppercase"
      />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New strategic initiative"
        onKeyDown={(event) => event.key === 'Enter' && add()}
        className="field flex-1 text-sm"
      />
      <input
        value={timeframe}
        onChange={(event) => setTimeframe(event.target.value)}
        placeholder="2026"
        onKeyDown={(event) => event.key === 'Enter' && add()}
        className="field w-20 text-sm"
      />
      <button
        onClick={add}
        disabled={!valid}
        className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5
          py-1 text-xs enabled:hover:border-accent-dim disabled:opacity-40"
      >
        <Plus size={12} />
        Add
      </button>
    </div>
  )
}
