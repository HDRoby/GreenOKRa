import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

import {
  COMPLEXITIES,
  type Initiative,
  type KeyResult,
  type Objective,
  STATUSES,
  canonical,
  formatProgress,
  initiativeProgress,
  keyResultProgress,
  objectiveProgress,
  parse,
  stringify,
  toData,
  validate,
} from './okr.ts'

const SAMPLE_PATH = new URL('../../../okrs/2026.yaml', import.meta.url)
const sampleText = () => readFileSync(SAMPLE_PATH, 'utf8')

const BASE = `version: 1
strategic_initiatives:
  - id: TEK
    title: Technology
    owner: roberto
    timeframe: "2026"
    status: In Progress
    objectives:
      - id: O1
        title: An objective
        status: In Progress
        key_results:
          - id: KR1
            target_measure: A measurable thing reaches 100%.
            target_date: Q3
            owners:
              accountable: [roberto]
            status: In Progress
            priority: High
            complexity: Medium
`

/** Parse the fixture, optionally with a substitution applied to the source. */
function base(from?: string, to?: string) {
  const text = from === undefined ? BASE : BASE.replace(from, to as string)
  return parse(text)
}

const initiativeNode = (doc: ReturnType<typeof parse>) =>
  doc.getIn(['strategic_initiatives', 0]) as never
const path = {
  initiative: (key: string) => ['strategic_initiatives', 0, key],
  objective: (key: string) => ['strategic_initiatives', 0, 'objectives', 0, key],
  keyResult: (key: string) => [
    'strategic_initiatives',
    0,
    'objectives',
    0,
    'key_results',
    0,
    key,
  ],
}

// ---------------------------------------------------------------------------
describe('the sample file', () => {
  test('is valid and needs no repair', () => {
    const doc = parse(sampleText())
    const report = validate(doc)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.fixes).toEqual([])
  })

  test('is byte-stable through a round trip', () => {
    const text = sampleText()
    expect(stringify(parse(text))).toBe(text)
  })

  test('keeps its comments through a round trip', () => {
    const doc = parse(sampleText())
    validate(doc)
    expect(stringify(doc)).toContain('# Aborted work keeps its id forever')
  })

  test('rolls up to the expected percentages', () => {
    const data = toData(parse(sampleText()))
    const progress = Object.fromEntries(
      (data.strategic_initiatives ?? []).map((initiative) => [
        initiative.id,
        round(initiativeProgress(initiative)),
      ]),
    )
    expect(progress).toEqual({ PEP: 40, PRO: 41.7, TEK: 47.5 })
  })
})

