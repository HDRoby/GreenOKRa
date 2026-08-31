import { describe, expect, test } from 'vitest'

import {
  isDate,
  periodEndIso,
  periodOf,
  resolveDate,
  timeframeGroups,
  timeframePeriod,
  yearOf,
} from './dates.ts'
import {
  applyStatusRules,
  setField,
  setInitiativeOwner,
  setOptionalField,
  setOwners,
  statusOptions,
} from './edit.ts'
import {
  collectPeople,
  collectPools,
  collectThemes,
  labelTint,
  personLabel,
} from './labels.ts'
import {
  KR_KEYS,
  OBJECTIVE_KEYS,
  SI_KEYS,
  parse,
  stringify,
  toData,
  validate,
} from './okr.ts'

const FILE = `version: 1
strategic_initiatives:
  - id: TEK
    title: Technology
    owner: {name: roberto}
    timeframe: "2026"
    status: Not Started
    objectives:
      - id: O1
        title: First
        owners:
          - {name: elena}
        status: Not Started
        key_results:
          - id: KR1
            target_measure: A thing.
            target_date: Q3
            owners:
              accountable:
                - {name: roberto}
              responsible:
                - {name: maria}
                - {name: luca}
            status: Not Started
            priority: High
            complexity: Medium
      - id: O2
        title: Second
        status: Not Started
        key_results:
          - id: KR1
            target_measure: Another thing.
            target_date: "2026-09-30"
            owners:
              accountable:
                - {name: marco}
              inform:
                - {name: cto}
            status: Not Started
            priority: Low
            complexity: Low
`

const objectiveStatus = (index: number) => [
  'strategic_initiatives',
  0,
  'objectives',
  index,
]

/** The display names in a document, which is what the assertions care about. */
const names = (doc: ReturnType<typeof parse>) =>
  collectPeople(toData(doc)).map(personLabel)

const keyResultStatus = (objective: number, keyResult: number) => [
  ...objectiveStatus(objective),
  'key_results',
  keyResult,
]

// --------------------------------------------------------------------------
describe('target dates', () => {
  test('recognises what it is looking at', () => {
    expect(isDate('2026-09-30')).toBe(true)
    expect(isDate('Q3')).toBe(false)
    expect(periodOf('q3')).toBe('Q3')
    expect(periodOf('H2')).toBe('H2')
    expect(periodOf('September')).toBeNull()
  })

  test('finds the year in any timeframe spelling', () => {
    expect(yearOf('2026')).toBe(2026)
    expect(yearOf('2026-Q3')).toBe(2026)
    expect(yearOf('H1-2026')).toBe(2026)
    expect(yearOf(undefined)).toBeNull()
    expect(yearOf('next year')).toBeNull()
  })

  test('resolves a period to the day it actually falls due', () => {
    expect(resolveDate('Q1', '2026')).toBe('2026/03/31')
    expect(resolveDate('Q2', '2026')).toBe('2026/06/30')
    expect(resolveDate('Q3', '2026')).toBe('2026/09/30')
    expect(resolveDate('Q4', '2026')).toBe('2026/12/31')
    expect(resolveDate('H1', '2026')).toBe('2026/06/30')
    expect(resolveDate('H2', '2026')).toBe('2026/12/31')
  })

  test('passes a real date straight through', () => {
    expect(resolveDate('2026-04-30', '2026')).toBe('2026/04/30')
  })

  test('gives up rather than guessing', () => {
    expect(resolveDate('Q3', undefined)).toBeNull()
    expect(resolveDate('September', '2026')).toBeNull()
    expect(resolveDate(undefined, '2026')).toBeNull()
  })

  test('offers an ISO date when switching a label to a real date', () => {
    expect(periodEndIso('Q3', '2026')).toBe('2026-09-30')
    expect(periodEndIso('nonsense', '2026')).toBeNull()
  })
})

