'use client'

import { useState } from 'react'

import {
  type Indexed,
  type PersonFilter,
  ownsObjective,
  visibleKeyResults,
} from '@/lib/filter.ts'
import {
  type KeyResult,
  type Objective,
  STATUSES,
  canonical,
  formatProgress,
  keyResultProgress,
  objectiveProgress,
} from '@/lib/okr.ts'

import { isDate, resolveDate } from '@/lib/dates.ts'

import { barToneFor, priorityIcon } from './fields.tsx'

/**
 * Fill and ink per rung.
 *
 * The fill is the hue the status wears everywhere, from the one map in
 * `fields.tsx`. Two are quieter here: `Not Started` at full strength reads as a
 * filled cell, as though something were there, and `Aborted` at full strength
 * shouts loudest of all, which is backwards for work that no longer counts.
 *
 * The ink has to be chosen per fill rather than derived — the bright rungs need
 * dark text on them, the two quiet ones need light.
 */
const CELL: Record<string, { fill: string; ink: string }> = {
  'Not Started': { fill: 'bg-idle/40', ink: 'text-ink-muted' },
  Started: { fill: barToneFor('Started'), ink: 'text-canvas' },
  'In Progress': { fill: barToneFor('In Progress'), ink: 'text-canvas' },
  'In Completion': { fill: barToneFor('In Completion'), ink: 'text-canvas' },
  Completed: { fill: barToneFor('Completed'), ink: 'text-canvas' },
  Aborted: { fill: 'bg-dropped/40', ink: 'text-ink-muted' },
}

const UNKNOWN = { fill: 'bg-line/40', ink: 'text-ink-faint' }

function toneFor(status: string | undefined) {
  const value = canonical(status, STATUSES)
  return (value && CELL[value]) || UNKNOWN
}

/** Enough of a measure to recognise it by. */
function shorten(text: string | undefined, limit = 70): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!flat) return 'nothing measured yet'
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat
}

/** What the line under the matrix says about whatever is being pointed at. */
interface Hint {
  head: string
  body: string
  /** Priority and target date, where they are set. */
  meta?: string
}

function describe(
  keyResult: KeyResult,
  reference: string,
  timeframe: string | undefined,
): Hint {
  const status = keyResult.status ?? '(not set)'
  const progress = formatProgress(keyResultProgress(keyResult))

  const meta: string[] = []
  if (keyResult.priority) meta.push(`${keyResult.priority} priority`)
  const due = keyResult.target_date?.trim()
  if (due) {
    // The day a period works out to, per the initiative's year. An actual date
    // needs no gloss, only the slashes the rest of the app writes it with.
    const resolved = resolveDate(due, timeframe)
    if (isDate(due)) meta.push(`due ${resolved ?? due}`)
    else meta.push(resolved ? `due ${due} (${resolved})` : `due ${due}`)
  }

  return {
    head: `${reference} — ${status} (${progress})`,
    body: shorten(keyResult.target_measure, 200),
    meta: meta.join(' · ') || undefined,
  }
}

/**
 * Objectives down, key results across, one cell each.
 *
 * Rows are ragged on purpose. An objective with two key results gets two
 * cells, not two and three blanks — the gap says something about where the
 * weight of the initiative sits.
 *
 * A column is a *position*, not a thing: column KR1 is `O1.KR1` on one row and
 * `O2.KR1` on the next, which are unrelated pieces of work. So pointing at one
 * lists what sits under it rather than pretending to name a single thing.
 */
