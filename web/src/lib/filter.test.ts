import { describe, expect, test } from 'vitest'

import {
  EVERYONE,
  filterablePeople,
  initiativeInvolves,
  keyResultInvolves,
  objectiveInvolves,
  ownsInitiative,
  ownsObjective,
  visibleInitiatives,
  visibleKeyResults,
  visibleObjectives,
  withIndices,
} from './filter.ts'
import { collectPeople } from './labels.ts'
import { type Initiative, type OkrFile, parse, toData } from './okr.ts'

/**
 * Three initiatives. maria appears only deep inside PRO; marco owns TEK
 * outright but is named on nothing below it.
 */
const FILE = `version: 1
strategic_initiatives:
  - id: PEP
    title: People
    owner: roberto
    timeframe: "2026"
    status: In Progress
    objectives:
      - id: O1
        title: Owned by elena
        owners: [elena]
        status: In Progress
        key_results:
          - id: KR1
            target_measure: One.
            target_date: Q1
            owners:
              accountable: [roberto]
            status: In Progress
            priority: High
            complexity: Low
          - id: KR2
            target_measure: Two.
            target_date: Q2
            owners:
              accountable: [luca]
            status: Not Started
            priority: Low
            complexity: Low
  - id: PRO
    title: Process
    owner: roberto
    timeframe: "2026"
    status: In Progress
    objectives:
      - id: O1
        title: Nobody special
        status: Not Started
        key_results:
          - id: KR1
            target_measure: Three.
            target_date: Q3
            owners:
              accountable: [luca]
            status: Not Started
            priority: Low
            complexity: Low
      - id: O2
        title: Has maria deep inside
        status: Not Started
        key_results:
          - id: KR1
            target_measure: Four.
            target_date: Q4
            owners:
              accountable: [luca]
              consulted: [maria]
            status: Not Started
            priority: Low
            complexity: Low
  - id: TEK
    title: Technology
    owner: marco
    timeframe: "2026"
    status: Not Started
    objectives:
      - id: O1
        title: Nothing names marco below here
        status: Not Started
        key_results:
          - id: KR1
            target_measure: Five.
            target_date: Q1
            owners:
              accountable: [luca]
            status: Not Started
            priority: Low
            complexity: Low
`

const data: OkrFile = toData(parse(FILE))
const initiatives = data.strategic_initiatives ?? []
const find = (id: string): Initiative =>
  initiatives.find((initiative) => initiative.id === id) as Initiative

