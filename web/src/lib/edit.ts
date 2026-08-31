/**
 * Editing operations on a parsed document.
 *
 * Every function here mutates the document in place and preserves comments.
 * Two rules from SPEC.md are enforced structurally rather than by asking the
 * user to remember them:
 *
 * - New fields are inserted in the order SPEC.md documents, not appended.
 * - Identifiers are never reused. Nothing can be deleted; dropped work gets
 *   `status: Aborted` and keeps its id forever.
 */

import { Document, Pair, Scalar, YAMLMap, YAMLSeq, isMap, isScalar, isSeq } from 'yaml'

import {
  KR_KEYS,
  OBJECTIVE_KEYS,
  type Person,
  RACI_ROLES,
  SI_KEYS,
  STATUSES,
  UNDER_WAY,
  canonical,
  personKey,
} from './okr.ts'

export type Path = (string | number)[]

export const initiativePath = (initiative: number): Path => [
  'strategic_initiatives',
  initiative,
]

export const objectivePath = (initiative: number, objective: number): Path => [
  ...initiativePath(initiative),
  'objectives',
  objective,
]

export const keyResultPath = (
  initiative: number,
  objective: number,
  keyResult: number,
): Path => [...objectivePath(initiative, objective), 'key_results', keyResult]

function keyOf(pair: Pair<unknown, unknown>): string {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key)
}

/**
 * Set a field, inserting it at its documented position when it is new.
 *
 * Existing scalars are mutated rather than replaced, so a folded block (`>`)
 * stays folded and any comment attached to the value survives.
 */
export function setField(
  doc: Document,
  parent: Path,
  key: string,
  value: string,
  order: readonly string[],
): void {
  const map = doc.getIn(parent, true)
  if (!isMap(map)) return

  const existing = map.items.find((pair) => keyOf(pair) === key)
  if (existing) {
    if (isScalar(existing.value)) {
      existing.value.value = value
    } else {
      existing.value = new Scalar(value)
    }
    return
  }

  const target = order.indexOf(key)
  let insertAt = map.items.length
  for (const [index, pair] of map.items.entries()) {
    const position = order.indexOf(keyOf(pair))
    if (position > target) {
      insertAt = index
      break
    }
  }
  map.items.splice(insertAt, 0, new Pair(new Scalar(key), new Scalar(value)))
}

/** Set an optional field, removing the key entirely when cleared. */
export function setOptionalField(
  doc: Document,
  parent: Path,
  key: string,
  value: string,
  order: readonly string[],
): void {
  if (value.trim() === '') {
    const map = doc.getIn(parent, true)
    if (isMap(map)) {
      map.items = map.items.filter((pair) => keyOf(pair) !== key)
    }
    return
  }
  setField(doc, parent, key, value, order)
}

/** Replace one RACI role's people. Clearing it removes the role. */
export function setOwners(
  doc: Document,
  keyResult: Path,
  role: string,
  identities: string[],
): void {
  const keyResultMap = doc.getIn(keyResult, true)
  if (!isMap(keyResultMap)) return

  // A key result need not already have an `owners` map — a new one does not,
  // and nor does a hand-written file. Without creating it, assigning somebody
  // would appear to work and write nothing.
  const found = keyResultMap.get('owners', true)
  let owners: YAMLMap
  if (isMap(found)) {
    owners = found
  } else {
    if (identities.length === 0) return
    owners = new YAMLMap()
    insertOrdered(keyResultMap, 'owners', owners, KR_KEYS)
  }

  if (identities.length === 0) {
    owners.items = owners.items.filter((pair) => keyOf(pair) !== role)
    return
  }

  const list = new YAMLSeq()
  for (const identity of identities) list.add(new Scalar(identity))

  const existing = owners.items.find((pair) => keyOf(pair) === role)
  if (existing) {
    existing.value = list
  } else {
    owners.items.push(new Pair(new Scalar(role), list))
  }
}

/** Replace an objective's owners. */
export function setObjectiveOwners(
  doc: Document,
  objective: Path,
  identities: string[],
): void {
  const map = doc.getIn(objective, true)
  if (!isMap(map)) return

  if (identities.length === 0) {
    map.items = map.items.filter((pair) => keyOf(pair) !== 'owners')
    return
  }

  const list = new YAMLSeq()
  for (const identity of identities) list.add(new Scalar(identity))

  const existing = map.items.find((pair) => keyOf(pair) === 'owners')
  if (existing) {
    existing.value = list
  } else {
    insertOrdered(map, 'owners', list, OBJECTIVE_KEYS)
  }
}

