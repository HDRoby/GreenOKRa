import { describe, expect, test } from 'vitest'

import {
  addInitiative,
  addKeyResult,
  addLink,
  addObjective,
  addProgressNote,
  keyResultPath,
  objectivePath,
  removeLink,
  removeNote,
  setField,
  setInitiativeOwner,
  setNoteField,
  setObjectiveOwners,
  setOptionalField,
  setOwners,
  sortNotes,
  updatePerson,
} from './edit.ts'
import {
  KR_KEYS,
  OBJECTIVE_KEYS,
  SI_KEYS,
  initiativeProgress,
  parse,
  stringify,
  toData,
  validate,
} from './okr.ts'

const BASE = `version: 1

strategic_initiatives:
  # a comment that must survive every edit
  - id: TEK
    title: Technology
    owner: {name: roberto}
    timeframe: "2026"
    status: In Progress
    description: >
      Put AI into the delivery path itself rather than alongside it, and prove
      the saving against a measured baseline.
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

          - id: KR2
            target_measure: Dropped work.
            target_date: Q3
            owners:
              accountable:
                - {name: roberto}
            status: Aborted
            priority: Low
            complexity: Low
`

const initiative = ['strategic_initiatives', 0]
const objective = objectivePath(0, 0)
const keyResult = keyResultPath(0, 0, 0)

/** Every edit must leave the document valid and its comments intact. */
function expectStillSound(doc: ReturnType<typeof parse>) {
  const report = validate(doc)
  expect(report.errors).toEqual([])
  expect(stringify(doc)).toContain('# a comment that must survive every edit')
}

describe('setField', () => {
  test('keeps a folded block folded', () => {
    const doc = parse(BASE)
    setField(doc, initiative, 'description', 'A much shorter description.', SI_KEYS)

    const text = stringify(doc)
    expect(text).toContain('description: >')
    expect(text).toContain('A much shorter description.')
    expectStillSound(doc)
  })

  test('inserts a new field at its documented position, not at the end', () => {
    const doc = parse(BASE)
    setField(doc, objective, 'theme', 'AI-assisted SDLC', OBJECTIVE_KEYS)

    // The first key of a sequence item shares the line with its dash.
    const keys = stringify(doc)
      .split('\n')
      .map((line) => line.match(/^ {6}- (\w+):/) ?? line.match(/^ {8}(\w+):/))
      .filter((found) => found !== null)
      .map((found) => found[1])
    // OBJECTIVE_KEYS order puts theme after title and before status.
    expect(keys).toEqual(['id', 'title', 'theme', 'status', 'key_results'])
    expectStillSound(doc)
  })

  test('updates an existing field in place', () => {
    const doc = parse(BASE)
    setField(doc, keyResult, 'target_date', 'H2', KR_KEYS)
    expect(toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
      ?.target_date).toBe('H2')
    expectStillSound(doc)
  })
})

describe('setOptionalField', () => {
  test('removes the key when cleared', () => {
    const doc = parse(BASE)
    setOptionalField(doc, initiative, 'description', '   ', SI_KEYS)
    expect(stringify(doc)).not.toContain('description')
    expectStillSound(doc)
  })
})

describe('owners', () => {
  test('writes each person on one line, in a block list', () => {
    const doc = parse(BASE)
    setOwners(doc, keyResult, 'responsible', [
      { name: 'maria', email: 'maria@example.com' },
      { name: 'luca' },
    ])

    const text = stringify(doc)
    expect(text).toContain('- {name: maria, email: maria@example.com}')
    // No email written where there is none, rather than an empty key.
    expect(text).toContain('- {name: luca}')
    expectStillSound(doc)
  })

  test('removes a role when its list is emptied', () => {
    const doc = parse(BASE)
    setOwners(doc, keyResult, 'responsible', [{ name: 'maria' }])
    setOwners(doc, keyResult, 'responsible', [])
    expect(stringify(doc)).not.toContain('responsible')
    expectStillSound(doc)
  })

  test('writes objective owners in documented position', () => {
    const doc = parse(BASE)
    setObjectiveOwners(doc, objective, [{ name: 'roberto' }, { name: 'maria' }])
    expect(stringify(doc)).toContain('owners:')
    expectStillSound(doc)
  })

  test('sets and clears the single owner of an initiative', () => {
    const doc = parse(BASE)
    setInitiativeOwner(doc, initiative, {
      name: 'maria',
      email: 'maria@example.com',
    })
    expect(stringify(doc)).toContain('owner: {name: maria, email: maria@example.com}')

    setInitiativeOwner(doc, initiative, null)
    expect(stringify(doc)).not.toContain('owner:')
  })
})

/**
 * An address is a person's identity, so correcting one has to reach every
 * place they appear — otherwise fixing it here leaves it wrong in nineteen
 * other key results.
 */
