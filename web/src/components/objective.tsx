'use client'

import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { type Path, keyResultPath, statusOptions } from '@/lib/edit.ts'
import { type PersonFilter, ownsObjective, visibleKeyResults } from '@/lib/filter.ts'
import type { Pools } from '@/lib/labels.ts'
import { type Objective, objectiveProgress } from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import {
  AddButton,
  EnumSelect,
  ProgressBar,
  Reference,
  StatusBar,
  TextField,
} from './fields.tsx'
import { DeleteButton } from './delete-button.tsx'
import { KeyResultRow } from './key-result.tsx'
import { LabelPicker } from './label-picker.tsx'
import { LinkRow } from './link-row.tsx'
import { PersonPicker } from './person-picker.tsx'

/**
 * One objective, collapsed to a row until opened — the same shape as a key
 * result, a level up.
 *
 * Tabs were the wrong container once there were more than a handful: a strip
 * that scrolls sideways hides most of what it holds, and an objective's title
 * is the one thing worth scanning down a page. A list shows all of them.
 */
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
  const initiativePath: Path = ['strategic_initiatives', initiativeIndex]
  const path: Path = [...initiativePath, 'objectives', objectiveIndex]
  const reference = `${initiativeId}.${objective.id ?? '?'}`
  const title = objective.title ?? ''
  // An objective that was just added has no title yet, so start it open.
  const [open, setOpen] = useState(() => title.trim() === '')
  const links = objective.links ?? []
  // Being named on the objective itself makes every key result under it
  // relevant, whether or not the name is repeated on each one.
  const revealsAll = inherited || ownsObjective(objective, person)
  const keyResults = visibleKeyResults(objective.key_results ?? [], person, revealsAll)

  return (
    <section className="rounded-lg border border-line bg-surface">
      {/* Nothing on the row is editable, so the whole of it opens the card. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <ChevronRight
          size={15}
          className={`shrink-0 text-ink-faint transition-transform
            ${open ? 'rotate-90' : ''}`}
        />
        {!open && (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">
              {title.trim() || <em className="text-ink-faint">Untitled</em>}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-ink-faint">
              {keyResults.length}
            </span>
            <StatusBar status={objective.status} />
          </>
        )}
      </button>

      {open && (
        <>
          <header className="px-4 pb-3 pl-[2.4rem]">
            <div className="flex items-center justify-between gap-3">
              <Reference id={reference} />
              <DeleteButton
                what={`Objective ${reference} and its key results`}
                onConfirm={() => editor.removeObjective(initiativePath, objectiveIndex)}
              />
            </div>

            {/* The bar reads against the title, which is what it measures —
                not against the id above it. */}
            <div className="mt-1 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <TextField
                  value={title}
                  placeholder="The qualitative goal — what we want to improve"
                  onCommit={(value) => editor.setObjective(path, 'title', value)}
                  className="font-medium"
                />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <EnumSelect
                  label={`${reference} status`}
                  value={objective.status ?? ''}
                  options={statusOptions(objective.status)}
                  onChange={(value) => editor.setObjective(path, 'status', value)}
                />
                <ProgressBar progress={objectiveProgress(objective)} />
              </div>
            </div>

            <div>
              <TextField
                multiline
                value={objective.description ?? ''}
                placeholder="Why this matters (optional)"
                onCommit={(value) =>
                  editor.setObjective(path, 'description', value, false)
                }
                className="mt-0.5 text-sm text-ink-muted"
              />

              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
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
                    identities={objective.owners ?? []}
                    known={pools.people}
                    multiple
                    label={`${reference} owners`}
                    highlight={person}
                    onChange={(chosen) => editor.setObjectiveOwners(path, chosen)}
                    onEditPerson={editor.editPerson}
                    onAddPerson={editor.addPerson}
                  />
                </span>
              </div>
            </div>
          </header>

          {/* Links belong with the objective's own detail, above its key
              results, and the way to add one belongs directly under them. */}
          <div className="space-y-1 px-4 pb-3 pl-[2.4rem]">
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
            {/* A quiet section label, so the rows below are not left
                unexplained once the objective's own detail is above them. */}
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
                objectivePath={path}
                index={index}
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
        </>
      )}
    </section>
  )
}
