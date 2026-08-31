import { describe, expect, test } from 'vitest'

import {
  addInitiative,
  addKeyResult,
  addLink,
  addObjective,
  addPerson,
  addProgressNote,
  keyResultPath,
  objectivePath,
  removeInitiative,
  removeKeyResult,
  removeLink,
  removeObjective,
  removeNote,
  setField,
  setInitiativeOwner,
  setNoteField,
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
people:
  - {name: roberto}

strategic_initiatives:
  # a comment that must survive every edit
  - id: TEK
    title: Technology
    owner: roberto
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
                - roberto
            status: In Progress
            priority: High
            complexity: Medium

          - id: KR2
            target_measure: Dropped work.
            target_date: Q3
            owners:
              accountable:
                - roberto
            status: Aborted
            priority: Low
            complexity: Low
`

const initiative = ['strategic_initiatives', 0]
const objective = objectivePath(0, 0)
const keyResult = keyResultPath(0, 0, 0)

/** A form draft with only the two fields that have no sensible default. */
const draftFor = (id: string, title: string) => ({
  id,
  title,
  description: '',
  status: 'Not Started',
  owner: '',
  timeframe: '2026',
  cadence: 'Weekly',
})

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
  test('writes references, one per line', () => {
    const doc = parse(BASE)
    setOwners(doc, keyResult, 'responsible', ['maria@example.com', 'luca'])

    const text = stringify(doc)
    expect(text).toContain('- maria@example.com')
    expect(text).toContain('- luca')
    // The people themselves are defined once, at the top.
    expect(text).not.toContain('responsible:\n                - {name:')
  })

  test('removes a role when its list is emptied', () => {
    const doc = parse(BASE)
    setOwners(doc, keyResult, 'responsible', ['maria'])
    setOwners(doc, keyResult, 'responsible', [])
    expect(stringify(doc)).not.toContain('responsible')
  })

  test('sets and clears the single owner of an initiative', () => {
    const doc = parse(BASE)
    setInitiativeOwner(doc, initiative, 'maria@example.com')
    expect(stringify(doc)).toContain('owner: maria@example.com')

    setInitiativeOwner(doc, initiative, null)
    expect(stringify(doc)).not.toContain('owner:')
  })
})

describe('the roster', () => {
  test('adds somebody once, and says how to refer to them', () => {
    const doc = parse(BASE)

    const identity = addPerson(doc, {
      name: 'Maria Rossi',
      email: 'maria.rossi@example.com',
    })
    addPerson(doc, { name: 'Maria Rossi', email: 'maria.rossi@example.com' })

    expect(identity).toBe('maria.rossi@example.com')
    const roster = toData(doc).people ?? []
    expect(roster.filter((p) => p.email === 'maria.rossi@example.com')).toHaveLength(1)
  })

  test('creates the roster above the OKRs when there is none', () => {
    const doc = parse(BASE)
    addPerson(doc, { name: 'solo' })
    const text = stringify(doc)
    expect(text.indexOf('people:')).toBeLessThan(text.indexOf('strategic_initiatives:'))
  })

  /**
   * The entry is the only definition, so a correction lands in one place. But
   * adding an address changes how the person is identified, and every
   * reference has to follow or the OKRs point at somebody who no longer exists.
   */
  test('correcting an address touches only the roster', () => {
    const doc = parse(BASE)
    addPerson(doc, { name: 'maria', email: 'maria@example.com' })
    setOwners(doc, keyResult, 'responsible', ['maria@example.com'])

    // The address is unchanged, so the identity is too: nothing to move.
    const moved = updatePerson(doc, 'maria@example.com', {
      name: 'Maria Rossi',
      email: 'maria@example.com',
    })

    expect(moved).toBe(0)
    expect(toData(doc).people).toContainEqual({
      name: 'Maria Rossi',
      email: 'maria@example.com',
    })
  })

  test('renaming somebody with no address moves their references', () => {
    const doc = parse(BASE)
    addPerson(doc, { name: 'maria' })
    setOwners(doc, keyResult, 'responsible', ['maria'])

    // With no address, the name *is* the identity, so renaming moves it.
    expect(updatePerson(doc, 'maria', { name: 'Maria Rossi' })).toBe(1)
    expect(validate(parse(stringify(doc))).errors).toEqual([])
  })

  test('giving somebody an address moves every reference with them', () => {
    const doc = parse(BASE)
    addPerson(doc, { name: 'maria' })
    setOwners(doc, keyResult, 'responsible', ['maria'])
    setOwners(doc, keyResultPath(0, 0, 1), 'consult', ['maria'])
    setInitiativeOwner(doc, initiative, 'maria')

    const moved = updatePerson(doc, 'maria', {
      name: 'maria',
      email: 'maria@example.com',
    })

    expect(moved).toBe(3)
    const text = stringify(doc)
    expect(text).not.toContain('- maria\n')
    expect(validate(parse(text)).errors).toEqual([])
  })

  test('reports nothing when the person is not in the roster', () => {
    expect(updatePerson(parse(BASE), 'nobody@example.com', { name: 'x' })).toBe(0)
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

  /**
   * The fields only an author can supply are left out rather than written
   * empty, so the report says what is missing instead of what is blank — and
   * the file does not fill up with `target_measure: ""`.
   */
  test('a new key result reports exactly what still needs filling in', () => {
    const doc = parse(BASE)
    addKeyResult(doc, objective)
    const errors = validate(doc).errors.join('\n')

    expect(errors).toContain("TEK.O1.KR3: missing required field 'target_measure'")
    expect(errors).toContain("TEK.O1.KR3: missing required field 'target_date'")
    expect(errors).toContain("TEK.O1.KR3: missing required field 'owners'")
    expect(stringify(doc)).not.toContain("''")
    // Nothing else is wrong with the document.
    expect(validate(doc).errors).toHaveLength(3)
  })

  /**
   * A new key result has no `owners` map, so assigning somebody has to create
   * one — otherwise the picker appears to work and writes nothing.
   */
  test('an owner can be assigned to a key result that has no owners yet', () => {
    const doc = parse(BASE)
    addKeyResult(doc, objective)
    const fresh = keyResultPath(0, 0, 2)

    setOwners(doc, fresh, 'accountable', ['roberto'])

    const keyResults =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results
    expect(keyResults?.[2]?.owners?.accountable).toEqual(['roberto'])
    // And it lands where SPEC.md puts it, after target_date.
    const text = stringify(doc)
    expect(text.indexOf('owners:', text.indexOf('id: KR3'))).toBeGreaterThan(
      text.indexOf('id: KR3'),
    )
  })

  test('a new initiative carries the defaults the form offered', () => {
    const doc = parse(BASE)
    addInitiative(doc, draftFor('pep', 'People'))

    const added = toData(doc).strategic_initiatives?.[1]
    expect(added?.review_cadence).toBe('Weekly')
    expect(added?.status).toBe('Not Started')
    expect(added?.timeframe).toBe('2026')
    // Nothing was invented: no objectives, and no blank optional fields.
    expect(added?.objectives).toEqual([])
    expect(added?.owner).toBeUndefined()
    expect(added?.description).toBeUndefined()
  })

  test('an initiative with nothing in it is a warning, not an error', () => {
    const doc = parse(BASE)
    addInitiative(doc, { ...draftFor('pep', 'People'), owner: 'roberto' })

    const report = validate(doc)
    expect(report.errors).toEqual([])
    expect(report.warnings.join('\n')).toContain('PEP: has no objectives yet')
  })

  test('an owner left unset is still a missing required field', () => {
    const doc = parse(BASE)
    addInitiative(doc, draftFor('pep', 'People'))
    expect(validate(doc).errors).toEqual(["PEP: missing required field 'owner'"])
  })

  /**
   * A brand new file is written `strategic_initiatives: []`, which parses as a
   * *flow* sequence — and a flow parent forces every descendant flow, so
   * appending to one turned the whole subtree into a single bracket expression.
   */
  test('adding to an empty list writes block YAML, not brackets', () => {
    const doc = parse('version: 1\nstrategic_initiatives: []\n')

    addInitiative(doc, draftFor('tek', 'Technology'))
    addObjective(doc, ['strategic_initiatives', 0])
    addKeyResult(doc, ['strategic_initiatives', 0, 'objectives', 0])

    const text = stringify(doc)
    // Every record on its own lines, at its own depth.
    expect(text).toContain('  - id: TEK')
    expect(text).toContain('      - id: O1')
    expect(text).toContain('          - id: KR1')
    // No flow mappings: an empty `accountable: []` is fine, `- {id: TEK}` is not.
    expect(text).not.toContain('{')
    // Everything wrong with it is a field still to fill in.
    expect(
      validate(doc).errors.every((error) => /missing required field/.test(error)),
    ).toBe(true)
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
    addInitiative(doc, draftFor('pep', 'People'))
    const initiatives = toData(doc).strategic_initiatives
    expect(initiatives?.[1]?.id).toBe('PEP')
    expect(initiatives?.[1]?.title).toBe('People')
    expect(initiatives?.[1]?.timeframe).toBe('2026')
  })
})

describe('removing', () => {
  test('a key result leaves the others in order', () => {
    const doc = parse(BASE)
    removeKeyResult(doc, objective, 0)

    const keyResults =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results
    expect(keyResults?.map((keyResult) => keyResult.id)).toEqual(['KR2'])
    expectStillSound(doc)
  })

  /**
   * Deleting frees the id, and the next record takes it. Nothing records what
   * once existed, so this cannot be prevented — it is the reason `Aborted`
   * exists, and the reason to prefer it for work that was real.
   */
  test('frees the id, which the next record then takes', () => {
    const doc = parse(BASE)
    removeKeyResult(doc, objective, 1) // KR2 goes

    addKeyResult(doc, objective)
    const keyResults =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results
    // The new one is KR2 again, and is not the KR2 anybody wrote down.
    expect(keyResults?.map((keyResult) => keyResult.id)).toEqual(['KR1', 'KR2'])
  })

  test('aborting instead keeps the id spoken for', () => {
    const doc = parse(BASE)
    // KR2 in the fixture is already Aborted, and still holds its number.
    addKeyResult(doc, objective)
    const keyResults =
      toData(doc).strategic_initiatives?.[0]?.objectives?.[0]?.key_results
    expect(keyResults?.map((keyResult) => keyResult.id)).toEqual(['KR1', 'KR2', 'KR3'])
  })

  test('an objective takes its key results with it', () => {
    const doc = parse(BASE)
    removeObjective(doc, initiative, 0)

    expect(toData(doc).strategic_initiatives?.[0]?.objectives).toEqual([])
    // Half-written, and said so — but not blocked.
    const report = validate(doc)
    expect(report.errors).toEqual([])
    expect(report.warnings.join('\n')).toContain('has no objectives yet')
  })

  test('an initiative takes everything with it', () => {
    const doc = parse(BASE)
    removeInitiative(doc, 0)

    expect(toData(doc).strategic_initiatives).toEqual([])
    // An empty file is a valid file, so nothing is wrong with the result.
    expect(validate(doc).errors).toEqual([])
  })

  test('leaves the roster alone — people outlive the work', () => {
    const doc = parse(BASE)
    removeInitiative(doc, 0)
    expect(toData(doc).people).toContainEqual({ name: 'roberto' })
  })

  test('shrugs at an index that is not there', () => {
    const doc = parse(BASE)
    const before = stringify(doc)
    removeKeyResult(doc, objective, 9)
    removeObjective(doc, initiative, 9)
    removeInitiative(doc, 9)
    expect(stringify(doc)).toBe(before)
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
    setOwners(doc, keyResult, 'inform', ['cto'])
    addProgressNote(doc, keyResult, '2026-08-31', 'Hit the target.')
    addKeyResult(doc, objective)
    setField(doc, keyResultPath(0, 0, 2), 'target_measure', 'Something new.', KR_KEYS)
    setField(doc, keyResultPath(0, 0, 2), 'target_date', 'Q4', KR_KEYS)
    setOwners(doc, keyResultPath(0, 0, 2), 'accountable', ['roberto'])

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