describe('updatePerson', () => {
  const withPeople = () => {
    const doc = parse(BASE)
    setInitiativeOwner(doc, initiative, { name: 'maria' })
    setObjectiveOwners(doc, objective, [{ name: 'maria' }, { name: 'luca' }])
    setOwners(doc, keyResult, 'responsible', [{ name: 'maria' }])
    setOwners(doc, keyResultPath(0, 0, 1), 'consult', [{ name: 'maria' }])
    return doc
  }

  test('reaches every occurrence, at every level', () => {
    const doc = withPeople()

    const changed = updatePerson(doc, 'maria', {
      name: 'Maria Rossi',
      email: 'maria.rossi@example.com',
    })

    // Initiative owner, objective owners, and two key results.
    expect(changed).toBe(4)
    const text = stringify(doc)
    expect(text).not.toContain('{name: maria}')
    expect(text.match(/maria\.rossi@example\.com/g)).toHaveLength(4)
    expectStillSound(doc)
  })

  test('leaves everybody else alone', () => {
    const doc = withPeople()
    updatePerson(doc, 'maria', { name: 'Maria Rossi' })
    expect(stringify(doc)).toContain('{name: luca}')
  })

  test('matches on identity, which is what an address is for', () => {
    const doc = parse(BASE)
    setOwners(doc, keyResult, 'responsible', [
      { name: 'spelled one way', email: 'shared@example.com' },
    ])
    setOwners(doc, keyResultPath(0, 0, 1), 'consult', [
      { name: 'spelled another', email: 'shared@example.com' },
    ])

    // Both entries are the same person, however their name was typed.
    expect(updatePerson(doc, 'shared@example.com', {
      name: 'Agreed Spelling',
      email: 'shared@example.com',
    })).toBe(2)
    expect(stringify(doc)).not.toContain('spelled')
  })

  test('reports nothing changed when nobody matches', () => {
    expect(updatePerson(withPeople(), 'nobody@example.com', { name: 'x' })).toBe(0)
  })
})

describe('progress notes', () => {
  test('creates the list and puts the newest entry first', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-06-01', 'Older entry.')
    addProgressNote(doc, keyResult, '2026-08-01', 'Newer entry.')

    const notes =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes
    expect(notes?.map((note) => note.date)).toEqual(['2026-08-01', '2026-06-01'])
    // Most-recent-first is what the validator expects, so no warning.
    expect(validate(doc).warnings).toEqual([])
    expectStillSound(doc)
  })

  /**
   * A note can be dated anything, not just today, so the log is re-sorted on
   * every insertion rather than trusting the newest arrival to be latest.
   */
  test('reorders by date when a note is backdated', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'August.')
    addProgressNote(doc, keyResult, '2026-06-01', 'Backdated to June.')
    addProgressNote(doc, keyResult, '2026-07-01', 'Backdated to July.')

    const notes =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes
    expect(notes?.map((note) => note.date)).toEqual([
      '2026-08-01',
      '2026-07-01',
      '2026-06-01',
    ])
    // Newest first is what the validator wants, so no warning either.
    expect(validate(doc).warnings).toEqual([])
  })

  test('puts a note sharing a date on top of the existing one', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'First written.')
    addProgressNote(doc, keyResult, '2026-08-01', 'Written later.')

    const notes =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes
    expect(notes?.map((note) => note.note)).toEqual([
      'Written later.',
      'First written.',
    ])
  })

  test('an existing note can be edited', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'First draft of the note.')

    setNoteField(doc, keyResult, 0, 'note', 'Corrected wording.')

    const notes =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes
    expect(notes?.[0]?.note).toBe('Corrected wording.')
    expect(validate(doc).errors).toEqual([])
  })

  test('re-dating a note moves it, but only when the log is sorted', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'August.')
    addProgressNote(doc, keyResult, '2026-06-01', 'June.')

    const dates = () =>
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes?.map((note) => note.date)
    expect(dates()).toEqual(['2026-08-01', '2026-06-01'])

    // Backdate the top entry. It stays put while the date is being chosen.
    setNoteField(doc, keyResult, 0, 'date', '2026-05-01')
    expect(dates()).toEqual(['2026-05-01', '2026-06-01'])

    sortNotes(doc, keyResult)
    expect(dates()).toEqual(['2026-06-01', '2026-05-01'])
    expect(validate(doc).warnings).toEqual([])
  })

  test('emptying a note removes it', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-06-01', 'June.')
    addProgressNote(doc, keyResult, '2026-08-01', 'August.')

    setNoteField(doc, keyResult, 0, 'note', '   ')

    const notes =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes
    expect(notes?.map((note) => note.note)).toEqual(['June.'])
    expect(validate(doc).errors).toEqual([])
  })

  test('emptying the last note removes the whole field', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'The only note.')

    setNoteField(doc, keyResult, 0, 'note', '')

    // An empty list would be legal but pointless, and the field is optional.
    expect(stringify(doc)).not.toContain('progress_notes')
    expectStillSound(doc)
  })

  test('removeNote leaves the other entries in order', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-06-01', 'June.')
    addProgressNote(doc, keyResult, '2026-07-01', 'July.')
    addProgressNote(doc, keyResult, '2026-08-01', 'August.')

    removeNote(doc, keyResult, 1) // July, the middle one

    const notes =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.[0]
        ?.progress_notes
    expect(notes?.map((note) => note.note)).toEqual(['August.', 'June.'])
    expectStillSound(doc)
  })

  test('clearing the date is left as a validation error, not a deletion', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'Still worth keeping.')

    setNoteField(doc, keyResult, 0, 'date', '')

    // The note still says something, so it is incomplete rather than unwanted.
    expect(validate(doc).errors.join('\n')).toContain(
      "progress_notes[0].date: '' is not a YYYY-MM-DD date",
    )
  })

  test('editing a note leaves the rest of the document alone', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'A note.')
    setNoteField(doc, keyResult, 0, 'note', 'Edited.')
    expectStillSound(doc)
  })

  test('lands after complexity, where SPEC.md puts it', () => {
    const doc = parse(BASE)
    addProgressNote(doc, keyResult, '2026-08-01', 'A note.')
    const text = stringify(doc)
    expect(text.indexOf('progress_notes')).toBeGreaterThan(text.indexOf('complexity'))
  })
})

