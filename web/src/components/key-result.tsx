'use client'

import { ChevronRight, Flag, Layers, MessageSquare, Plus } from 'lucide-react'
import { useState } from 'react'

import { resolveDate } from '@/lib/dates.ts'
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
import {
  EnumSelect,
  PercentSelect,
  ProgressBar,
  Reference,
  TextField,
} from './fields.tsx'
import { LabelPicker } from './label-picker.tsx'
import { TargetDate } from './target-date.tsx'

const ROLE_HINTS: Record<string, string> = {
  accountable: 'Owns the outcome — one person',
  responsible: 'Does the work',
  consulted: 'Asked before decisions',
  informed: 'Told after decisions',
}

/** RACI wants exactly one accountable; the other three are lists. */
const SINGLE_ROLES = new Set(['accountable'])

export function KeyResultRow({
  keyResult,
  reference,
  path,
  timeframe,
  people,
  editor,
}: {
  keyResult: KeyResult
  reference: string
  path: Path
  timeframe: string | undefined
  people: string[]
  editor: Editor
}) {
  const measure = keyResult.target_measure ?? ''
  // A key result that was just added has nothing in it yet, so start it open.
  const [open, setOpen] = useState(() => measure.trim() === '')
  const notes = keyResult.progress_notes ?? []
  const status = keyResult.status ?? ''
  const due = keyResult.target_date ?? ''
  const resolved = resolveDate(due, timeframe)

  return (
    <div className="border-t border-line/60">
      <div className="flex items-start gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronRight
            size={14}
            className={`mt-0.5 shrink-0 text-ink-faint transition-transform
              ${open ? 'rotate-90' : ''}`}
          />
          <Reference id={reference} />
          {!open && (
            <>
              <span className="mt-0.5 min-w-0 flex-1 truncate text-sm text-ink-muted">
                {measure.replace(/\s+/g, ' ').trim() || (
                  <em className="text-ink-faint">Nothing measured yet</em>
                )}
              </span>
              <span className="mt-0.5 shrink-0 text-xs text-ink-faint">
                {due || <span className="italic">(not set)</span>}
                {resolved && !due.includes('-') && (
                  <span className="ml-1 tabular-nums opacity-70">{resolved}</span>
                )}
              </span>
              {notes.length > 0 && (
                <span
                  title={`${notes.length} progress notes`}
                  className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs text-ink-faint"
                >
                  <MessageSquare size={11} />
                  {notes.length}
                </span>
              )}
            </>
          )}
        </button>

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
              icon={<Flag size={10} />}
              onChange={(value) => editor.setKeyResult(path, 'priority', value)}
            />
            <EnumSelect
              label={`${reference} complexity`}
              value={keyResult.complexity ?? ''}
              options={COMPLEXITIES}
              icon={<Layers size={10} />}
              onChange={(value) => editor.setKeyResult(path, 'complexity', value)}
            />
          </div>
          <ProgressBar progress={keyResultProgress(keyResult)} width="w-20" />
        </div>
      </div>

      {open && (
        <div className="space-y-3 px-4 pb-4 pl-[3.25rem]">
          <TextField
            multiline
            value={measure}
            placeholder="What is measured, and the target that counts as success"
            onCommit={(value) => editor.setKeyResult(path, 'target_measure', value)}
            className="text-sm leading-relaxed"
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-faint">
            <label className="flex items-center gap-1.5">
              target date
              <TargetDate
                label={`${reference} target date`}
                value={due}
                timeframe={timeframe}
                onCommit={(value) => editor.setKeyResult(path, 'target_date', value)}
              />
            </label>

            {status === 'In Progress' && (
              <label className="flex items-center gap-1.5">
                progress
                <PercentSelect
                  label={`${reference} progress`}
                  value={keyResult.progress}
                  onChange={(value) => editor.setProgressOverride(path, value)}
                />
              </label>
            )}
          </div>

          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {RACI_ROLES.map((role) => (
              <div key={role} className="flex items-start gap-2 text-xs">
                <span
                  title={ROLE_HINTS[role]}
                  className="mt-0.5 w-20 shrink-0 text-right capitalize text-ink-faint"
                >
                  {role}
                </span>
                <LabelPicker
                  values={keyResult.owners?.[role] ?? []}
                  known={people}
                  multiple={!SINGLE_ROLES.has(role)}
                  label={`${reference} ${role}`}
                  onChange={(names) => editor.setOwners(path, role, names)}
                />
              </div>
            ))}
          </div>

          <NotesPanel notes={notes} path={path} editor={editor} />
        </div>
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
    <div className="space-y-3">
      {notes.length > 0 && (
        <div className="space-y-2 border-l border-line pl-4">
          {notes.map((note, index) => (
            <div key={`${note.date}-${index}`} className="text-xs">
              <span className="font-mono text-ink-faint">{note.date}</span>
              <p className="mt-0.5 leading-relaxed text-ink-muted">{note.note}</p>
            </div>
          ))}
        </div>
      )}

      {/* The entry form sits at the same left edge as the measure and the
          description above it, so the text area is the same width as every
          other block of prose in the editor. */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs text-ink-faint">
          note dated
          <input
            type="date"
            value={date}
            aria-label="Note date"
            onChange={(event) => setDate(event.target.value)}
            className="field w-36 font-mono text-xs text-ink-muted"
          />
        </label>
        <textarea
          rows={2}
          value={text}
          placeholder="What changed since the last review?"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) add()
          }}
          className="field resize-y text-xs leading-relaxed"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={!text.trim()}
            title="Add note (⌘↩)"
            className="flex items-center gap-1 rounded border border-line px-2 py-1
              text-xs text-ink-muted enabled:hover:border-accent-dim
              enabled:hover:text-ink disabled:opacity-40"
          >
            <Plus size={12} />
            Add note
          </button>
        </div>
      </div>
    </div>
  )
}
