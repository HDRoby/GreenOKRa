import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

import {
  COMPLEXITIES,
  type Initiative,
  type KeyResult,
  type Objective,
  STATUSES,
  canonical,
  decidedStatus,
  displayProgress,
  formatProgress,
  initiativeProgress,
  keyResultProgress,
  objectiveProgress,
  parse,
  statusProgress,
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
    owner: {name: roberto}
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
              accountable:
                - {name: roberto}
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
    expect(progress).toEqual({ PEP: 41.7, PRO: 41.7, TEK: 50 })
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

  /**
   * People used to be plain names. A file still written that way opens and
   * upgrades itself, so nobody has to migrate by hand.
   */
  test('upgrades a bare name into the name/email shape', () => {
    const doc = base('              accountable:\n                - {name: roberto}', '              accountable: [roberto]')
    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(report.fixes.join('\n')).toContain('given the name/email shape')
    const keyResult =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
    expect(keyResult?.owners).toEqual({ accountable: [{ name: 'roberto' }] })
  })

  test('upgrades a bare name in a single-person field', () => {
    const doc = base('    owner: {name: roberto}', '    owner: roberto')
    const report = validate(doc)

    expect(report.ok).toBe(true)
    expect(toData(doc).strategic_initiatives?.[0]?.owner).toEqual({ name: 'roberto' })
  })

  test('rejects an address that is not one', () => {
    const doc = base(
      '                - {name: roberto}',
      '                - {name: roberto, email: not-an-address}',
    )
    expect(validate(doc).errors.join('\n')).toContain("'not-an-address' is not an email")
  })

  test('leaves the document alone when there is nothing to repair', () => {
    const doc = base()
    validate(doc)
    expect(stringify(doc)).toBe(BASE)
  })
})

/**
 * The field existed before the status ladder carried the percentage. A file
 * still holding one is repaired rather than rejected.
 */
describe('a legacy progress field', () => {
  test('is retired as a repair, not an error', () => {
    const doc = base()
    doc.setIn(path.keyResult('progress'), 40)

    const report = validate(doc)

    expect(report.errors).toEqual([])
    expect(report.fixes.join('\n')).toContain('removed 40')
    expect(stringify(doc)).not.toContain('progress:')
  })

  test('leaves the status to decide the percentage', () => {
    const doc = base()
    doc.setIn(path.keyResult('progress'), 90)
    validate(doc)

    // The key result is In Progress, so 50 — the 90 is gone, not honoured.
    const keyResult =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
    expect(keyResultProgress(keyResult ?? {})).toBe(50)
  })
})

/**
 * The two roles were once named after the RACI textbook. A file written under
 * the old names opens and renames itself.
 */
