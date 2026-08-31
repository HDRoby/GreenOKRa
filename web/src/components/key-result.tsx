'use client'

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsLeftRight,
  ChevronsUp,
  Layers,
} from 'lucide-react'
import { Fragment, useState } from 'react'

import type { PersonFilter } from '@/lib/filter.ts'
import type { Path } from '@/lib/edit.ts'
import { today } from '@/lib/file-access.ts'
import {
  COMPLEXITIES,
  type KeyResult,
  PRIORITIES,
  type Person,
  RACI_ROLES,
  STATUSES,
  canonical,
} from '@/lib/okr.ts'

import type { Editor } from './editor.ts'
import {
  AddButton,
  EnumSelect,
  Reference,
  StatusBar,
  TextField,
  textToneFor,
} from './fields.tsx'
import { PersonPicker } from './person-picker.tsx'
import { DeleteButton } from './delete-button.tsx'
import { ReviewBadge } from './review-badge.tsx'
import { TargetDate } from './target-date.tsx'

const ROLE_HINTS: Record<string, string> = {
  accountable: 'Owns the outcome — one person',
  responsible: 'Does the work',
  consult: 'Asked before decisions',
  inform: 'Told after decisions',
}

/** RACI wants exactly one accountable; the other three are lists. */
const SINGLE_ROLES = new Set(['accountable'])

