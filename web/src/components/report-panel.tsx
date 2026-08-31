'use client'

import { AlertTriangle, Check, ChevronRight, Wand2, XCircle } from 'lucide-react'
import { useState } from 'react'

import type { Report } from '@/lib/okr.ts'

/**
 * The validation summary.
 *
 * Fixes are shown as already-applied rather than as something to approve: the
 * document is normalised on every edit, so by the time this renders the repair
 * has happened. It is reported so nothing changes silently.
 */
export function ReportPanel({ report }: { report: Report }) {
  const [open, setOpen] = useState(false)
  const { errors, warnings, fixes } = report
  const clean = errors.length === 0 && warnings.length === 0 && fixes.length === 0

  if (clean) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-done">
        <Check size={14} />
        Valid
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-line px-2 py-1
          text-xs hover:border-ink-faint"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {errors.length > 0 && (
          <span className="flex items-center gap-1 text-dropped">
            <XCircle size={12} />
            {errors.length}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="flex items-center gap-1 text-warn">
            <AlertTriangle size={12} />
            {warnings.length}
          </span>
        )}
        {fixes.length > 0 && (
          <span className="flex items-center gap-1 text-accent">
            <Wand2 size={12} />
            {fixes.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-20 max-h-96 w-[32rem] overflow-y-auto
            rounded-lg border border-line bg-surface p-3 shadow-xl"
        >
          <Group
            title="Errors"
            hint="These break the spec and must be fixed."
            items={errors}
            tone="text-dropped"
            icon={<XCircle size={12} />}
          />
          <Group
            title="Warnings"
            hint="Legal, but probably not what you meant."
            items={warnings}
            tone="text-warn"
            icon={<AlertTriangle size={12} />}
          />
          <Group
            title="Tidied"
            hint="Normalised for you. Save to keep."
            items={fixes}
            tone="text-accent"
            icon={<Wand2 size={12} />}
          />
        </div>
      )}
    </div>
  )
}

function Group({
  title,
  hint,
  items,
  tone,
  icon,
}: {
  title: string
  hint: string
  items: string[]
  tone: string
  icon: React.ReactNode
}) {
  if (items.length === 0) return null
  return (
    <section className="mb-3 last:mb-0">
      <h3 className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>
        {icon}
        {title}
        <span className="font-normal text-ink-faint">— {hint}</span>
      </h3>
      <ul className="mt-1 space-y-0.5">
        {items.map((item, index) => (
          <li key={index} className="font-mono text-[11px] leading-relaxed text-ink-muted">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