describe('the old role names', () => {
  test('are renamed as a repair, not rejected', () => {
    const doc = base(
      '              accountable:',
      '              consulted:\n                - {name: maria}\n              accountable:',
    )
    const report = validate(doc)

    expect(report.errors).toEqual([])
    expect(report.fixes.join('\n')).toContain("'consulted' renamed to 'consult'")

    const keyResult =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
    expect(keyResult?.owners?.consult).toEqual([{ name: 'maria' }])
  })

  test('keep the people under them and the position of the field', () => {
    const doc = base(
      '              accountable:',
      '              informed:\n                - {name: cto}\n              accountable:',
    )
    validate(doc)

    const text = stringify(doc)
    expect(text).toContain('inform:')
    expect(text).toContain('{name: cto}')
    // Renamed in place: still the first role listed.
    expect(text.indexOf('inform:')).toBeLessThan(text.indexOf('accountable:'))
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

  test('says nothing about a status that is simply further up the ladder', () => {
    expect(warningsFor((doc) => doc.setIn(path.keyResult('status'), 'In Completion')))
      .toBe('')
  })
})

// ---------------------------------------------------------------------------
describe('progress rollup', () => {
  const kr = (status: string): KeyResult => ({ status })

  test('maps status to a percentage', () => {
    expect(keyResultProgress(kr('Not Started'))).toBe(0)
    expect(keyResultProgress(kr('Started'))).toBe(25)
    expect(keyResultProgress(kr('In Progress'))).toBe(50)
    expect(keyResultProgress(kr('In Completion'))).toBe(75)
    expect(keyResultProgress(kr('Completed'))).toBe(100)
    expect(keyResultProgress(kr('Aborted'))).toBeNull()
  })

  /**
   * What the editor labels the "no override" choice with, so the label cannot
   * drift from the table it describes.
   */
  test('every rung of the ladder carries its percentage', () => {
    expect(statusProgress('Not Started')).toBe(0)
    expect(statusProgress('Started')).toBe(25)
    expect(statusProgress('In Progress')).toBe(50)
    expect(statusProgress('In Completion')).toBe(75)
    expect(statusProgress('Completed')).toBe(100)
  })

  test('aborted work has no percentage, and nor has nonsense', () => {
    expect(statusProgress('Aborted')).toBeNull()
    expect(statusProgress(undefined)).toBeNull()
    expect(statusProgress('nonsense')).toBeNull()
  })

  test('the rungs are multiples of 5, so nothing needs rounding', () => {
    for (const status of STATUSES) {
      const value = statusProgress(status)
      if (value !== null) expect(value % 5).toBe(0)
    }
  })

  test('a key result reports exactly what its status carries', () => {
    for (const status of STATUSES) {
      expect(keyResultProgress(kr(status))).toBe(statusProgress(status))
    }
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

  /**
   * The indicators have to agree about the same record. An aborted objective
   * that still reported a percentage while its initiative excluded it made the
   * objective tab and the initiative tab contradict each other.
   */
  test('an aborted objective reports no percentage of its own', () => {
    const objective: Objective = {
      status: 'Aborted',
      key_results: [kr('Completed'), kr('In Progress')],
    }
    expect(objectiveProgress(objective)).toBeNull()
    expect(formatProgress(objectiveProgress(objective))).toBe('—')
  })

  test('an aborted initiative reports no percentage of its own', () => {
    const initiative: Initiative = {
      status: 'Aborted',
      objectives: [{ status: 'In Progress', key_results: [kr('Completed')] }],
    }
    expect(initiativeProgress(initiative)).toBeNull()
  })

  /**
   * What a tab shows. Completed and Aborted are decisions, and a summary
   * reports the decision rather than a number that would contradict it — or,
   * for aborted work, would not exist.
   */
  describe('decidedStatus', () => {
    test('names the decision when one has been taken', () => {
      expect(decidedStatus('Completed')).toBe('Completed')
      expect(decidedStatus('Aborted')).toBe('Aborted')
    })

    test('says nothing for a rung that is merely progress', () => {
      for (const rung of ['Not Started', 'Started', 'In Progress', 'In Completion']) {
        expect(decidedStatus(rung)).toBeNull()
      }
    })

    test('reads leniently, and shrugs at nonsense', () => {
      expect(decidedStatus('completed')).toBe('Completed')
      expect(decidedStatus('ABORTED')).toBe('Aborted')
      expect(decidedStatus(undefined)).toBeNull()
      expect(decidedStatus('nearly')).toBeNull()
    })
  })

  test('the other rungs leave an objective percentage to its key results', () => {
    for (const status of ['Not Started', 'Started', 'In Progress', 'Completed']) {
      const objective: Objective = {
        status,
        key_results: [kr('Completed'), kr('Not Started')],
      }
      // The status of an objective describes the objective; the percentage
      // comes from the work underneath it.
      expect(objectiveProgress(objective)).toBe(50)
    }
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

  test('rounds a percentage to the nearest 5, without decimals', () => {
    expect(formatProgress(47.5)).toBe('50%')
    expect(formatProgress(46.7)).toBe('45%')
    expect(formatProgress(41.666)).toBe('40%')
    expect(formatProgress(40)).toBe('40%')
    expect(formatProgress(null)).toBe('—')
  })

  test('keeps 0% and 100% for actually none and actually all', () => {
    expect(displayProgress(0)).toBe(0)
    expect(displayProgress(100)).toBe(100)
    // Nearly finished is not finished, and barely begun is not unbegun.
    expect(displayProgress(99.9)).toBe(95)
    expect(displayProgress(0.4)).toBe(5)
    expect(formatProgress(99.9)).toBe('95%')
  })

  test('leaves the underlying arithmetic exact', () => {
    const objective: Objective = {
      key_results: [kr('Completed'), kr('Completed'), kr('Not Started')],
    }
    expect(objectiveProgress(objective)).toBeCloseTo(66.667, 2)
    expect(formatProgress(objectiveProgress(objective))).toBe('65%')
  })
})

function round(progress: number | null): number {
  expect(progress).not.toBeNull()
  return Math.round((progress as number) * 10) / 10
}