// ---------------------------------------------------------------------------
describe('involvement', () => {
  test('a key result counts accountable and responsible', () => {
    const keyResult = find('PRO').objectives?.[1]?.key_results?.[0]
    expect(keyResultInvolves(keyResult ?? {}, 'luca')).toBe(true) // accountable
    expect(keyResultInvolves(keyResult ?? {}, 'roberto')).toBe(false)
  })

  /**
   * Being consulted or informed is being kept in the loop, not owning the
   * work. Counting those roles would make a filter on anyone senior return
   * most of the file.
   */
  test('a key result ignores consulted and informed', () => {
    const keyResult = find('PRO').objectives?.[1]?.key_results?.[0]
    // maria is consulted on this one, and nothing else.
    expect(keyResultInvolves(keyResult ?? {}, 'maria')).toBe(false)
    expect(keyResultInvolves({ owners: { informed: ['cto'] } }, 'cto')).toBe(false)
    expect(keyResultInvolves({ owners: { responsible: ['cto'] } }, 'cto')).toBe(true)
  })

  test('an objective counts its own owners and its key results', () => {
    const objective = find('PEP').objectives?.[0]
    expect(objectiveInvolves(objective ?? {}, 'elena')).toBe(true) // named on it
    expect(objectiveInvolves(objective ?? {}, 'roberto')).toBe(true) // via KR1
    expect(objectiveInvolves(objective ?? {}, 'marco')).toBe(false)
  })

  test('an initiative counts its owner and everything below it', () => {
    expect(initiativeInvolves(find('TEK'), 'marco')).toBe(true) // owner only
    expect(initiativeInvolves(find('PEP'), 'luca')).toBe(true) // buried in O1.KR2
    expect(initiativeInvolves(find('PEP'), 'maria')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('who the filter offers', () => {
  /**
   * Narrower than the names the owner fields offer. A name that could never
   * match anything would be a dead choice in the list.
   */
  test('lists only people who own work somewhere', () => {
    expect(filterablePeople(data)).toEqual(['elena', 'luca', 'marco', 'roberto'])
  })

  test('leaves out anyone who is only consulted or informed', () => {
    // maria is consulted on PRO.O2.KR1 and appears nowhere else.
    expect(collectPeople(data)).toContain('maria')
    expect(filterablePeople(data)).not.toContain('maria')
  })

  test('every offered name actually matches something', () => {
    for (const person of filterablePeople(data)) {
      expect(visibleInitiatives(initiatives, person).length).toBeGreaterThan(0)
    }
  })

  test('copes with an empty file', () => {
    expect(filterablePeople(null)).toEqual([])
    expect(filterablePeople({})).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('indices survive filtering', () => {
  /**
   * The whole point: a filtered list must report where each item really sits,
   * because that index is what edits are addressed to.
   */
  test('a filtered initiative keeps its true position', () => {
    const visible = visibleInitiatives(initiatives, 'elena')

    expect(visible).toHaveLength(1)
    expect(visible[0]?.item.id).toBe('PEP')
    expect(visible[0]?.index).toBe(0)
  })

  test('a filtered objective keeps its true position', () => {
    // PRO.O2.KR1 makes luca relevant; PRO.O1.KR1 does too, so narrow to
    // someone present in only the second objective.
    const objectives = find('PRO').objectives ?? []
    const visible = visibleObjectives(objectives, 'sofia', false)
    expect(visible).toEqual([])

    const both = visibleObjectives(objectives, 'luca', false)
    expect(both.map(({ index }) => index)).toEqual([0, 1])
  })

  test('a filtered key result keeps its true position', () => {
    const keyResults = find('PEP').objectives?.[0]?.key_results ?? []
    const visible = visibleKeyResults(keyResults, 'luca', false)

    expect(visible).toHaveLength(1)
    expect(visible[0]?.item.id).toBe('KR2')
    expect(visible[0]?.index).toBe(1)
  })

  test('withIndices without a predicate enumerates everything', () => {
    expect(withIndices(['a', 'b', 'c']).map(({ index }) => index)).toEqual([0, 1, 2])
  })
})

// ---------------------------------------------------------------------------
describe('the default view', () => {
  test('EVERYONE shows everything, at every level', () => {
    expect(visibleInitiatives(initiatives, EVERYONE)).toHaveLength(3)
    expect(visibleObjectives(find('PRO').objectives ?? [], EVERYONE, false)).toHaveLength(2)
    expect(
      visibleKeyResults(find('PEP').objectives?.[0]?.key_results ?? [], EVERYONE, false),
    ).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
describe('matching inherits downwards', () => {
  test('owning an initiative shows all of its objectives', () => {
    expect(ownsInitiative(find('TEK'), 'marco')).toBe(true)

    // marco is named on nothing below TEK, so without inheritance the
    // initiative would appear with nothing in it.
    expect(visibleObjectives(find('TEK').objectives ?? [], 'marco', false)).toHaveLength(0)
    expect(visibleObjectives(find('TEK').objectives ?? [], 'marco', true)).toHaveLength(1)
  })

  test('being named on an objective shows all of its key results', () => {
    const objective = find('PEP').objectives?.[0]
    expect(ownsObjective(objective ?? {}, 'elena')).toBe(true)

    const keyResults = objective?.key_results ?? []
    expect(visibleKeyResults(keyResults, 'elena', false)).toHaveLength(0)
    expect(visibleKeyResults(keyResults, 'elena', true)).toHaveLength(2)
  })

  test('someone named only on one key result does not inherit the rest', () => {
    const objective = find('PEP').objectives?.[0]
    expect(ownsObjective(objective ?? {}, 'roberto')).toBe(false)
    expect(visibleKeyResults(objective?.key_results ?? [], 'roberto', false)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('a person with no involvement', () => {
  test('hides everything rather than showing empty shells', () => {
    expect(visibleInitiatives(initiatives, 'nobody')).toEqual([])
    // Consulted-only counts as no involvement.
    expect(visibleInitiatives(initiatives, 'maria')).toEqual([])
  })
})