export function KeyResultRow({
  keyResult,
  reference,
  path,
  objectivePath,
  index,
  timeframe,
  cadence,
  people,
  person,
  editor,
}: {
  keyResult: KeyResult
  reference: string
  path: Path
  /** Where it lives, so it can be removed from its list. */
  objectivePath: Path
  index: number
  timeframe: string | undefined
  cadence: string | undefined
  people: Person[]
  person: PersonFilter
  editor: Editor
}) {
  const measure = keyResult.target_measure ?? ''
  // A key result that was just added has nothing in it yet, so start it open.
  const [open, setOpen] = useState(() => measure.trim() === '')
  const notes = keyResult.progress_notes ?? []
  const status = keyResult.status ?? ''
  const due = keyResult.target_date ?? ''

  return (
    <div className="border-t border-line/60">
      {/* One button, since nothing on the row is editable any more: the
          controls live in the card, so clicking anywhere here just opens it. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-ink-faint transition-transform
            ${open ? 'rotate-90' : ''}`}
        />
        {!open && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
              {measure.replace(/\s+/g, ' ').trim() || (
                <em className="text-ink-faint">Nothing measured yet</em>
              )}
            </span>
            <span className="shrink-0 text-xs text-ink-faint">
              {due || <span className="italic">(not set)</span>}
            </span>
            <ReviewBadge keyResult={keyResult} cadence={cadence} today={today()} />
            <StatusBar status={status} />
            <PriorityMark priority={keyResult.priority} />
          </>
        )}
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 pl-[2.25rem]">
          {/* The dotted id heads the open card, where an objective and an
              initiative carry theirs. On the collapsed row it was the same
              string on every line, spending width to say nothing. */}
          <div className="flex items-center justify-between gap-3">
            <Reference id={reference} />
            <DeleteButton
              what={`Key result ${reference}`}
              onConfirm={() => editor.removeKeyResult(objectivePath, index)}
            />
          </div>

          {/* Status sits with the measure — a key result's equivalent of a
              title — as it does beside an objective's. `items-start` keeps it
              on the first line as the text grows. */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                multiline
                value={measure}
                placeholder="What is measured, and the target that counts as success"
                onCommit={(value) => editor.setKeyResult(path, 'target_measure', value)}
                className="text-sm leading-relaxed"
              />
            </div>
            <div className="mt-0.5 shrink-0">
              <EnumSelect
                label={`${reference} status`}
                value={status}
                options={STATUSES}
                onChange={(value) => editor.setKeyResult(path, 'status', value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
            <label className="flex items-center gap-1.5">
              priority
              <EnumSelect
                label={`${reference} priority`}
                value={keyResult.priority ?? ''}
                options={PRIORITIES}
                icon={priorityIcon(keyResult.priority, 11)}
                onChange={(value) => editor.setKeyResult(path, 'priority', value)}
              />
            </label>
            <label className="flex items-center gap-1.5">
              complexity
              <EnumSelect
                label={`${reference} complexity`}
                value={keyResult.complexity ?? ''}
                options={COMPLEXITIES}
                icon={<Layers size={10} />}
                onChange={(value) => editor.setKeyResult(path, 'complexity', value)}
              />
            </label>
            <label className="flex items-center gap-1.5">
              target date
              <TargetDate
                label={`${reference} target date`}
                value={due}
                timeframe={timeframe}
                onCommit={(value) => editor.setKeyResult(path, 'target_date', value)}
              />
            </label>
          </div>

          <div className="space-y-1">
            {RACI_ROLES.map((role) => (
              <div key={role} className="flex items-start gap-2 text-xs">
                <span
                  title={ROLE_HINTS[role]}
                  className="mt-0.5 w-20 shrink-0 text-right capitalize text-ink-faint"
                >
                  {role}
                </span>
                <PersonPicker
                  identities={keyResult.owners?.[role] ?? []}
                  known={people}
                  multiple={!SINGLE_ROLES.has(role)}
                  label={`${reference} ${role}`}
                  highlight={person}
                  onChange={(chosen) => editor.setOwners(path, role, chosen)}
                  onEditPerson={editor.editPerson}
              onAddPerson={editor.addPerson}
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
 * Priority as a glyph: the arrow points the way the urgency does, and the
 * colour repeats it. On a row there is no space for a word.
 */
const PRIORITY_ICONS: Record<string, typeof ChevronUp> = {
  Blocker: ChevronsUp,
  High: ChevronUp,
  Medium: ChevronsLeftRight,
  Low: ChevronDown,
}

function priorityIcon(priority: string | undefined, size: number) {
  const value = canonical(priority, PRIORITIES)
  const Icon = value === null ? null : PRIORITY_ICONS[value]
  return Icon ? <Icon size={size} /> : null
}

function PriorityMark({ priority }: { priority: string | undefined }) {
  const value = canonical(priority, PRIORITIES)
  if (value === null) return null
  return (
    <span
      title={`Priority: ${value}`}
      aria-label={`Priority ${value}`}
      className={`shrink-0 ${textToneFor(value)}`}
    >
      {priorityIcon(value, 13)}
    </span>
  )
}

/**
 * The review log: a date column and the note beside it.
 *
 * Entries are editable like any other field. Re-dating one re-sorts the log,
 * but only once the date input is left, so the row does not move out from under
 * the cursor mid-edit. Adding follows the same shape as every other add in the
 * editor: an always-enabled button that opens a draft row, here at the top
 * where the newest note belongs.
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
  const [draft, setDraft] = useState<{ date: string; text: string } | null>(null)

  const finish = () => {
    if (draft && draft.text.trim()) {
      // The list re-sorts by date, so a backdated note lands in the right place.
      editor.addNote(path, draft.date, draft.text.trim())
    }
    setDraft(null)
  }

  return (
    <div className="space-y-2">
      <AddButton label="Note" onClick={() => setDraft({ date: today(), text: '' })} />

      {(draft || notes.length > 0) && (
        <div className="grid grid-cols-[7.5rem_1fr] items-start gap-x-3 gap-y-2 text-xs">
          {draft && (
            <>
              <input
                type="date"
                value={draft.date}
                aria-label="Note date"
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
                className="field font-mono text-ink-muted"
              />
              <textarea
                autoFocus
                rows={2}
                value={draft.text}
                placeholder="What changed since the last review?"
                aria-label="Note"
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                onBlur={finish}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    finish()
                  }
                  if (event.key === 'Escape') setDraft(null)
                }}
                className="field resize-y leading-relaxed"
              />
            </>
          )}

          {notes.map((note, index) => (
            <Fragment key={`${note.date}-${index}`}>
              <input
                type="date"
                value={note.date ?? ''}
                aria-label={`Date of note ${index + 1}`}
                onChange={(event) =>
                  editor.setNote(path, index, 'date', event.target.value)
                }
                onBlur={() => editor.sortNotes(path)}
                className="field font-mono text-ink-faint"
              />
              <TextField
                multiline
                value={note.note ?? ''}
                placeholder="What changed"
                onCommit={(value) => editor.setNote(path, index, 'note', value)}
                className="leading-relaxed text-ink-muted"
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