describe('adding things', () => {
  test('never reissues an identifier', () => {
    const doc = parse(BASE)
    // KR2 exists but is Aborted. The next key result must be KR3.
    addKeyResult(doc, objective)
    const ids =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results?.map(
        (keyResult) => keyResult.id,
      )
    expect(ids).toEqual(['KR1', 'KR2', 'KR3'])
  })

  test('a new key result reports exactly what still needs filling in', () => {
    const doc = parse(BASE)
    addKeyResult(doc, objective)
    const errors = validate(doc).errors.join('\n')

    expect(errors).toContain('TEK.O1.KR3.target_measure: must not be empty')
    expect(errors).toContain('TEK.O1.KR3.target_date: must not be empty')
    expect(errors).toContain('TEK.O1.KR3.owners: at least one owner is required')
    // Nothing else is wrong with the document.
    expect(validate(doc).errors).toHaveLength(3)
  })

  test('a new objective arrives with one key result', () => {
    const doc = parse(BASE)
    addObjective(doc, initiative)
    const objectives = toData(doc).strategic_initiatives?.[0]?.objectives
    expect(objectives?.[1]?.id).toBe('O2')
    expect(objectives?.[1]?.key_results?.[0]?.id).toBe('KR1')
    expect(objectives?.[1]?.status).toBe('Not Started')
  })

  test('a new initiative upper-cases its id', () => {
    const doc = parse(BASE)
    addInitiative(doc, 'pep', 'People', '2026')
    const initiatives = toData(doc).strategic_initiatives
    expect(initiatives?.[1]?.id).toBe('PEP')
    expect(initiatives?.[1]?.title).toBe('People')
    expect(initiatives?.[1]?.timeframe).toBe('2026')
  })
})

describe('links', () => {
  test('adds, edits and removes', () => {
    const doc = parse(BASE)
    addLink(doc, objective)
    setField(doc, [...objective, 'links', 0], 'title', 'Charter', ['title', 'url'])
    setField(doc, [...objective, 'links', 0], 'url', 'https://example.com', [
      'title',
      'url',
    ])

    let links = toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.links
    expect(links).toEqual([{ title: 'Charter', url: 'https://example.com' }])
    expectStillSound(doc)

    removeLink(doc, objective, 0)
    links = toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.links
    // The whole key goes, rather than leaving an empty list behind.
    expect(links).toBeUndefined()
    expect(stringify(doc)).not.toContain('links')
    expectStillSound(doc)
  })
})

describe('a full editing session', () => {
  test('survives many edits and stays loadable', () => {
    const doc = parse(BASE)

    setField(doc, initiative, 'title', 'Technology & Platform', SI_KEYS)
    setField(doc, objective, 'title', 'Make the SDLC AI-assisted', OBJECTIVE_KEYS)
    setOptionalField(doc, objective, 'theme', 'AI-assisted SDLC', OBJECTIVE_KEYS)
    setField(doc, keyResult, 'status', 'Completed', KR_KEYS)
    setOwners(doc, keyResult, 'inform', [{ name: 'cto' }])
    addProgressNote(doc, keyResult, '2026-08-31', 'Hit the target.')
    addKeyResult(doc, objective)
    setField(doc, keyResultPath(0, 0, 2), 'target_measure', 'Something new.', KR_KEYS)
    setField(doc, keyResultPath(0, 0, 2), 'target_date', 'Q4', KR_KEYS)
    setOwners(doc, keyResultPath(0, 0, 2), 'accountable', [{ name: 'roberto' }])

    const report = validate(doc)
    expect(report.errors).toEqual([])

    const reloaded = parse(stringify(doc))
    expect(validate(reloaded).errors).toEqual([])
    expect(stringify(reloaded)).toContain('# a comment that must survive every edit')

    const data = toData(reloaded).strategic_initiatives?.[0]
    expect(data?.title).toBe('Technology & Platform')
    // KR1 Completed, KR2 Aborted (excluded), KR3 Not Started -> 50%
    expect(initiativeProgress(data ?? {})).toBe(50)
  })
})
