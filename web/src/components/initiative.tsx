'use client'

import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'

import { initiativePath } from '@/lib/edit.ts'
import { type Initiative, STATUSES, initiativeProgress } from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import { EnumSelect, ProgressBar, Reference, TextField } from './fields.tsx'
import { ObjectiveCard } from './objective.tsx'

export function InitiativeCard({
  initiative,
  index,
  editor,
}: {
  initiative: Initiative
  index: number
  editor: Editor
}) {
  const [open, setOpen] = useState(true)
  const path = initiativePath(index)
  const id = initiative.id ?? '?'
  const objectives = initiative.objectives ?? []

  return (
    <article className="rounded-xl border border-line bg-canvas">
      <header className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="mt-1 text-ink-faint hover:text-ink"
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </button>

        <Reference id={id} className="mt-0.5 !text-ink !bg-accent-dim/25" />

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

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
            <label className="flex items-center gap-1">
              owner
              <TextField
                value={initiative.owner ?? ''}
                placeholder="who is accountable"
                onCommit={(value) => editor.setInitiative(path, 'owner', value)}
                className="w-40 text-ink-muted"
              />
            </label>
            <label className="flex items-center gap-1">
              timeframe
              <TextField
                value={initiative.timeframe ?? ''}
                placeholder="2026"
                onCommit={(value) => editor.setInitiative(path, 'timeframe', value)}
                className="w-24 text-ink-muted"
              />
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-1">
              review
              <TextField
                value={initiative.review_cadence ?? ''}
                placeholder="e.g. monthly review, quarterly sponsor review"
                onCommit={(value) =>
                  editor.setInitiative(path, 'review_cadence', value, false)
                }
                className="text-ink-muted"
              />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <EnumSelect
            label={`${id} status`}
            value={initiative.status ?? ''}
            options={STATUSES}
            onChange={(value) => editor.setInitiative(path, 'status', value)}
          />
          <ProgressBar progress={initiativeProgress(initiative)} width="w-28" />
        </div>
      </header>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {objectives.map((objective, objectiveIndex) => (
            <ObjectiveCard
              key={objective.id ?? objectiveIndex}
              objective={objective}
              initiativeId={id}
              initiativeIndex={index}
              objectiveIndex={objectiveIndex}
              editor={editor}
            />
          ))}
          <button
            type="button"
            onClick={() => editor.addObjective(path)}
            className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
          >
            <Plus size={12} />
            Objective
          </button>
        </div>
      )}
    </article>
  )
}