describe('timeframes', () => {
  test('offers this year and next as a year, half or quarter', () => {
    const groups = timeframeGroups(2026)

    expect(groups.map((group) => group.year)).toEqual([2026, 2027])
    expect(groups[0]?.values).toEqual([
      '2026',
      '2026.H1',
      '2026.H2',
      '2026.Q1',
      '2026.Q2',
      '2026.Q3',
      '2026.Q4',
    ])
    expect(groups[1]?.values[0]).toBe('2027')
  })

  test('reads the year out of every timeframe form', () => {
    for (const timeframe of ['2026', '2026.H1', '2026.Q3', '2026-Q3']) {
      expect(yearOf(timeframe)).toBe(2026)
    }
  })

  test('reads the narrowing period, when there is one', () => {
    expect(timeframePeriod('2026')).toBeNull()
    expect(timeframePeriod('2026.H1')).toBe('H1')
    expect(timeframePeriod('2026.Q4')).toBe('Q4')
    expect(timeframePeriod('2026-Q3')).toBe('Q3')
    expect(timeframePeriod(undefined)).toBeNull()
  })

  test('resolves target dates against a narrowed timeframe', () => {
    // The year is what matters; the narrowing does not change the due date.
    expect(resolveDate('Q3', '2026.H2')).toBe('2026/09/30')
  })
})

// --------------------------------------------------------------------------
describe('people', () => {
  test('collects every name in the file, deduplicated and sorted', () => {
    expect(collectPeople(toData(parse(FILE))).map(personLabel)).toEqual([
      'cto',
      'elena',
      'luca',
      'marco',
      'maria',
      'roberto',
    ])
  })

  test('copes with an empty file', () => {
    expect(collectPeople(null)).toEqual([])
    expect(collectPeople({})).toEqual([])
  })

  test('gives a name the same colour every time', () => {
    expect(labelTint('roberto')).toEqual(labelTint('roberto'))
    expect(labelTint('roberto')).not.toEqual(labelTint('maria'))
  })

  /**
   * The list is derived from the document, never kept alongside it. So a name
   * added in one field is offered by every other owner field straight away, and
   * one that is removed again stops being offered — no separate pool to go
   * stale, and nothing to clean up.
   */
  test('a name added in one field becomes available everywhere', () => {
    const doc = parse(FILE)
    expect(names(doc)).not.toContain('sofia')

    setOwners(doc, keyResultStatus(0, 0), 'consult', [{ name: 'sofia' }])
    expect(names(doc)).toContain('sofia')
  })

  test('a name removed again stops being offered', () => {
    const doc = parse(FILE)
    setOwners(doc, keyResultStatus(0, 0), 'consult', [{ name: 'sofia' }])
    setOwners(doc, keyResultStatus(0, 0), 'consult', [])

    expect(names(doc)).not.toContain('sofia')
  })

  test('a name still used elsewhere survives being removed from one field', () => {
    const doc = parse(FILE)
    setOwners(doc, keyResultStatus(0, 0), 'consult', [{ name: 'sofia' }])
    setOwners(doc, keyResultStatus(1, 0), 'inform', [
      { name: 'cto' },
      { name: 'sofia' },
    ])

    setOwners(doc, keyResultStatus(0, 0), 'consult', [])

    expect(names(doc)).toContain('sofia')
  })

  test('the initiative owner draws on the same pool', () => {
    const doc = parse(FILE)
    setInitiativeOwner(doc, ['strategic_initiatives', 0], { name: 'sofia' })
    expect(names(doc)).toContain('sofia')
  })

  test('the same address written with two names counts once', () => {
    const doc = parse(FILE)
    setOwners(doc, keyResultStatus(0, 0), 'consult', [
      { name: 'Sofia Ricci', email: 'sofia@example.com' },
    ])
    setOwners(doc, keyResultStatus(1, 0), 'inform', [
      { name: 'sofia.ricci', email: 'sofia@example.com' },
    ])

    const matching = collectPeople(toData(doc)).filter(
      (person) => person.email === 'sofia@example.com',
    )
    expect(matching).toHaveLength(1)
  })
})