describe('the fixture', () => {
  test('is valid', () => {
    const report = validate(base())
    expect(report.errors).toEqual([])
    expect(report.fixes).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('autocorrect', () => {
  test('normalises enum spelling', () => {
    const doc = base()
    doc.setIn(path.keyResult('status'), 'IN_PROGRESS')
    doc.setIn(path.keyResult('priority'), '  blocker ')
    doc.setIn(path.keyResult('complexity'), 'very-high')

    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(doc.getIn(path.keyResult('status'))).toBe('In Progress')
    expect(doc.getIn(path.keyResult('priority'))).toBe('Blocker')
    expect(doc.getIn(path.keyResult('complexity'))).toBe('Very High')
    expect(report.fixes).toHaveLength(3)
  })

  test('coerces an unquoted year to a quoted string', () => {
    const doc = base('timeframe: "2026"', 'timeframe: 2026')
    expect(doc.getIn(path.initiative('timeframe'))).toBe(2026)

    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(doc.getIn(path.initiative('timeframe'))).toBe('2026')
    expect(stringify(doc)).toContain('timeframe: "2026"')
  })

  test('quotes a bare date so every parser reads it as text', () => {
    const doc = base('target_date: Q3', 'target_date: 2026-09-30')
    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(doc.getIn(path.keyResult('target_date'))).toBe('2026-09-30')
    expect(stringify(doc)).toContain('target_date: "2026-09-30"')
  })

  test('upper-cases identifiers', () => {
    const doc = base()
    doc.setIn(path.initiative('id'), 'tek')
    doc.setIn(path.objective('id'), 'o1')
    doc.setIn(path.keyResult('id'), 'kr1')

    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(doc.getIn(path.initiative('id'))).toBe('TEK')
    expect(doc.getIn(path.objective('id'))).toBe('O1')
    expect(doc.getIn(path.keyResult('id'))).toBe('KR1')
  })

  test('wraps a single owner written as text in a list', () => {
    const doc = base('accountable: [roberto]', 'accountable: roberto')
    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(report.fixes.join()).toContain("wrapped 'roberto' in a list")
    expect(stringify(doc)).toContain('accountable: [roberto]')
  })

  test('leaves the document alone when there is nothing to repair', () => {
    const doc = base()
    validate(doc)
    expect(stringify(doc)).toBe(BASE)
  })
})

describe('canonical', () => {
  test('accepts legacy and sloppy spellings', () => {
    for (const variant of [
      'IN_PROGRESS',
      'in progress',
      'In-Progress',
      '  in   PROGRESS ',
    ]) {
      expect(canonical(variant, STATUSES)).toBe('In Progress')
    }
    expect(canonical('VERY_HIGH', COMPLEXITIES)).toBe('Very High')
  })

  test('rejects anything else', () => {
    expect(canonical('nonsense', STATUSES)).toBeNull()
    expect(canonical(undefined, STATUSES)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('errors', () => {
  const errorsFor = (mutate: (doc: ReturnType<typeof parse>) => void) => {
    const doc = base()
    mutate(doc)
    return validate(doc).errors.join('\n')
  }

  test('rejects an unknown field', () => {
    expect(
      errorsFor((doc) => doc.setIn(path.keyResult('priorty'), 'High')),
    ).toContain("unknown field 'priorty'")
  })

  test('rejects an unrecognised enum value', () => {
    expect(
      errorsFor((doc) => doc.setIn(path.keyResult('status'), 'Nearly there')),
    ).toContain("'Nearly there' is not a valid value")
  })

  test('rejects a missing required field', () => {
    expect(
      errorsFor((doc) => doc.deleteIn(path.keyResult('target_measure'))),
    ).toContain("missing required field 'target_measure'")
  })

  test('rejects a malformed id', () => {
    expect(errorsFor((doc) => doc.setIn(path.objective('id'), 'OBJ1'))).toContain(
      'is not a valid id',
    )
  })

  test('rejects duplicate key result ids', () => {
    const doc = base()
    const keyResults = doc.getIn([
      'strategic_initiatives',
      0,
      'objectives',
      0,
      'key_results',
    ]) as { items: unknown[] }
    keyResults.items.push(keyResults.items[0])
    expect(validate(doc).errors.join('\n')).toContain(
      "duplicate key result id 'KR1'",
    )
  })

  test('rejects duplicate initiative ids', () => {
    const doc = base()
    const initiatives = doc.get('strategic_initiatives') as { items: unknown[] }
    initiatives.items.push(initiativeNode(doc))
    expect(validate(doc).errors.join('\n')).toContain(
      "duplicate initiative id 'TEK'",
    )
  })

  test('rejects progress outside 0 to 100', () => {
    expect(errorsFor((doc) => doc.setIn(path.keyResult('progress'), 140))).toContain(
      'outside the range 0 to 100',
    )
  })

  test('requires at least one owner', () => {
    expect(
      errorsFor((doc) => doc.setIn(path.keyResult('owners'), { accountable: [] })),
    ).toContain('at least one owner is required')
  })

  test('requires a real date on a progress note', () => {
    expect(
      errorsFor((doc) =>
        doc.setIn(path.keyResult('progress_notes'), [
          { date: 'last tuesday', note: 'hmm' },
        ]),
      ),
    ).toContain('is not a YYYY-MM-DD date')
  })

  test('rejects an unsupported version', () => {
    expect(errorsFor((doc) => doc.set('version', 2))).toContain(
      'unsupported version',
    )
  })

  test('rejects a file that is not a mapping', () => {
    expect(validate(parse('- just\n- a list\n')).errors.join()).toContain(
      'expected a mapping at the top level',
    )
  })
})

// ---------------------------------------------------------------------------
describe('warnings', () => {
  const warningsFor = (mutate: (doc: ReturnType<typeof parse>) => void) => {
    const doc = base()
    mutate(doc)
    const report = validate(doc)
    expect(report.errors).toEqual([])
    return report.warnings.join('\n')
  }

  test('warns when two people are accountable', () => {
    expect(
      warningsFor((doc) =>
        doc.setIn(path.keyResult('owners'), {
          accountable: ['roberto', 'maria'],
        }),
      ),
    ).toContain('should name exactly one person')
  })

  test('warns when progress notes are out of order', () => {
    expect(
      warningsFor((doc) =>
        doc.setIn(path.keyResult('progress_notes'), [
          { date: '2026-01-01', note: 'older first' },
          { date: '2026-08-01', note: 'newer last' },
        ]),
      ),
    ).toContain('most recent first')
  })

  test('warns when progress is set on a completed key result', () => {
    expect(
      warningsFor((doc) => {
        doc.setIn(path.keyResult('status'), 'Completed')
        doc.setIn(path.keyResult('progress'), 50)
      }),
    ).toContain('ignored because status is')
  })
})

// ---------------------------------------------------------------------------
describe('progress rollup', () => {
  const kr = (status: string, progress?: number): KeyResult => ({
    status,
    ...(progress === undefined ? {} : { progress }),
  })

  test('maps status to a percentage', () => {
    expect(keyResultProgress(kr('Not Started'))).toBe(0)
    expect(keyResultProgress(kr('In Progress'))).toBe(50)
    expect(keyResultProgress(kr('Completed'))).toBe(100)
    expect(keyResultProgress(kr('Aborted'))).toBeNull()
  })

  test('lets an explicit progress override the status default', () => {
    expect(keyResultProgress(kr('In Progress', 80))).toBe(80)
  })

  test('averages an objective over its key results', () => {
    const objective: Objective = {
      key_results: [kr('Completed'), kr('Not Started')],
    }
    expect(objectiveProgress(objective)).toBe(50)
  })

  test('lets aborted key results shrink the denominator', () => {
    const objective: Objective = {
      key_results: [kr('Completed'), kr('Aborted')],
    }
    expect(objectiveProgress(objective)).toBe(100)
  })

  test('reports undefined, not zero, when everything is aborted', () => {
    expect(objectiveProgress({ key_results: [kr('Aborted')] })).toBeNull()
    expect(formatProgress(null)).toBe('—')
  })

  test('flattens initiative progress across objectives', () => {
    const initiative: Initiative = {
      objectives: [
        {
          status: 'In Progress',
          key_results: [kr('Completed'), kr('Completed'), kr('Not Started')],
        },
        { status: 'In Progress', key_results: [kr('Not Started')] },
      ],
    }
    // Flat over four key results: 2 of 4 done. Averaging the two objective
    // percentages would have given 33.3%.
    expect(round(initiativeProgress(initiative))).toBe(50)
  })

  test('excludes an aborted objective from its initiative', () => {
    const initiative: Initiative = {
      objectives: [
        { status: 'In Progress', key_results: [kr('Completed')] },
        { status: 'Aborted', key_results: [kr('Not Started')] },
      ],
    }
    expect(initiativeProgress(initiative)).toBe(100)
  })

  test('formats a percentage to one decimal place', () => {
    expect(formatProgress(47.5)).toBe('47.5%')
    expect(formatProgress(0)).toBe('0.0%')
  })
})

function round(progress: number | null): number {
  expect(progress).not.toBeNull()
  return Math.round((progress as number) * 10) / 10
}