/** Set the single person who owns an initiative. */
export function setInitiativeOwner(
  doc: Document,
  initiative: Path,
  identity: string | null,
): void {
  const map = doc.getIn(initiative, true)
  if (!isMap(map)) return

  if (identity === null) {
    map.items = map.items.filter((pair) => keyOf(pair) !== 'owner')
    return
  }
  setField(doc, initiative, 'owner', identity, SI_KEYS)
}

/** Add somebody to the roster, if they are not already in it. */
export function addPerson(doc: Document, person: Person): string {
  const identity = personKey(person)
  if (!identity) return ''

  const root = doc.contents
  if (!isMap(root)) return identity

  const existing = root.get('people', true)
  let roster: YAMLSeq
  if (isSeq(existing)) {
    roster = existing
  } else {
    roster = new YAMLSeq()
    const at = root.items.findIndex((pair) => keyOf(pair) === 'strategic_initiatives')
    const pair = new Pair(new Scalar('people'), roster)
    if (at === -1) root.items.push(pair)
    else root.items.splice(at, 0, pair)
  }

  const already = roster.items.some(
    (item) => isMap(item) && personKey(item.toJSON() as Person) === identity,
  )
  if (!already) roster.add(personNode(person))
  return identity
}

/** A roster entry as a one-line flow mapping, which is how they are written. */
function personNode(person: Person): YAMLMap {
  const map = new YAMLMap()
  map.flow = true
  map.add(new Pair(new Scalar('name'), new Scalar(person.name?.trim() ?? '')))
  const email = person.email?.trim()
  if (email) map.add(new Pair(new Scalar('email'), new Scalar(email)))
  return map
}

/**
 * Correct somebody in the roster.
 *
 * Their entry is the only definition, so the name and address change in one
 * place. The identity can change too — adding an address to a name-only person
 * moves them from being known by name to being known by address — and every
 * reference has to follow, or the OKRs would point at somebody who no longer
 * exists. Returns how many references were rewritten.
 */
export function updatePerson(
  doc: Document,
  identity: string,
  person: Person,
): number {
  const root = doc.contents
  if (!isMap(root)) return 0

  const roster = root.get('people', true)
  if (isSeq(roster)) {
    const at = roster.items.findIndex(
      (item) => isMap(item) && personKey(item.toJSON() as Person) === identity,
    )
    if (at === -1) return 0
    roster.items[at] = personNode(person)
  }

  const renamed = personKey(person)
  if (renamed === identity) return 0

  let changed = 0
  const rewrite = (holder: unknown, key: string) => {
    if (!isMap(holder)) return
    const node = holder.get(key, true)
    if (isSeq(node)) {
      node.items.forEach((item, index) => {
        if (isScalar(item) && item.value === identity) {
          node.items[index] = new Scalar(renamed)
          changed += 1
        }
      })
      return
    }
    if (isScalar(node) && node.value === identity) {
      node.value = renamed
      changed += 1
    }
  }

  const initiatives = root.get('strategic_initiatives', true)
  if (!isSeq(initiatives)) return changed
  for (const initiative of initiatives.items) {
    if (!isMap(initiative)) continue
    rewrite(initiative, 'owner')
    const objectives = initiative.get('objectives', true)
    if (!isSeq(objectives)) continue
    for (const objective of objectives.items) {
      if (!isMap(objective)) continue
      rewrite(objective, 'owners')
      const keyResults = objective.get('key_results', true)
      if (!isSeq(keyResults)) continue
      for (const keyResult of keyResults.items) {
        if (!isMap(keyResult)) continue
        const owners = keyResult.get('owners', true)
        for (const role of RACI_ROLES) rewrite(owners, role)
      }
    }
  }
  return changed
}

export function addLink(doc: Document, objective: Path): void {
  const map = doc.getIn(objective, true)
  if (!isMap(map)) return
  let links = doc.getIn([...objective, 'links'], true)
  if (!isSeq(links)) {
    links = new YAMLSeq()
    insertOrdered(map, 'links', links as YAMLSeq, OBJECTIVE_KEYS)
  }
  ;(links as YAMLSeq).items.push(doc.createNode({ title: '', url: '' }))
}

