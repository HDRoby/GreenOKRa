'use client'

import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { timeframeGroups } from '@/lib/dates.ts'
import { displayProgress, formatProgress } from '@/lib/okr.ts'

import { Dropdown, type DropdownOption, toOptions } from './dropdown.tsx'

/**
 * A field that reads as plain text until you touch it.
 *
 * Edits commit on blur rather than on every keystroke: validation normalises
 * values, and normalising mid-word would fight the person typing. Escape
 * reverts.
 */
export function TextField({
  value,
  onCommit,
  placeholder,
  multiline = false,
  className = '',
}: {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const reverted = useRef(false)
  const area = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    const element = area.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [draft, multiline])

  const commit = () => {
    if (reverted.current) {
      reverted.current = false
      setDraft(value)
      return
    }
    if (draft !== value) onCommit(draft)
  }

  const revert = () => {
    reverted.current = true
    setDraft(value)
  }

  if (multiline) {
    return (
      <textarea
        ref={area}
        rows={1}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            revert()
            event.currentTarget.blur()
          }
        }}
        className={`field resize-none overflow-hidden ${className}`}
      />
    )
  }

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          revert()
          event.currentTarget.blur()
        }
      }}
      className={`field ${className}`}
    />
  )
}

/**
 * The colour each enum value is drawn in, as a pill and as bare text.
 *
 * Both spellings are written out rather than composed, because Tailwind reads
 * literal class names out of the source — `text-${colour}` would never reach
 * the stylesheet. Keeping them in one entry is what stops a tab and a pill
 * disagreeing about what colour a status is.
 */
const TONES: Record<string, { pill: string; text: string }> = {
  // The status ladder.
  'Not Started': { pill: 'text-idle border-idle/40 bg-idle/10', text: 'text-idle' },
  Started: { pill: 'text-begun border-begun/40 bg-begun/10', text: 'text-begun' },
  'In Progress': {
    pill: 'text-active border-active/40 bg-active/10',
    text: 'text-active',
  },
  'In Completion': {
    pill: 'text-closing border-closing/40 bg-closing/10',
    text: 'text-closing',
  },
  Completed: { pill: 'text-done border-done/40 bg-done/10', text: 'text-done' },
  Aborted: {
    pill: 'text-dropped border-dropped/40 bg-dropped/10',
    text: 'text-dropped',
  },
  // Priority and complexity, which share their values.
  Blocker: {
    pill: 'text-dropped border-dropped/40 bg-dropped/10',
    text: 'text-dropped',
  },
  'Very High': {
    pill: 'text-dropped border-dropped/40 bg-dropped/10',
    text: 'text-dropped',
  },
  High: { pill: 'text-warn border-warn/40 bg-warn/10', text: 'text-warn' },
  Medium: {
    pill: 'text-ink-muted border-line bg-surface-raised',
    text: 'text-ink-muted',
  },
  Low: {
    pill: 'text-ink-faint border-line bg-surface-raised',
    text: 'text-ink-faint',
  },
}

function toneFor(value: string): string {
  return TONES[value]?.pill ?? 'text-ink-muted border-line bg-surface-raised'
}

/** Just the colour, for places that show the word rather than a pill. */
export function textToneFor(value: string): string {
  return TONES[value]?.text ?? 'text-ink-muted'
}

/** The pill an enum value becomes, used both closed and in the list. */
const PILL = 'inline-block rounded-full border px-2 py-0.5 text-xs'

function pillFor(value: string): string {
  return `${PILL} ${toneFor(value)}`
}

/**
 * A small pill of a select.
 *
 * `icon` matters where two lists share their values — priority and complexity
 * both read High/Medium/Low, and a glyph tells them apart faster than reading
 * the label does.
 */
export function EnumSelect({
  value,
  options,
  onChange,
  label,
  icon,
}: {
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  label: string
  icon?: React.ReactNode
}) {
  const known = options.includes(value)
  // A value the file holds but the list does not stays selectable, rather than
  // the control displaying something absent from its own options.
  const listed: DropdownOption[] = options.map((option) => ({
    value: option,
    label: option,
    chipClassName: pillFor(option),
  }))
  if (!known) {
    // A value the file holds but the list does not stays selectable, rather
    // than the control displaying something absent from its own options.
    listed.unshift({
      value,
      label: value || '(not set)',
      chipClassName: pillFor(value),
    })
  }

  return (
    <Dropdown
      value={value}
      options={listed}
      onChange={onChange}
      label={label}
      icon={icon}
      align="right"
      triggerClassName={`cursor-pointer rounded-full border py-0.5 pr-1.5 text-xs
        focus:outline-none focus:ring-1 focus:ring-accent-dim
        ${icon ? 'pl-2' : 'pl-2.5'}
        ${known ? toneFor(value) : 'border-dropped bg-dropped/10 text-dropped'}`}
    />
  )
}

/** A year, optionally narrowed to a half or a quarter. This year and next. */
export function TimeframeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const groups = timeframeGroups(new Date().getFullYear())
  const options: DropdownOption[] = groups.flatMap((group) =>
    group.values.map((option) => ({
      value: option,
      label: option,
      group: String(group.year),
    })),
  )
  const known = options.some((option) => option.value === value)
  if (!known) {
    options.unshift({ value, label: value || '(not set)' })
  }

  return (
    <Dropdown
      value={value}
      options={options}
      onChange={onChange}
      label="Timeframe"
      triggerClassName="cursor-pointer rounded-md border border-line bg-surface-raised
        py-0.5 pr-1.5 pl-2 text-xs tabular-nums text-ink-muted
        focus:outline-none focus:ring-1 focus:ring-accent-dim"
    />
  )
}

/** Aborted work has no percentage, so the track stays empty and reads `—`. */
export function ProgressBar({
  progress,
  width = 'w-24',
}: {
  progress: number | null
  width?: string
}) {
  // The bar tracks the rounded figure, so it agrees with the label beside it.
  const shown = displayProgress(progress)
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className={`${width} h-1.5 overflow-hidden rounded-full bg-line`}>
        {shown !== null && (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${shown}%` }}
          />
        )}
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-ink-muted">
        {formatProgress(progress)}
      </span>
    </div>
  )
}

/**
 * The one way to add something, used at every level.
 *
 * A single component rather than four similar buttons, so the styling and
 * alignment cannot drift apart again.
 */
export function AddButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
    >
      <Plus size={12} />
      {label}
    </button>
  )
}

/** A dotted id such as `TEK.O1.KR2`, the handle used to refer to an OKR. */
export function Reference({ id, className = '' }: { id: string; className?: string }) {
  return (
    <span
      className={`shrink-0 rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs
        text-ink-muted ${className}`}
    >
      {id}
    </span>
  )
}
