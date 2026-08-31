'use client'

import { ExternalLink, Link2, X } from 'lucide-react'

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
import { LabelPicker } from './label-picker.tsx'
import { KeyResultRow } from './key-result.tsx'

export function ObjectiveCard({
  objective,
  initiativeId,
  initiativeIndex,
  objectiveIndex,
  timeframe,
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
              <LabelPicker
                values={objective.owners ?? []}
                known={pools.people}
                multiple
                label={`${reference} owners`}
                highlight={person}
                onChange={(names) => editor.setObjectiveOwners(path, names)}
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
          <div key={index} className="flex items-center gap-2 text-xs">
            <Link2 size={12} className="shrink-0 text-ink-faint" />
            <TextField
              value={link.title ?? ''}
              placeholder="Title"
              onCommit={(value) => editor.setLink(path, index, 'title', value)}
              className="w-56 text-ink-muted"
            />
            <TextField
              value={link.url ?? ''}
              placeholder="https://…"
              onCommit={(value) => editor.setLink(path, index, 'url', value)}
              className="min-w-0 flex-1 font-mono text-ink-faint"
            />
            <FollowLink url={link.url} />
            <button
              type="button"
              onClick={() => editor.removeLink(path, index)}
              className="shrink-0 text-ink-faint hover:text-dropped"
              aria-label="Remove link"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <AddButton label="Link" onClick={() => editor.addLink(path)} />
      </div>

      <div>
        {keyResults.map(({ item: keyResult, index }) => (
          <KeyResultRow
            key={keyResult.id ?? index}
            keyResult={keyResult}
            reference={`${reference}.${keyResult.id ?? '?'}`}
            path={keyResultPath(initiativeIndex, objectiveIndex, index)}
            timeframe={timeframe}
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

/**
 * Opens the page in a new tab.
 *
 * Rendered whether or not there is a URL, so the row does not reflow as one is
 * typed, but inert until the address is something a browser can actually
 * follow. An anchor with no usable href would look live and do nothing.
 */
function FollowLink({ url }: { url: string | undefined }) {
  const target = url?.trim() ?? ''
  const followable = /^https?:\/\/\S+$/i.test(target)

  if (!followable) {
    return (
      <span
        title={
          target === ''
            ? 'Add a URL to follow this link'
            : 'Needs to start with http:// or https:// to be followable'
        }
        className="shrink-0 cursor-not-allowed text-ink-faint opacity-40"
        aria-disabled="true"
      >
        <ExternalLink size={12} />
      </span>
    )
  }

  return (
    <a
      href={target}
      target="_blank"
      rel="noreferrer noopener"
      title={`Open ${target} in a new tab`}
      aria-label="Open link in a new tab"
      className="shrink-0 text-ink-faint hover:text-accent"
    >
      <ExternalLink size={12} />
    </a>
  )
}