/** Links carry no identifier, so unlike OKRs they can simply be removed. */
export function removeLink(doc: Document, objective: Path, index: number): void {
  const links = doc.getIn([...objective, 'links'], true)
  if (!isSeq(links)) return
  links.items.splice(index, 1)
  if (links.items.length === 0) {
    const map = doc.getIn(objective, true)
    if (isMap(map)) {
      map.items = map.items.filter((pair) => keyOf(pair) !== 'links')
    }
  }
}

/** Add a progress note at the top of the list, where the newest one belongs. */
export function addProgressNote(
  doc: Document,
  keyResult: Path,
  date: string,
  note: string,
): void {
  const notesPath = [...keyResult, 'progress_notes']
  let notes = doc.getIn(notesPath, true)

  if (!isSeq(notes)) {
    notes = new YAMLSeq()
    const map = doc.getIn(keyResult, true)
    if (!isMap(map)) return
    insertOrdered(map, 'progress_notes', notes as YAMLSeq, KR_KEYS)
  }

  const entry = doc.createNode({ date, note })
  ;(notes as YAMLSeq).items.unshift(entry)
  sortNewestFirst(notes as YAMLSeq)
}

/** The fields of a progress note, in the order SPEC.md documents them. */
const NOTE_KEYS = ['date', 'note'] as const

/**
 * Edit one field of an existing note.
 *
 * Clearing the note text removes the entry. A dated blank is not a review note,
 * and keeping it would only raise a validation error whose fix is to delete the
 * thing anyway — so emptying the field is how a note is deleted.
 */
export function setNoteField(
  doc: Document,
  keyResult: Path,
  index: number,
  key: 'date' | 'note',
  value: string,
): void {
  const notes = doc.getIn([...keyResult, 'progress_notes'], true)
  if (!isSeq(notes) || !isMap(notes.items[index])) return

  if (key === 'note' && value.trim() === '') {
    removeNote(doc, keyResult, index)
    return
  }
  setField(doc, [...keyResult, 'progress_notes', index], key, value, NOTE_KEYS)
}

/** Drop a note, and the whole key with it when that was the last one. */
export function removeNote(doc: Document, keyResult: Path, index: number): void {
  const notes = doc.getIn([...keyResult, 'progress_notes'], true)
  if (!isSeq(notes)) return

  notes.items.splice(index, 1)
  if (notes.items.length > 0) return

  // An empty list would be legal but pointless; the field is optional.
  const map = doc.getIn(keyResult, true)
  if (isMap(map)) {
    map.items = map.items.filter((pair) => keyOf(pair) !== 'progress_notes')
  }
}

/**
 * Re-sort the log, for after a note has been re-dated.
 *
 * Kept separate from the edit itself so the list does not rearrange under the
 * cursor while a date is still being chosen.
 */
export function sortNotes(doc: Document, keyResult: Path): void {
  const notes = doc.getIn([...keyResult, 'progress_notes'], true)
  if (isSeq(notes)) sortNewestFirst(notes)
}

