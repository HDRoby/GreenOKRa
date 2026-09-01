'use client'

import {
  type Indexed,
  type PersonFilter,
  ownsInitiative,
  ownsObjective,
  visibleKeyResults,
  visibleObjectives,
} from '@/lib/filter.ts'
import { type Initiative, type KeyResult } from '@/lib/okr.ts'
import { BANDS, type Band, type Tally, tally } from '@/lib/portfolio.ts'

/**
 * The fill per band.
 *
 * Not `barToneFor`: two of these are the status ramp's own colours, but the
 * middle band is three rungs collapsed together and is therefore no single
 * status, so it takes a blue of its own rather than borrowing one rung's green.
 * At bar size that also keeps in-flight work plainly apart from finished work.
 */
const BAND_FILL: Record<Band, string> = {
  'Not Started': 'bg-idle',
  'In Progress': 'bg-underway',
  Completed: 'bg-done',
}

/**
 * Every key result an initiative holds, with the filter applied at each level.
 *
 * Ownership runs downhill exactly as it does in the lists: owning the
 * initiative reveals all of it, owning an objective reveals all of that.
 */
function keyResultsOf(initiative: Initiative, person: PersonFilter): KeyResult[] {
  const inherited = ownsInitiative(initiative, person)
  return visibleObjectives(initiative.objectives ?? [], person, inherited).flatMap(
    ({ item: objective }) =>
      visibleKeyResults(
        objective.key_results ?? [],
        person,
        inherited || ownsObjective(objective, person),
      ).map((held) => held.item),
  )
}

/**
 * A bar of work, initiative by initiative.
 *
 * Length is a count, not a percentage, and every bar is measured against the
 * largest — so an initiative carrying twelve key results draws a bar three
 * times the one carrying four. A row of equal-length bars would say every
 * initiative is the same size, which is the one thing a portfolio view should
 * never say.
 */
export function PortfolioSnapshot({
  initiatives,
  person,
}: {
  initiatives: Indexed<Initiative>[]
  person: PersonFilter
}) {
  const bars = initiatives.map(({ item }) => ({
    initiative: item,
    totals: tally(keyResultsOf(item, person)),
  }))

  const widest = Math.max(0, ...bars.map(({ totals }) => totals.counted))
  // Nothing counted anywhere: no scale to draw against.
  if (widest === 0) return null

  const aborted = bars.reduce((sum, { totals }) => sum + totals.aborted, 0)

  return (
    <section className="mt-12 border-t border-line/60 pt-6">
      <h2 className="mb-3 text-[11px] font-medium tracking-wide text-ink-faint uppercase">
        Portfolio snapshot
      </h2>

      <div className="space-y-1.5">
        {bars.map(({ initiative, totals }) => (
          <Bar
            key={initiative.id ?? initiative.title}
            initiative={initiative}
            totals={totals}
            widest={widest}
          />
        ))}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
        {BANDS.map((band) => (
          <span key={band} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${BAND_FILL[band]}`} />
            {band}
          </span>
        ))}
        {/* Without this the bar for a heavily abandoned initiative just looks
            short, with nothing to say why. */}
        {aborted > 0 && (
          <span className="italic">
            {aborted} aborted {aborted === 1 ? 'key result' : 'key results'} not counted
          </span>
        )}
      </p>
    </section>
  )
}

function Bar({
  initiative,
  totals,
  widest,
}: {
  initiative: Initiative
  totals: Tally
  widest: number
}) {
  const spoken = BANDS.map((band) => `${totals[band]} ${band.toLowerCase()}`).join(', ')

  return (
    <div className="flex items-center gap-3">
      <span className="flex w-44 shrink-0 items-baseline gap-1.5 overflow-hidden">
        <span className="font-mono text-[11px] text-ink-faint">
          {initiative.id ?? '?'}
        </span>
        <span className="truncate text-xs text-ink-muted">
          {initiative.title || 'Untitled'}
        </span>
      </span>

      {/* The track shows the scale, so a short bar reads as less work rather
          than as a rendering that stopped early. */}
      <div className="h-6 flex-1 rounded bg-line/20">
        <div
          className="flex h-full overflow-hidden rounded"
          style={{ width: `${(totals.counted / widest) * 100}%` }}
          aria-label={`${initiative.title || initiative.id}: ${totals.counted} key results — ${spoken}`}
        >
          {BANDS.filter((band) => totals[band] > 0).map((band) => (
            <Segment
              key={band}
              band={band}
              count={totals[band]}
              of={totals.counted}
              widest={widest}
            />
          ))}
        </div>
      </div>

      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-muted">
        {totals.counted}
      </span>
    </div>
  )
}

function Segment({
  band,
  count,
  of,
  widest,
}: {
  band: Band
  count: number
  of: number
  widest: number
}) {
  return (
    <span
      className={`flex h-full items-center justify-center overflow-hidden
        text-[11px] font-medium tabular-nums text-canvas ${BAND_FILL[band]}`}
      style={{ width: `${(count / of) * 100}%` }}
      title={`${count} ${band}`}
    >
      {/* Measured against the whole chart, not against this bar: a segment can
          be all of a short bar and still be too narrow for a digit. */}
      {count / widest >= 0.07 && count}
    </span>
  )
}
