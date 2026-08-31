'use client'

import { ExternalLink, Link2, Plus, X } from 'lucide-react'

import { type Path, keyResultPath } from '@/lib/edit.ts'
import { STATUSES, type Objective, objectiveProgress } from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import { EnumSelect, NameList, ProgressBar, Reference, TextField } from './fields.tsx'
import { KeyResultRow } from './key-result.tsx'

export function ObjectiveCard({
  objective,
  initiativeId,
  initiativeIndex,
  objectiveIndex,
  editor,
}: {
  objective: Objective
  initiativeId: string
  initiativeIndex: number
  objectiveIndex: number
  editor: Editor
}) {
  const path: Path = ['strategic_initiatives', initiativeIndex, 'objectives', objectiveIndex]
  const reference = `${initiativeId}.${objective.id ?? '?'}`
  const links = objective.links ?? []

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
            <label className="flex items-center gap-1">
              theme
              <TextField
                value={objective.theme ?? ''}
                placeholder="none"
                onCommit={(value) => editor.setObjective(path, 'theme', value, false)}
                className="w-48 text-ink-muted"
              />
            </label>
            <label className="flex items-center gap-1">
              owners
              <NameList
                names={objective.owners ?? []}
                placeholder="from key results"
                onCommit={(names) => editor.setObjectiveOwners(path, names)}
              />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EnumSelect
            label={`${reference} status`}
            value={objective.status ?? ''}
            options={STATUSES}
            onChange={(value) => editor.setObjective(path, 'status', value)}
          />
          <ProgressBar progress={objectiveProgress(objective)} />
        </div>
      </header>

      {links.length > 0 && (
        <div className="space-y-1 px-4 pb-2">
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
              {link.url && (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-ink-faint hover:text-accent"
                  aria-label="Open link"
                >
                  <ExternalLink size={12} />
                </a>
              )}
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
        </div>
      )}

      <div>
        {(objective.key_results ?? []).map((keyResult, index) => (
          <KeyResultRow
            key={keyResult.id ?? index}
            keyResult={keyResult}
            reference={`${reference}.${keyResult.id ?? '?'}`}
            path={keyResultPath(initiativeIndex, objectiveIndex, index)}
            editor={editor}
          />
        ))}
      </div>

      <footer className="flex gap-4 border-t border-line/60 px-4 py-2">
        <button
          type="button"
          onClick={() => editor.addKeyResult(path)}
          className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
        >
          <Plus size={12} />
          Key result
        </button>
        <button
          type="button"
          onClick={() => editor.addLink(path)}
          className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
        >
          <Plus size={12} />
          Link
        </button>
      </footer>
    </section>
  )
}