/** A note's date as `YYYY-MM-DD`, which sorts correctly as text. */
function noteDate(item: unknown): string {
  if (!isMap(item)) return ''
  const value = item.get('date')
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Reorder the log newest first, the order SPEC.md asks for.
 *
 * A note can be entered against any date, not only today, so the list is
 * sorted after every insertion rather than assuming the newest arrival is the
 * most recent. The sort is stable, so a note sharing a date with an existing
 * one stays on top of it — it was written later.
 */
function sortNewestFirst(notes: YAMLSeq): void {
  notes.items.sort((left, right) => noteDate(right).localeCompare(noteDate(left)))
}

function insertOrdered(
  map: YAMLMap,
  key: string,
  value: unknown,
  order: readonly string[],
): void {
  const target = order.indexOf(key)
  let insertAt = map.items.length
  for (const [index, pair] of map.items.entries()) {
    if (order.indexOf(keyOf(pair)) > target) {
      insertAt = index
      break
    }
  }
  map.items.splice(insertAt, 0, new Pair(new Scalar(key), value))
}

/**
 * The next free identifier in a list. Numbering continues past whatever is
 * there, so an aborted `KR2` is never reissued.
 */
function nextIdentifier(list: YAMLSeq, prefix: string): string {
  let highest = 0
  for (const item of list.items) {
    if (!isMap(item)) continue
    const id = item.get('id')
    const found = typeof id === 'string' ? id.match(/(\d+)$/) : null
    if (found) highest = Math.max(highest, Number(found[1]))
  }
  return `${prefix}${highest + 1}`
}

/**
 * A new record leaves out the fields only the author can supply, rather than
 * writing them empty.
 *
 * `target_measure: ""` reads as set-to-nothing and clutters the file; leaving
 * it out gets the clearer error — "missing required field" — and the editor
 * shows an empty control either way. Fields with a defensible default get one.
 */
function blankKeyResult(doc: Document, id: string) {
  return doc.createNode({
    id,
    status: 'Not Started',
    priority: 'Medium',
    complexity: 'Medium',
  })
}

/**
 * A record belongs on its own lines.
 *
 * An empty list written `[]` parses as a flow sequence, and a flow parent forces
 * every descendant flow — so appending to one turns the whole subtree into a
 * single unreadable bracket expression. Adding a mapping is always a block
 * operation.
 */
function asBlock(list: YAMLSeq): YAMLSeq {
  list.flow = false
  return list
}

export function addKeyResult(doc: Document, objective: Path): void {
  const list = doc.getIn([...objective, 'key_results'], true)
  if (!isSeq(list)) return
  asBlock(list).items.push(blankKeyResult(doc, nextIdentifier(list, 'KR')))
}

export function addObjective(doc: Document, initiative: Path): void {
  const list = doc.getIn([...initiative, 'objectives'], true)
  if (!isSeq(list)) return
  asBlock(list)
  const id = nextIdentifier(list, 'O')
  const objective = doc.createNode({
    id,
    status: 'Not Started',
    key_results: [],
  })
  const keyResults = objective.get('key_results', true)
  if (isSeq(keyResults)) keyResults.items.push(blankKeyResult(doc, 'KR1'))
  list.items.push(objective)
}

/**
 * Add an initiative from what the form collected.
 *
 * It arrives with no objectives. A file is built downwards — you name the
 * initiative, then say what it is trying to do — and inventing an O1 and a KR1
 * for somebody to edit away helps nobody. Validation notes it has none yet.
 */
export function addInitiative(doc: Document, draft: InitiativeDraft): void {
  const list = doc.getIn(['strategic_initiatives'], true)
  if (!isSeq(list)) return
  asBlock(list)

  // In SPEC.md's field order, and only what was given: an empty optional field
  // is left out rather than written blank.
  const initiative: Record<string, unknown> = {
    id: draft.id.trim().toUpperCase(),
    title: draft.title.trim(),
  }
  if (draft.owner.trim()) initiative.owner = draft.owner.trim()
  initiative.timeframe = draft.timeframe.trim() || thisYear()
  if (draft.cadence.trim()) initiative.review_cadence = draft.cadence.trim()
  initiative.status = draft.status.trim() || NEW_INITIATIVE.status
  if (draft.description.trim()) initiative.description = draft.description.trim()
  initiative.objectives = []

  // The empty list stays flow, so it reads `objectives: []` rather than a
  // bracket stranded on the next line. `addObjective` makes it block when it
  // has something to put there.
  list.add(doc.createNode(initiative))
}

// ------------------------------------------------------------------------- //
// Status
// ------------------------------------------------------------------------- //

/**
 * The two statuses a person decides. Everything else follows from the level
 * below: an objective from its key results, an initiative from its objectives.
 */
export const STATUS_DECISIONS = ['Completed', 'Aborted'] as const

/** What a new initiative carries until somebody says otherwise. */
export const NEW_INITIATIVE = {
  status: 'Not Started',
  cadence: 'Weekly',
} as const

/** The current year, which a new initiative's timeframe defaults to. */
export function thisYear(): string {
  return String(new Date().getFullYear())
}

/** Everything a new initiative needs, as the form collects it. */
export interface InitiativeDraft {
  id: string
  title: string
  description: string
  status: string
  /** A reference into the roster, or empty for not set. */
  owner: string
  timeframe: string
  cadence: string
}

/**
 * Advance a `Not Started` parent to `In Progress` once any child has begun.
 * Returns whether it moved.
 *
 * "Begun" is any rung above `Not Started`, so a child sitting at `Started` or
 * already `Completed` counts. Only `Aborted` does not, since it means the work
 * no longer applies.
 *
 * `Completed` and `Aborted` are human judgements and are never overwritten —
 * an initiative can be closed while objectives still move under it. The
 * transition is not reversed either: work having stopped is not the same as it
 * never having started.
 */
function advance(
  doc: Document,
  parent: YAMLMap,
  path: Path,
  children: YAMLSeq,
  order: readonly string[],
): boolean {
  if (canonical(parent.get('status'), STATUSES) !== 'Not Started') return false
  const active = children.items.some((child) => {
    if (!isMap(child)) return false
    const status = canonical(child.get('status'), STATUSES)
    return status !== null && UNDER_WAY.includes(status as never)
  })
  if (!active) return false
  setField(doc, path, 'status', 'In Progress', order)
  return true
}

/**
 * Editor policy rather than a format rule: objectives and initiatives left at
 * `Not Started` advance once work below them has begun.
 *
 * Returns the references it advanced, so the change can be reported rather than
 * made silently.
 */
export function applyStatusRules(doc: Document): string[] {
  const initiatives = doc.getIn(['strategic_initiatives'], true)
  if (!isSeq(initiatives)) return []

  const advanced: string[] = []
  initiatives.items.forEach((initiative, initiativeIndex) => {
    if (!isMap(initiative)) return
    const path = initiativePath(initiativeIndex)
    const objectives = initiative.get('objectives', true)
    if (!isSeq(objectives)) return
    const initiativeId = String(initiative.get('id') ?? initiativeIndex)

    // Objectives first: a key result starting work then carries all the way up
    // to its initiative within this one pass.
    objectives.items.forEach((objective, objectiveIndex) => {
      if (!isMap(objective)) return
      const keyResults = objective.get('key_results', true)
      if (!isSeq(keyResults)) return
      const moved = advance(
        doc,
        objective,
        objectivePath(initiativeIndex, objectiveIndex),
        keyResults,
        OBJECTIVE_KEYS,
      )
      if (moved) {
        advanced.push(`${initiativeId}.${objective.get('id') ?? objectiveIndex}`)
      }
    })

    if (advance(doc, initiative, path, objectives, SI_KEYS)) {
      advanced.push(initiativeId)
    }
  })
  return advanced
}

/**
 * What a status dropdown should offer, for an objective or an initiative.
 *
 * Only the human decisions are selectable. The current value is always
 * included so the control can display it, and once a decision has been taken
 * `In Progress` reappears so it can be undone.
 */
export function statusOptions(current: string | undefined): string[] {
  const status = canonical(current, STATUSES)
  if (status === 'Completed' || status === 'Aborted') {
    return [
      status,
      'In Progress',
      ...STATUS_DECISIONS.filter((decision) => decision !== status),
    ]
  }
  return status ? [status, ...STATUS_DECISIONS] : [...STATUS_DECISIONS]
}

// ------------------------------------------------------------------------- //
// Removing
// ------------------------------------------------------------------------- //

/**
 * Remove a record.
 *
 * Deleting frees its id. Numbering counts the records that are there, and
 * nothing remembers what once was, so removing `KR2` means the next key result
 * is `KR2` again — pointing anything that referred to the old one at a
 * different thing entirely.
 *
 * That is the cost of deleting rather than aborting, and it is why `Aborted`
 * exists: it drops the work from every rollup while keeping the id spoken for.
 * Delete what was never really there; abort what was.
 */
function removeAt(doc: Document, list: Path, index: number): void {
  const seq = doc.getIn(list, true)
  if (!isSeq(seq)) return
  seq.items.splice(index, 1)
}

export function removeInitiative(doc: Document, index: number): void {
  removeAt(doc, ['strategic_initiatives'], index)
}

export function removeObjective(doc: Document, initiative: Path, index: number): void {
  removeAt(doc, [...initiative, 'objectives'], index)
}

export function removeKeyResult(doc: Document, objective: Path, index: number): void {
  removeAt(doc, [...objective, 'key_results'], index)
}

export const FIELD_ORDER = {
  initiative: SI_KEYS,
  objective: OBJECTIVE_KEYS,
  keyResult: KR_KEYS,
} as const
