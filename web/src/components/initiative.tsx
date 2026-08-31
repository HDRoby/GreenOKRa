'use client'

import { initiativePath, statusOptions } from '@/lib/edit.ts'
import {
  type PersonFilter,
  ownsInitiative,
  visibleObjectives,
} from '@/lib/filter.ts'
import type { Pools } from '@/lib/labels.ts'
import { type Initiative, initiativeProgress } from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import {
  AddButton,
  EnumSelect,
  ProgressBar,
  Reference,
  TextField,
  TimeframeSelect,
} from './fields.tsx'
import { LabelPicker } from './label-picker.tsx'
import { ObjectiveCard } from './objective.tsx'

/** The contents of one initiative tab: its own details, then its objectives. */
export function InitiativeCard({
  initiative,
  index,
  pools,
  person,
  editor,
}: {
  initiative: Initiative
  index: number
  pools: Pools
  person: PersonFilter
  editor: Editor
}) {
  const path = initiativePath(index)
  const id = initiative.id ?? '?'
  // Owning the initiative makes everything under it relevant.
  const revealsAll = ownsInitiative(initiative, person)
  const objectives = visibleObjectives(initiative.objectives ?? [], person, revealsAll)

  return (
    <article className="space-y-4">
      <header className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <Reference id={id} className="mt-1.5 !bg-accent-dim/25 !text-ink" />

          <div className="min-w-0 flex-1">
            <TextField
              value={initiative.title ?? ''}
              placeholder="Initiative name"
              onCommit={(value) => editor.setInitiative(path, 'title', value)}
              className="text-lg font-semibold"
            />
            <TextField
              multiline
              value={initiative.description ?? ''}
              placeholder="What this initiative is for (optional)"
              onCommit={(value) => editor.setInitiative(path, 'description', value, false)}
              className="mt-0.5 text-sm text-ink-muted"
            />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <EnumSelect
              label={`${id} status`}
              value={initiative.status ?? ''}
              options={statusOptions(initiative.status)}
              onChange={(value) => editor.setInitiative(path, 'status', value)}
            />
            <ProgressBar progress={initiativeProgress(initiative)} width="w-28" />
          </div>
        </div>

        <dl className="mt-3 grid gap-x-8 gap-y-1 border-t border-line/60 pt-3 text-xs sm:grid-cols-3">
          <Detail label="owner">
            {/* One name, held as a plain string in the file rather than a list,
                but picked from the same pool as every other owner field. */}
            <LabelPicker
              values={initiative.owner ? [initiative.owner] : []}
              known={pools.people}
              multiple={false}
              label={`${id} owner`}
              highlight={person}
              onChange={(names) =>
                editor.setInitiative(path, 'owner', names[0] ?? '')
              }
            />
          </Detail>
          <Detail label="timeframe">
            <TimeframeSelect
              value={initiative.timeframe ?? ''}
              onChange={(value) => editor.setInitiative(path, 'timeframe', value)}
            />
          </Detail>
          <Detail label="review cadence">
            <TextField
              value={initiative.review_cadence ?? ''}
              placeholder="e.g. monthly review"
              onCommit={(value) =>
                editor.setInitiative(path, 'review_cadence', value, false)
              }
              className="text-ink-muted"
            />
          </Detail>
        </dl>
      </header>

      <div className="space-y-3">
        {objectives.map(({ item: objective, index: objectiveIndex }) => (
          <ObjectiveCard
            key={objective.id ?? objectiveIndex}
            objective={objective}
            initiativeId={id}
            initiativeIndex={index}
            objectiveIndex={objectiveIndex}
            timeframe={initiative.timeframe}
            pools={pools}
            person={person}
            inherited={revealsAll}
            editor={editor}
          />
        ))}
        <AddButton label="Objective" onClick={() => editor.addObjective(path)} />
      </div>
    </article>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="shrink-0 text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}
