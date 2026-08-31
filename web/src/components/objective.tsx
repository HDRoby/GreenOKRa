'use client'

import { type Path, keyResultPath, statusOptions } from '@/lib/edit.ts'
import {
  type PersonFilter,
  ownsObjective,
  visibleKeyResults,
} from '@/lib/filter.ts'
import type { Pools } from '@/lib/labels.ts'
import { type Objective, objectiveProgress } from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import { AddButton, EnumSelect, ProgressBar, Reference, TextField } from './fields.tsx'
import { LinkRow } from './link-row.tsx'
import { LabelPicker } from './label-picker.tsx'
import { PersonPicker } from './person-picker.tsx'
import { KeyResultRow } from './key-result.tsx'

export function ObjectiveCard({
  objective,
  initiativeId,
  initiativeIndex,
  objectiveIndex,
  timeframe,
  cadence,
  pools,
  person,
  inherited,
  editor,
}: {
  objective: Objective
  initiativeId: string
  initiativeIndex: number
  objectiveIndex: number
  timeframe: string | undefined
  cadence: string | undefined
  pools: Pools
  person: PersonFilter
  /** True when the initiative above already matched, revealing everything. */
  inherited: boolean
  editor: Editor
}) {
  const path: Path = ['strategic_initiatives', initiativeIndex, 'objectives', objectiveIndex]
  const reference = `${initiativeId}.${objective.id ?? '?'}`
  const links = objective.links ?? []
  // Being named on the objective itself makes every key result under it
  // relevant, whether or not the name is repeated on each one.
  const revealsAll = inherited || ownsObjective(objective, person)
  const keyResults = visibleKeyResults(objective.key_results ?? [], person, revealsAll)

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-start gap-3 px-4 py-3">
        <Reference id={reference} className="mt-1" />

        <div className="min-w-0 flex-1">
          <TextField
            value={objective.title ?? ''}
            placeholder="The qualitative goal — what we want to improve"
            onCommit={(value) => editor.setObjective(path, 'title', value)}
            className="font-medium"
          />
          <TextField
            multiline
            value={objective.description ?? ''}
            placeholder="Why this matters (optional)"
            onCommit={(value) => editor.setObjective(path, 'description', value, false)}
            className="mt-0.5 text-sm text-ink-muted"
          />

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
            <span className="flex items-center gap-1.5">
              theme
              {/* One theme per objective, and optional, so it can be cleared. */}
              <LabelPicker
                values={objective.theme ? [objective.theme] : []}
                known={pools.themes}
                multiple={false}
                clearable
                label="theme"
                onChange={(themes) =>
                  editor.setObjective(path, 'theme', themes[0] ?? '', false)
                }
              />
            </span>
            <span className="flex items-center gap-1.5">
              owners
              <PersonPicker
                people={objective.owners ?? []}
                known={pools.people}
                multiple
                label={`${reference} owners`}
                highlight={person}
                onChange={(chosen) => editor.setObjectiveOwners(path, chosen)}
                onEditPerson={editor.editPerson}
              />
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EnumSelect
            label={`${reference} status`}
            value={objective.status ?? ''}
            options={statusOptions(objective.status)}
            onChange={(value) => editor.setObjective(path, 'status', value)}
          />
          <ProgressBar progress={objectiveProgress(objective)} />
        </div>
      </header>

      {/* Links belong with the objective's own detail, above its key results,
          and the way to add one belongs directly under them. */}
      <div className="space-y-1 px-4 pb-3">
        {links.map((link, index) => (
          <LinkRow
            key={index}
            link={link}
            onChange={(key, value) => editor.setLink(path, index, key, value)}
            onRemove={() => editor.removeLink(path, index)}
          />
        ))}
        <AddButton label="Link" onClick={() => editor.addLink(path)} />
      </div>

      <div>
        {/* A quiet section label, so the rows below are not left unexplained
            once the objective's own detail is above them. */}
        <h3
          className="border-t border-line/60 px-4 pt-2.5 pb-1 text-[11px]
            font-medium tracking-wide text-ink-faint uppercase"
        >
          Key Results
        </h3>
        {keyResults.map(({ item: keyResult, index }) => (
          <KeyResultRow
            key={keyResult.id ?? index}
            keyResult={keyResult}
            reference={`${reference}.${keyResult.id ?? '?'}`}
            path={keyResultPath(initiativeIndex, objectiveIndex, index)}
            timeframe={timeframe}
            cadence={cadence}
            people={pools.people}
            person={person}
            editor={editor}
          />
        ))}
      </div>

      <footer className="border-t border-line/60 px-4 py-2">
        <AddButton label="Key result" onClick={() => editor.addKeyResult(path)} />
      </footer>
    </section>
  )
}
