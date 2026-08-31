'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import {
  type Indexed,
  type PersonFilter,
  ownsInitiative,
  visibleObjectives,
} from '@/lib/filter.ts'
import { type Initiative, formatProgress, initiativeProgress } from '@/lib/okr.ts'

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
          const selected = index === active
          // Count what the tab will actually show, not the whole initiative,
          // so the badge does not promise objectives the filter has hidden.
          const objectives = visibleObjectives(
            initiative.objectives ?? [],
            person,
            ownsInitiative(initiative, person),
          ).length

          return (
            <button
              key={initiative.id ?? index}
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(index)}
              // The id is dropped from the label to keep it short, but stays
              // reachable on hover — it is what tickets and notes refer to.
              title={`${initiative.id ?? '?'} — ${objectives} ${
                objectives === 1 ? 'objective' : 'objectives'
              }`}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm
                transition-colors
                ${
                  selected
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-muted hover:border-line hover:text-ink'
                }`}
            >
              <span className={selected ? 'font-medium' : ''}>
                {initiative.title || 'Untitled'}
              </span>
              <span
                aria-label={`${objectives} objectives`}
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full
                  px-1.5 text-[11px] tabular-nums
                  ${
                    selected
                      ? 'bg-accent-dim/35 text-ink'
                      : 'bg-surface-raised text-ink-faint'
                  }`}
              >
                {objectives}
              </span>
              <span className="tabular-nums text-xs text-ink-faint">
                {formatProgress(initiativeProgress(initiative))}
              </span>
            </button>
          )
        })}

        <button
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
