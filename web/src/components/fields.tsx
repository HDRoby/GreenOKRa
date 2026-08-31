'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { formatProgress } from '@/lib/okr.ts'

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

const TONES: Record<string, string> = {
  'Not Started': 'text-idle border-idle/40 bg-idle/10',
  'In Progress': 'text-active border-active/40 bg-active/10',
  Completed: 'text-done border-done/40 bg-done/10',
  Aborted: 'text-dropped border-dropped/40 bg-dropped/10',
  Blocker: 'text-dropped border-dropped/40 bg-dropped/10',
  High: 'text-warn border-warn/40 bg-warn/10',
  'Very High': 'text-dropped border-dropped/40 bg-dropped/10',
  Medium: 'text-ink-muted border-line bg-surface-raised',
  Low: 'text-ink-faint border-line bg-surface-raised',
}

function toneFor(value: string): string {
  return TONES[value] ?? 'text-ink-muted border-line bg-surface-raised'
}

/** A small pill select. Native, so keyboard and touch behaviour come free. */
export function EnumSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  label: string
}) {
  const known = options.includes(value)
  return (
    <div className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`appearance-none cursor-pointer rounded-full border py-0.5 pr-6 pl-2.5 text-xs
          focus:outline-none focus:ring-1 focus:ring-accent-dim
          ${known ? toneFor(value) : 'text-dropped border-dropped bg-dropped/10'}`}
      >
        {!known && <option value={value}>{value || '(not set)'}</option>}
        {options.map((option) => (
          <option key={option} value={option} className="bg-surface text-ink">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60"
      />
    </div>
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
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className={`${width} h-1.5 overflow-hidden rounded-full bg-line`}>
        {progress !== null && (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-ink-muted">
        {formatProgress(progress)}
      </span>
    </div>
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

/** A comma-separated list of names, edited as text. */
export function NameList({
  names,
  onCommit,
  placeholder,
}: {
  names: string[]
  onCommit: (names: string[]) => void
  placeholder?: string
}) {
  return (
    <TextField
      value={names.join(', ')}
      placeholder={placeholder}
      onCommit={(value) =>
        onCommit(
          value
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        )
      }
      className="text-sm"
    />
  )
}