// --------------------------------------------------------------------------
describe('themes', () => {
  test('collects the themes in the file, deduplicated and sorted', () => {
    const doc = parse(FILE)
    // The fixture has none to begin with.
    expect(collectThemes(toData(doc))).toEqual([])

    setOptionalField(doc, objectiveStatus(0), 'theme', 'Shared capability', OBJECTIVE_KEYS)
    setOptionalField(doc, objectiveStatus(1), 'theme', 'AI-assisted SDLC', OBJECTIVE_KEYS)

    expect(collectThemes(toData(doc))).toEqual([
      'AI-assisted SDLC',
      'Shared capability',
    ])
  })

  test('counts a theme shared by two objectives once', () => {
    const doc = parse(FILE)
    setOptionalField(doc, objectiveStatus(0), 'theme', 'Governance', OBJECTIVE_KEYS)
    setOptionalField(doc, objectiveStatus(1), 'theme', 'Governance', OBJECTIVE_KEYS)

    expect(collectThemes(toData(doc))).toEqual(['Governance'])
  })

  test('a theme entered once becomes available to other objectives', () => {
    const doc = parse(FILE)
    setOptionalField(doc, objectiveStatus(0), 'theme', 'Governance', OBJECTIVE_KEYS)
    expect(collectThemes(toData(doc))).toContain('Governance')
  })

  test('clearing the only use stops it being offered', () => {
    const doc = parse(FILE)
    setOptionalField(doc, objectiveStatus(0), 'theme', 'Governance', OBJECTIVE_KEYS)
    setOptionalField(doc, objectiveStatus(0), 'theme', '', OBJECTIVE_KEYS)

    expect(collectThemes(toData(doc))).toEqual([])
    // Clearing removes the key rather than leaving an empty one behind.
    expect(stringify(doc)).not.toContain('theme')
    expect(validate(doc).errors).toEqual([])
  })

  test('collectPools gathers both lists at once', () => {
    const doc = parse(FILE)
    setOptionalField(doc, objectiveStatus(0), 'theme', 'Governance', OBJECTIVE_KEYS)

    const pools = collectPools(toData(doc))
    expect(pools.people.map(personLabel)).toEqual([
      'cto',
      'elena',
      'luca',
      'marco',
      'maria',
      'roberto',
    ])
    expect(pools.themes).toEqual(['Governance'])
  })
})

