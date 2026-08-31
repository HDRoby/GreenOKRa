'use client'

import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'

import type { Path } from '@/lib/edit.ts'
import { today } from '@/lib/file-access.ts'
import {
  COMPLEXITIES,
  type KeyResult,
  PRIORITIES,
  RACI_ROLES,
  STATUSES,
  keyResultProgress,
} from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import { EnumSelect, NameList, ProgressBar, Reference, TextField } from './fields.tsx'

const ROLE_HINTS: Record<string, string> = {
  accountable: 'Owns the outcome — one person',
  responsible: 'Does the work',
  consulted: 'Asked before decisions',
  informed: 'Told after decisions',
}

export function KeyResultRow({
  keyResult,
  reference,
  path,
  editor,
}: {
  keyResult: KeyResult
  reference: string
  path: Path
  editor: Editor
}) {
  const [showNotes, setShowNotes] = useState(false)
  const notes = keyResult.progress_notes ?? []
  const status = keyResult.status ?? ''

  return (
    <div className="border-t border-line/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <Reference id={reference} className="mt-1" />

        <div className="min-w-0 flex-1">
          <TextField
            multiline
            value={keyResult.target_measure ?? ''}
            placeholder="What is measured, and the target that counts as success"
            onCommit={(value) => editor.setKeyResult(path, 'target_measure', value)}
            className="text-sm leading-relaxed"
          />

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
            <label className="flex items-center gap-1">
              due
              <TextField
                value={keyResult.target_date ?? ''}
                placeholder="Q3"
                onCommit={(value) => editor.setKeyResult(path, 'target_date', value)}
                className="w-24 text-ink-muted"
              />
            </label>

            {status === 'In Progress' && (
              <label className="flex items-center gap-1">
                progress
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={keyResult.progress ?? ''}
                  placeholder="50"
                  onChange={(event) =>
                    editor.setProgressOverride(
                      path,
                      event.target.value === '' ? null : Number(event.target.value),
                    )
                  }
                  className="field w-16 text-ink-muted"
                />
                %
              </label>
            )}

            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1 hover:text-ink-muted"
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${showNotes ? 'rotate-90' : ''}`}
              />
              {notes.length === 1 ? '1 note' : `${notes.length} notes`}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <EnumSelect
              label={`${reference} status`}
              value={status}
              options={STATUSES}
              onChange={(value) => editor.setKeyResult(path, 'status', value)}
            />
            <EnumSelect
              label={`${reference} priority`}
              value={keyResult.priority ?? ''}
              options={PRIORITIES}
              onChange={(value) => editor.setKeyResult(path, 'priority', value)}
            />
            <EnumSelect
              label={`${reference} complexity`}
              value={keyResult.complexity ?? ''}
              options={COMPLEXITIES}
              onChange={(value) => editor.setKeyResult(path, 'complexity', value)}
            />
          </div>
          <ProgressBar progress={keyResultProgress(keyResult)} width="w-20" />
        </div>
      </div>

      <div className="mt-2 ml-[4.5rem] grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {RACI_ROLES.map((role) => (
          <label key={role} className="flex items-baseline gap-2 text-xs">
            <span
              title={ROLE_HINTS[role]}
              className="w-20 shrink-0 text-right capitalize text-ink-faint"
            >
              {role}
            </span>
            <NameList
              names={keyResult.owners?.[role] ?? []}
              placeholder="—"
              onCommit={(names) => editor.setOwners(path, role, names)}
            />
          </label>
        ))}
      </div>

      {showNotes && (
        <NotesPanel notes={notes} path={path} editor={editor} />
      )}
    </div>
  )
}

/**
 * Existing notes are read-only by design: SPEC.md says never edit or delete an
 * entry, only add a newer one on top.
 */
function NotesPanel({
  notes,
  path,
  editor,
}: {
  notes: { date?: string; note?: string }[]
  path: Path
  editor: Editor
}) {
  const [date, setDate] = useState(today())
  const [text, setText] = useState('')

  const add = () => {
    if (!text.trim()) return
    editor.addNote(path, date, text.trim())
    setText('')
    setDate(today())
  }

  return (
    <div className="mt-3 ml-[4.5rem] space-y-2 border-l border-line pl-4">
      {notes.map((note, index) => (
        <div key={`${note.date}-${index}`} className="text-xs">
          <span className="font-mono text-ink-faint">{note.date}</span>
          <p className="mt-0.5 leading-relaxed text-ink-muted">{note.note}</p>
        </div>
      ))}

      <div className="flex items-start gap-2 pt-1">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="field w-32 font-mono text-xs text-ink-muted"
        />
        <textarea
          rows={1}
          value={text}
          placeholder="Add a review note…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) add()
          }}
          className="field flex-1 resize-none text-xs"
        />
        <button
          type="button"
          onClick={add}
          disabled={!text.trim()}
          className="mt-0.5 flex items-center gap-1 rounded border border-line px-2 py-1
            text-xs text-ink-muted enabled:hover:border-accent-dim enabled:hover:text-ink
            disabled:opacity-40"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  )
}
