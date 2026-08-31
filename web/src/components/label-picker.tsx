'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { labelTint } from '@/lib/labels.ts'

const NEW = ' new'

/**
 * Short labels as chips, picked from the values already in the file.
 *
 * Used for owner names and for an objective's theme. Offering what is already
 * there is the point: free text turns one person into three spellings, and one
 * theme into two groups. Entering something genuinely new stays possible, just
 * not the path of least resistance.
 *
 * `multiple` is false where the field holds one value — accountable, an
 * initiative's owner, a theme — so picking replaces rather than appends.
 * `clearable` adds a remove control to a single-value field; a theme is
 * optional and can be taken off, an owner is not.
 */
export function LabelPicker({
  values,
  known,
  multiple,
  clearable = false,
  label,
  placeholder = '(not set)',
  onChange,
}: {
  values: string[]
  known: string[]
  multiple: boolean
  clearable?: boolean
  label: string
  placeholder?: string
  onChange: (values: string[]) => void
}) {
  const [mode, setMode] = useState<'idle' | 'pick' | 'new'>('idle')
  const [draft, setDraft] = useState('')

  const available = known.filter((value) => !values.includes(value))
  const removable = multiple || clearable

  const commit = (value: string) => {
    const trimmed = value.trim()
    setMode('idle')
    setDraft('')
    if (!trimmed || values.includes(trimmed)) return
    onChange(multiple ? [...values, trimmed] : [trimmed])
  }

  const start = () => setMode(available.length > 0 ? 'pick' : 'new')

  return (
    <div className="flex flex-wrap items-center gap-1">
      {values.map((value) => (
        <span
          key={value}
          style={labelTint(value)}
          onClick={multiple ? undefined : start}
          title={multiple ? value : `${value} — click to change`}
          className={`group inline-flex items-center gap-1 rounded-full border px-2 py-0.5
            text-xs ${multiple ? '' : 'cursor-pointer'}`}
        >
          {value}
          {removable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onChange(values.filter((other) => other !== value))
              }}
              aria-label={`Remove ${value} from ${label}`}
              className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}

      {mode === 'idle' && (values.length === 0 || multiple) && (
        <button
          type="button"
          onClick={start}
          aria-label={`Add to ${label}`}
          title={`Add to ${label}`}
          className="rounded-full border border-dashed border-line p-0.5 text-ink-faint
            hover:border-accent-dim hover:text-accent"
        >
          <Plus size={11} />
        </button>
      )}

      {mode === 'pick' && (
        <select
          autoFocus
          aria-label={`Choose ${label}`}
          value=""
          onChange={(event) =>
            event.target.value === NEW ? setMode('new') : commit(event.target.value)
          }
          onBlur={() => setMode('idle')}
          onKeyDown={(event) => event.key === 'Escape' && setMode('idle')}
          className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs
            focus:outline-none focus:ring-1 focus:ring-accent-dim"
        >
          <option value="" disabled>
            Choose…
          </option>
          {available.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
          <option value={NEW}>New…</option>
        </select>
      )}

      {mode === 'new' && (
        <input
          autoFocus
          value={draft}
          placeholder={label}
          aria-label={`New value for ${label}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(draft)
            if (event.key === 'Escape') {
              setDraft('')
              setMode('idle')
            }
          }}
          className="w-40 rounded-md border border-accent-dim bg-canvas px-1.5 py-0.5 text-xs
            focus:outline-none"
        />
      )}

      {values.length === 0 && mode === 'idle' && (
        // Italic and faint, matching how every other empty control reads.
        <span className="text-xs italic text-ink-faint">{placeholder}</span>
      )}
    </div>
  )
}