// --------------------------------------------------------------------------
describe('status rules', () => {
  test('advances to In Progress once an objective is', () => {
    const doc = parse(FILE)
    expect(applyStatusRules(doc)).toEqual([])

    setField(doc, objectiveStatus(1), 'status', 'In Progress', SI_KEYS)
    expect(applyStatusRules(doc)).toEqual(['TEK'])
    expect(toData(doc).strategic_initiatives?.[0]?.status).toBe('In Progress')
  })

  test('is idempotent', () => {
    const doc = parse(FILE)
    setField(doc, objectiveStatus(0), 'status', 'In Progress', SI_KEYS)
    expect(applyStatusRules(doc)).toEqual(['TEK'])
    expect(applyStatusRules(doc)).toEqual([])
  })

  test('never overrides a human decision', () => {
    for (const decision of ['Completed', 'Aborted']) {
      const doc = parse(FILE)
      setField(doc, ['strategic_initiatives', 0], 'status', decision, SI_KEYS)
      setField(doc, objectiveStatus(0), 'status', 'In Progress', SI_KEYS)

      expect(applyStatusRules(doc)).toEqual([])
      expect(toData(doc).strategic_initiatives?.[0]?.status).toBe(decision)
    }
  })

  test('does not roll back when work stops', () => {
    const doc = parse(FILE)
    setField(doc, objectiveStatus(0), 'status', 'In Progress', SI_KEYS)
    applyStatusRules(doc)
    setField(doc, objectiveStatus(0), 'status', 'Not Started', SI_KEYS)

    applyStatusRules(doc)
    expect(toData(doc).strategic_initiatives?.[0]?.status).toBe('In Progress')
  })

  /**
   * "Begun" is any rung above Not Started, so the lowest one counts — and so
   * does work that is already finished.
   */
  test('advances on any rung above Not Started', () => {
    for (const rung of ['Started', 'In Progress', 'In Completion', 'Completed']) {
      const doc = parse(FILE)
      setField(doc, keyResultStatus(0, 0), 'status', rung, KR_KEYS)
      expect(applyStatusRules(doc)).toEqual(['TEK.O1', 'TEK'])
    }
  })

  test('an aborted key result does not count as begun', () => {
    const doc = parse(FILE)
    setField(doc, keyResultStatus(0, 0), 'status', 'Aborted', KR_KEYS)
    expect(applyStatusRules(doc)).toEqual([])
  })

  test('advances an objective once a key result is in progress', () => {
    const doc = parse(FILE)
    setField(doc, keyResultStatus(0, 0), 'status', 'In Progress', KR_KEYS)

    // One pass carries it up both levels: the key result moves its objective,
    // and the objective moves its initiative.
    expect(applyStatusRules(doc)).toEqual(['TEK.O1', 'TEK'])

    const initiative = toData(doc).strategic_initiatives?.[0]
    expect(initiative?.objectives?.[0]?.status).toBe('In Progress')
    expect(initiative?.status).toBe('In Progress')
    // The untouched objective stays where it was.
    expect(initiative?.objectives?.[1]?.status).toBe('Not Started')
  })

  test('never overrides a decision on an objective', () => {
    for (const decision of ['Completed', 'Aborted']) {
      const doc = parse(FILE)
      setField(doc, objectiveStatus(0), 'status', decision, OBJECTIVE_KEYS)
      setField(doc, keyResultStatus(0, 0), 'status', 'In Progress', KR_KEYS)

      applyStatusRules(doc)
      expect(toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.status).toBe(
        decision,
      )
    }
  })

  test('an aborted objective does not start its initiative', () => {
    const doc = parse(FILE)
    setField(doc, objectiveStatus(0), 'status', 'Aborted', OBJECTIVE_KEYS)
    setField(doc, keyResultStatus(0, 0), 'status', 'In Progress', KR_KEYS)

    expect(applyStatusRules(doc)).toEqual([])
    expect(toData(doc).strategic_initiatives?.[0]?.status).toBe('Not Started')
  })

  test('leaves a file alone when nothing has begun', () => {
    const doc = parse(FILE)
    const before = stringify(doc)
    expect(applyStatusRules(doc)).toEqual([])
    expect(stringify(doc)).toBe(before)
  })

  describe('the dropdown', () => {
    test('offers only the human decisions while the status is derived', () => {
      expect(statusOptions('Not Started')).toEqual([
        'Not Started',
        'Completed',
        'Aborted',
      ])
      expect(statusOptions('In Progress')).toEqual([
        'In Progress',
        'Completed',
        'Aborted',
      ])
    })

    test('lets a decision be undone', () => {
      expect(statusOptions('Completed')).toEqual([
        'Completed',
        'In Progress',
        'Aborted',
      ])
      expect(statusOptions('Aborted')).toEqual([
        'Aborted',
        'In Progress',
        'Completed',
      ])
    })

    test('never offers Not Started as a choice', () => {
      for (const current of ['In Progress', 'Completed', 'Aborted']) {
        expect(statusOptions(current)).not.toContain('Not Started')
      }
    })

    test('copes with a missing or unreadable status', () => {
      expect(statusOptions(undefined)).toEqual(['Completed', 'Aborted'])
      expect(statusOptions('nonsense')).toEqual(['Completed', 'Aborted'])
    })
  })
})