export function HeatMap({
  objectives,
  person,
  inherited,
  timeframe,
}: {
  objectives: Indexed<Objective>[]
  person: PersonFilter
  /** True when the initiative itself is the filtered person's. */
  inherited: boolean
  /** The initiative's, so a period target date can name its actual day. */
  timeframe: string | undefined
}) {
  // A line under the matrix rather than a tooltip on each cell: a native
  // `title` waits a second, cannot be styled, never appears on touch, and is
  // clipped by the scroll container this table needs. One fixed place to read
  // has none of those problems, and has room for the whole measure.
  const [hint, setHint] = useState<Hint | null>(null)
  const clear = () => setHint(null)

  const rows = objectives.map(({ item: objective }) => ({
    objective,
    keyResults: visibleKeyResults(
      objective.key_results ?? [],
      person,
      inherited || ownsObjective(objective, person),
    ),
  }))

  const widest = Math.max(0, ...rows.map((row) => row.keyResults.length))
  // Nothing to show a picture of yet.
  if (widest === 0) return null

  const columnTip = (column: number) =>
    rows
      .map(({ objective, keyResults }) => {
        const held = keyResults[column]
        return held
          ? `${objective.id ?? '?'} — ${shorten(held.item.target_measure, 60)}`
          : null
      })
      .filter((line) => line !== null)
      .join('\n')

  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[11px] font-medium tracking-wide text-ink-faint uppercase">
        Heat map
      </h3>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="sr-only">Objective</th>
              {Array.from({ length: widest }, (_, column) => (
                <th
                  key={column}
                  scope="col"
                  title={columnTip(column)}
                  onMouseEnter={() =>
                    setHint({
                      head: `KR${column + 1} of each objective`,
                      body: columnTip(column) || 'nothing at this position',
                    })
                  }
                  onMouseLeave={clear}
                  className="cursor-help pb-0.5 font-mono text-[11px] font-normal
                    text-ink-faint hover:text-ink"
                >
                  KR{column + 1}
                </th>
              ))}
              <th className="sr-only">Objective progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ objective, keyResults }) => (
              <tr key={objective.id ?? objective.title}>
                <th
                  scope="row"
                  title={`${objective.id ?? '?'} — ${objective.title || 'Untitled'}`}
                  onMouseEnter={() =>
                    setHint({
                      head: `${objective.id ?? '?'} — ${formatProgress(objectiveProgress(objective))}`,
                      body: objective.title || 'Untitled',
                    })
                  }
                  onMouseLeave={clear}
                  className="cursor-help pr-1 text-right font-mono font-normal
                    text-ink-muted hover:text-ink"
                >
                  {objective.id ?? '?'}
                </th>

                {Array.from({ length: widest }, (_, column) => {
                  const held = keyResults[column]
                  if (!held) {
                    // Nothing there, rather than something at zero.
                    return <td key={column} className="h-10 w-16" />
                  }
                  const reference = `${objective.id ?? '?'}.${held.item.id ?? '?'}`
                  const tone = toneFor(held.item.status)
                  return (
                    <td key={column} className="p-0">
                      {/* The hover ring is ink, not the accent: the accent
                          shares its hue with the top of the status ramp and
                          would vanish against those two fills. */}
                      <span
                        aria-label={`${reference}: ${describe(held.item, reference, timeframe).head}`}
                        onMouseEnter={() =>
                          setHint(describe(held.item, reference, timeframe))
                        }
                        onMouseLeave={clear}
                        className={`flex h-10 w-16 cursor-help items-center justify-center
                          gap-1 rounded text-xs font-medium tabular-nums
                          ring-ink/70 hover:ring-2
                          ${tone.fill} ${tone.ink}`}
                      >
                        {/* The glyph takes the cell's ink rather than the
                            priority's own colour, which would be unreadable on
                            a green fill. The shape is what carries it here, so
                            it is drawn heavy enough to read at this size. */}
                        {priorityIcon(held.item.priority, 15, 3)}
                        {formatProgress(keyResultProgress(held.item))}
                      </span>
                    </td>
                  )
                })}

                <td
                  title={`${objective.id ?? '?'} overall`}
                  className="pl-2 text-right font-medium tabular-nums text-ink-muted"
                >
                  {formatProgress(objectiveProgress(objective))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fixed height, so pointing at things does not shift the page. */}
      <div className="mt-2 min-h-[2.5rem] border-t border-line/60 pt-1.5 text-xs">
        {hint ? (
          <>
            <p className="font-mono text-[11px] text-ink">
              {hint.head}
              {hint.meta && (
                <span className="ml-2 font-sans text-ink-faint">{hint.meta}</span>
              )}
            </p>
            <p className="whitespace-pre-line text-ink-muted">{hint.body}</p>
          </>
        ) : (
          <p className="text-ink-faint italic">
            Point at a cell, a row or a column heading to read what it is.
          </p>
        )}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        {STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm ${toneFor(status).fill}`} />
            {status}
          </span>
        ))}
      </p>
    </section>
  )
}
