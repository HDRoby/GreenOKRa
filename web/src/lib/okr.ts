/**
 * Load, normalise, validate and roll up GreenOKRa files.
 *
 * The format is specified in SPEC.md. Two ideas drive this module:
 *
 * - **Readers are lenient, writers are strict.** Validation normalises the
 *   document in place, so `in progress` and `IN_PROGRESS` both become
 *   `In Progress` before anything else looks at them. Every repair is recorded
 *   in the report as a fix; the caller decides whether to write the file back.
 * - **Percentages are never stored.** They are computed from key result status.
 *
 * Everything here runs unchanged in the browser and in Node, so the editor and
 * the command line share one implementation of the spec.
 */

import {
  Document,
  Scalar,
  YAMLMap,
  YAMLSeq,
  isMap,
  isNode,
  isScalar,
  isSeq,
  parseDocument,
} from 'yaml'

export const STATUSES = [
  'Not Started',
  'In Progress',
  'Completed',
  'Aborted',
] as const
export const PRIORITIES = ['Blocker', 'High', 'Medium', 'Low'] as const
export const COMPLEXITIES = ['Very High', 'High', 'Medium', 'Low'] as const
export const RACI_ROLES = [
  'accountable',
  'responsible',
  'consulted',
  'informed',
] as const

export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Complexity = (typeof COMPLEXITIES)[number]

const STATUS_PROGRESS: Record<string, number> = {
  'Not Started': 0,
  'In Progress': 50,
  Completed: 100,
}

const SI_ID = /^[A-Z]{2,5}$/
const OBJECTIVE_ID = /^O[0-9]+$/
const KR_ID = /^KR[0-9]+$/

const FILE_KEYS = ['version', 'strategic_initiatives'] as const

/**
 * The allowed fields at each level, in the order SPEC.md documents them. An
 * editor adding a field should insert it at this position rather than at the
 * end of the mapping.
 */
export const SI_KEYS = [
  'id',
  'title',
  'owner',
  'timeframe',
  'review_cadence',
  'status',
  'description',
  'objectives',
] as const
export const OBJECTIVE_KEYS = [
  'id',
  'title',
  'description',
  'theme',
  'owners',
  'status',
  'links',
  'key_results',
] as const
export const KR_KEYS = [
  'id',
  'target_measure',
  'target_date',
  'owners',
  'status',
  'priority',
  'complexity',
  'progress',
  'progress_notes',
] as const
const LINK_KEYS = ['title', 'url'] as const
const NOTE_KEYS = ['date', 'note'] as const

// --------------------------------------------------------------------------
// Shapes, as seen by a reader (doc.toJS()). Every field is optional because a
// document may be invalid; validate() is what proves it is not.
// --------------------------------------------------------------------------

export interface Link {
  title?: string
  url?: string
}

export interface ProgressNote {
  date?: string
  note?: string
}

export interface Owners {
  accountable?: string[]
  responsible?: string[]
  consulted?: string[]
  informed?: string[]
}

export interface KeyResult {
  id?: string
  target_measure?: string
  target_date?: string
  owners?: Owners
  status?: string
  priority?: string
  complexity?: string
  progress?: number
  progress_notes?: ProgressNote[]
}

export interface Objective {
  id?: string
  title?: string
  description?: string
  theme?: string
  owners?: string[]
  status?: string
  links?: Link[]
  key_results?: KeyResult[]
}

export interface Initiative {
  id?: string
  title?: string
  owner?: string
  timeframe?: string
  review_cadence?: string
  status?: string
  description?: string
  objectives?: Objective[]
}

export interface OkrFile {
  version?: number
  strategic_initiatives?: Initiative[]
}

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------

/** What validation found. Errors block; warnings and fixes do not. */
export class Report {
  readonly errors: string[] = []
  readonly warnings: string[] = []
  readonly fixes: string[] = []

  get ok(): boolean {
    return this.errors.length === 0
  }

  error(message: string): void {
    this.errors.push(message)
  }

  warn(message: string): void {
    this.warnings.push(message)
  }

  fix(message: string): void {
    this.fixes.push(message)
  }
}

// --------------------------------------------------------------------------
// Reading and writing
// --------------------------------------------------------------------------

/**
 * Writing options chosen so that saving an unchanged file is a no-op: no
 * padding inside flow collections, and prose folded at the default width.
 */
const WRITE_OPTIONS = { flowCollectionPadding: false } as const

/** Parse text into a document that remembers its comments and formatting. */
export function parse(text: string): Document {
  return parseDocument(text)
}

/** Render a document back to YAML, preserving comments. */
export function stringify(doc: Document): string {
  return doc.toString(WRITE_OPTIONS)
}

/** The plain data behind a document, for rendering and progress rollups. */
export function toData(doc: Document): OkrFile {
  return doc.toJS() as OkrFile
}

// --------------------------------------------------------------------------
// Normalising helpers
// --------------------------------------------------------------------------

/**
 * Match an enum value leniently: case-insensitive, `_` and `-` count as
 * spaces. `IN_PROGRESS`, `in progress` and `In-Progress` all return
 * `'In Progress'`. Returns null when nothing matches.
 */
export function canonical(
  value: unknown,
  allowed: readonly string[],
): string | null {
  const key = String(value).replace(/[\s_-]+/g, ' ').trim().toLowerCase()
  return allowed.find((option) => option.toLowerCase() === key) ?? null
}

const LOOKS_NUMERIC = /^-?\d+(\.\d+)?$/
const LOOKS_LIKE_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True when some YAML parser would read this string back as a number or date. */
function needsQuotes(value: string): boolean {
  return LOOKS_NUMERIC.test(value) || LOOKS_LIKE_DATE.test(value)
}

/**
 * True for an unstyled scalar. Block (`>`) and quoted scalars carry formatting
 * that rewriting the value would destroy, so they are left alone.
 */
function isPlainStyle(node: Scalar): boolean {
  return node.type === undefined || node.type === Scalar.PLAIN
}

function describe(node: unknown): string {
  if (isMap(node)) return 'a mapping'
  if (isSeq(node)) return 'a list'
  if (isScalar(node)) {
    if (node.value === null) return 'nothing'
    if (node.value instanceof Date) return 'a date'
    return typeof node.value
  }
  return 'nothing'
}

function keyNames(map: YAMLMap): string[] {
  return map.items.map((pair) =>
    isScalar(pair.key) ? String(pair.key.value) : String(pair.key),
  )
}

function absent(
  map: YAMLMap,
  key: string,
  path: string,
  report: Report,
  required: boolean,
): boolean {
  const node = map.get(key, true)
  const empty =
    node === undefined || node === null || (isScalar(node) && node.value === null)
  if (!empty) return false
  if (required) report.error(`${path}: missing required field '${key}'`)
  return true
}

function unknownKeys(
  map: YAMLMap,
  allowed: readonly string[],
  path: string,
  report: Report,
): void {
  const permitted = [...allowed].sort().join(', ')
  for (const key of keyNames(map)) {
    if (!allowed.includes(key)) {
      report.error(`${path}: unknown field '${key}' (allowed: ${permitted})`)
    }
  }
}

function scalarAt(map: YAMLMap, key: string): Scalar | null {
  const node = map.get(key, true)
  return isScalar(node) ? node : null
}

function textField(
  map: YAMLMap,
  key: string,
  path: string,
  report: Report,
  required = true,
): string | null {
  if (absent(map, key, path, report, required)) return null
  const node = scalarAt(map, key)
  if (!node || typeof node.value !== 'string') {
    report.error(
      `${path}.${key}: expected text, found ${describe(map.get(key, true))}`,
    )
    return null
  }
  const raw = node.value
  const value = raw.trim()
  if (!value) {
    report.error(`${path}.${key}: must not be empty`)
    return null
  }
  if (value !== raw && isPlainStyle(node)) {
    node.value = value
    report.fix(`${path}.${key}: trimmed surrounding whitespace`)
  }
  return value
}

/**
 * A string that may look like a date or a number: `Q3`, `2026`, `2026-09-30`.
 *
 * YAML 1.2 reads `2026` as a number, and YAML 1.1 parsers read `2026-09-30` as
 * a date. Both are coerced to text and quoted, so the file means the same thing
 * to every parser.
 */
function labelField(
  map: YAMLMap,
  key: string,
  path: string,
  report: Report,
  required = true,
): string | null {
  if (absent(map, key, path, report, required)) return null
  const node = scalarAt(map, key)
  if (!node) {
    report.error(
      `${path}.${key}: expected a string, found ${describe(map.get(key, true))}`,
    )
    return null
  }
  const raw = node.value
  if (typeof raw === 'boolean') {
    report.error(`${path}.${key}: expected a quoted string, found a boolean`)
    return null
  }

  let value: string
  if (typeof raw === 'string') value = raw.trim()
  else if (typeof raw === 'number') value = String(raw)
  else if (raw instanceof Date) value = raw.toISOString().slice(0, 10)
  else {
    report.error(`${path}.${key}: expected a string, found ${describe(node)}`)
    return null
  }
  if (!value) {
    report.error(`${path}.${key}: must not be empty`)
    return null
  }

  if (typeof raw !== 'string') {
    node.value = value
    node.type = Scalar.QUOTE_DOUBLE
    report.fix(`${path}.${key}: ${JSON.stringify(raw)} -> "${value}" (must be text)`)
  } else if (isPlainStyle(node)) {
    if (value !== raw) {
      node.value = value
      report.fix(`${path}.${key}: trimmed surrounding whitespace`)
    }
    if (needsQuotes(value)) {
      node.type = Scalar.QUOTE_DOUBLE
      report.fix(`${path}.${key}: quoted "${value}" so it stays text`)
    }
  }
  return value
}

function enumField(
  map: YAMLMap,
  key: string,
  allowed: readonly string[],
  path: string,
  report: Report,
  required = true,
): string | null {
  if (absent(map, key, path, report, required)) return null
  const node = scalarAt(map, key)
  if (!node || typeof node.value !== 'string') {
    report.error(
      `${path}.${key}: expected text, found ${describe(map.get(key, true))}`,
    )
    return null
  }
  const raw = node.value
  const value = canonical(raw, allowed)
  if (value === null) {
    report.error(
      `${path}.${key}: '${raw}' is not a valid value ` +
        `(expected one of: ${allowed.join(', ')})`,
    )
    return null
  }
  if (value !== raw) {
    node.value = value
    report.fix(`${path}.${key}: '${raw}' -> '${value}'`)
  }
  return value
}

function identifier(
  map: YAMLMap,
  path: string,
  report: Report,
  pattern: RegExp,
  hint: string,
): string | null {
  if (absent(map, 'id', path, report, true)) return null
  const node = scalarAt(map, 'id')
  if (!node || typeof node.value !== 'string') {
    report.error(`${path}.id: expected text, found ${describe(map.get('id', true))}`)
    return null
  }
  const raw = node.value
  const value = raw.trim().toUpperCase()
  if (value !== raw) {
    node.value = value
    report.fix(`${path}.id: '${raw}' -> '${value}'`)
  }
  if (!pattern.test(value)) {
    report.error(`${path}.id: '${value}' is not a valid id (${hint})`)
    return null
  }
  return value
}

function nameList(
  map: YAMLMap,
  key: string,
  path: string,
  report: Report,
  required = true,
): string[] {
  if (absent(map, key, path, report, required)) return []
  let node = map.get(key, true)

  if (isScalar(node) && typeof node.value === 'string') {
    const solo = node.value.trim()
    const wrapped = new YAMLSeq()
    wrapped.flow = true
    wrapped.add(new Scalar(solo))
    map.set(key, wrapped)
    report.fix(`${path}.${key}: wrapped '${solo}' in a list`)
    node = map.get(key, true)
  }

  if (!isSeq(node)) {
    report.error(`${path}.${key}: expected a list of names`)
    return []
  }

  const names: string[] = []
  node.items.forEach((item, index) => {
    const value = isScalar(item) ? item.value : undefined
    if (typeof value !== 'string' || !value.trim()) {
      report.error(`${path}.${key}[${index}]: expected a name`)
      return
    }
    names.push(value.trim())
  })
  return names
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

/**
 * Replace plain JavaScript values with real nodes, so the checks below only
 * ever see one representation.
 *
 * An editor that assigns `doc.setIn(path, 'Completed')` stores a bare string
 * rather than a scalar node. Existing nodes — and the comments attached to
 * them — are left untouched.
 */
function materialise(doc: Document, node: unknown): void {
  if (isMap(node)) {
    for (const pair of node.items) {
      if (pair.value != null && !isNode(pair.value)) {
        pair.value = doc.createNode(pair.value)
      }
      materialise(doc, pair.value)
    }
  } else if (isSeq(node)) {
    node.items.forEach((item, index) => {
      if (item != null && !isNode(item)) {
        node.items[index] = doc.createNode(item)
      }
      materialise(doc, node.items[index])
    })
  }
}

/** Check and normalise a parsed document in place. */
export function validate(doc: Document): Report {
  const report = new Report()
  materialise(doc, doc.contents)
  const root = doc.contents
  if (!isMap(root)) {
    report.error('file: expected a mapping at the top level')
    return report
  }

  unknownKeys(root, FILE_KEYS, 'file', report)
  const version = root.has('version') ? scalarAt(root, 'version')?.value : 1
  if (version !== 1) {
    report.error(
      `file.version: unsupported version ${JSON.stringify(version)} ` +
        '(this tool understands version 1)',
    )
  }

  const initiatives = root.get('strategic_initiatives', true)
  if (!isSeq(initiatives) || initiatives.items.length === 0) {
    report.error('file.strategic_initiatives: expected a non-empty list')
    return report
  }

  const seen = new Map<string, string>()
  initiatives.items.forEach((item, index) => {
    const path = `strategic_initiatives[${index}]`
    if (!isMap(item)) {
      report.error(`${path}: expected a mapping`)
      return
    }
    const found = validateInitiative(item, path, report)
    if (found === null) return
    const previous = seen.get(found)
    if (previous !== undefined) {
      report.error(
        `${path}.id: duplicate initiative id '${found}' (already used at ${previous})`,
      )
    } else {
      seen.set(found, path)
    }
  })
  return report
}

function validateInitiative(
  initiative: YAMLMap,
  path: string,
  report: Report,
): string | null {
  unknownKeys(initiative, SI_KEYS, path, report)
  const initiativeId = identifier(
    initiative,
    path,
    report,
    SI_ID,
    'two to five uppercase letters, e.g. TEK',
  )
  const prefix = initiativeId ?? path

  textField(initiative, 'title', prefix, report)
  textField(initiative, 'owner', prefix, report)
  labelField(initiative, 'timeframe', prefix, report)
  textField(initiative, 'review_cadence', prefix, report, false)
  textField(initiative, 'description', prefix, report, false)
  enumField(initiative, 'status', STATUSES, prefix, report)

  const objectives = initiative.get('objectives', true)
  if (!isSeq(objectives) || objectives.items.length === 0) {
    report.error(`${prefix}.objectives: expected a non-empty list`)
    return initiativeId
  }

  const seen = new Map<string, string>()
  objectives.items.forEach((item, index) => {
    const objectivePath = `${prefix}.objectives[${index}]`
    if (!isMap(item)) {
      report.error(`${objectivePath}: expected a mapping`)
      return
    }
    const found = validateObjective(item, prefix, objectivePath, report)
    if (found === null) return
    const previous = seen.get(found)
    if (previous !== undefined) {
      report.error(
        `${objectivePath}.id: duplicate objective id '${found}' in ${prefix} ` +
          `(already used at ${previous})`,
      )
    } else {
      seen.set(found, objectivePath)
    }
  })
  return initiativeId
}

function validateObjective(
  objective: YAMLMap,
  initiativeId: string,
  path: string,
  report: Report,
): string | null {
  unknownKeys(objective, OBJECTIVE_KEYS, path, report)
  const objectiveId = identifier(
    objective,
    path,
    report,
    OBJECTIVE_ID,
    "'O' followed by a number, e.g. O1",
  )
  const prefix = objectiveId ? `${initiativeId}.${objectiveId}` : path

  textField(objective, 'title', prefix, report)
  textField(objective, 'description', prefix, report, false)
  textField(objective, 'theme', prefix, report, false)
  enumField(objective, 'status', STATUSES, prefix, report)
  if (objective.has('owners')) {
    nameList(objective, 'owners', prefix, report, false)
  }
  validateLinks(objective, prefix, report)

  const keyResults = objective.get('key_results', true)
  if (!isSeq(keyResults) || keyResults.items.length === 0) {
    report.error(`${prefix}.key_results: expected a non-empty list`)
    return objectiveId
  }

  const seen = new Map<string, string>()
  keyResults.items.forEach((item, index) => {
    const keyResultPath = `${prefix}.key_results[${index}]`
    if (!isMap(item)) {
      report.error(`${keyResultPath}: expected a mapping`)
      return
    }
    const found = validateKeyResult(item, prefix, keyResultPath, report)
    if (found === null) return
    const previous = seen.get(found)
    if (previous !== undefined) {
      report.error(
        `${keyResultPath}.id: duplicate key result id '${found}' in ${prefix} ` +
          `(already used at ${previous})`,
      )
    } else {
      seen.set(found, keyResultPath)
    }
  })
  return objectiveId
}

function validateLinks(objective: YAMLMap, path: string, report: Report): void {
  if (!objective.has('links')) return
  const links = objective.get('links', true)
  if (!isSeq(links)) {
    report.error(`${path}.links: expected a list of title/url pairs`)
    return
  }
  links.items.forEach((item, index) => {
    const linkPath = `${path}.links[${index}]`
    if (!isMap(item)) {
      report.error(`${linkPath}: expected a mapping with 'title' and 'url'`)
      return
    }
    unknownKeys(item, LINK_KEYS, linkPath, report)
    textField(item, 'title', linkPath, report)
    textField(item, 'url', linkPath, report)
  })
}

function validateKeyResult(
  keyResult: YAMLMap,
  objectivePrefix: string,
  path: string,
  report: Report,
): string | null {
  unknownKeys(keyResult, KR_KEYS, path, report)
  const keyResultId = identifier(
    keyResult,
    path,
    report,
    KR_ID,
    "'KR' followed by a number, e.g. KR1",
  )
  const prefix = keyResultId ? `${objectivePrefix}.${keyResultId}` : path

  textField(keyResult, 'target_measure', prefix, report)
  labelField(keyResult, 'target_date', prefix, report)
  validateOwners(keyResult, prefix, report)
  const status = enumField(keyResult, 'status', STATUSES, prefix, report)
  enumField(keyResult, 'priority', PRIORITIES, prefix, report)
  enumField(keyResult, 'complexity', COMPLEXITIES, prefix, report)
  validateProgress(keyResult, status, prefix, report)
  validateNotes(keyResult, prefix, report)
  return keyResultId
}

function validateOwners(keyResult: YAMLMap, path: string, report: Report): void {
  if (absent(keyResult, 'owners', path, report, true)) return
  const owners = keyResult.get('owners', true)
  if (!isMap(owners)) {
    report.error(
      `${path}.owners: expected a RACI map with keys: ${RACI_ROLES.join(', ')}`,
    )
    return
  }
  unknownKeys(owners, RACI_ROLES, `${path}.owners`, report)

  const named = new Map<string, string[]>()
  for (const role of RACI_ROLES) {
    if (!owners.has(role)) continue
    if (absent(owners, role, `${path}.owners`, report, false)) continue
    named.set(role, nameList(owners, role, `${path}.owners`, report, false))
  }

  const total = [...named.values()].reduce((sum, list) => sum + list.length, 0)
  if (total === 0) {
    report.error(`${path}.owners: at least one owner is required`)
    return
  }
  const accountable = named.get('accountable') ?? []
  if (accountable.length !== 1) {
    report.warn(
      `${path}.owners.accountable: should name exactly one person, ` +
        `found ${accountable.length}`,
    )
  }
}

function validateProgress(
  keyResult: YAMLMap,
  status: string | null,
  path: string,
  report: Report,
): void {
  if (!keyResult.has('progress')) return
  if (absent(keyResult, 'progress', path, report, false)) return
  const value = scalarAt(keyResult, 'progress')?.value
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    report.error(`${path}.progress: expected a whole number from 0 to 100`)
    return
  }
  if (value < 0 || value > 100) {
    report.error(`${path}.progress: ${value} is outside the range 0 to 100`)
    return
  }
  if (status !== null && status !== 'In Progress') {
    report.warn(
      `${path}.progress: ignored because status is '${status}' ` +
        "(only 'In Progress' uses it)",
    )
  }
}

function validateNotes(keyResult: YAMLMap, path: string, report: Report): void {
  if (!keyResult.has('progress_notes')) return
  const notes = keyResult.get('progress_notes', true)
  if (!isSeq(notes)) {
    report.error(`${path}.progress_notes: expected a list of date/note entries`)
    return
  }

  const dates: string[] = []
  notes.items.forEach((item, index) => {
    const notePath = `${path}.progress_notes[${index}]`
    if (!isMap(item)) {
      report.error(`${notePath}: expected a mapping with 'date' and 'note'`)
      return
    }
    unknownKeys(item, NOTE_KEYS, notePath, report)
    const date = noteDate(item, notePath, report)
    if (date !== null) dates.push(date)
    textField(item, 'note', notePath, report)
  })

  const newestFirst = [...dates].sort().reverse()
  if (dates.join('|') !== newestFirst.join('|')) {
    report.warn(`${path}.progress_notes: entries should be most recent first`)
  }
}

/** Returns the date as `YYYY-MM-DD`, which sorts correctly as text. */
function noteDate(note: YAMLMap, path: string, report: Report): string | null {
  if (absent(note, 'date', path, report, true)) return null
  const raw = scalarAt(note, 'date')?.value
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!LOOKS_LIKE_DATE.test(value) || Number.isNaN(Date.parse(value))) {
      report.error(`${path}.date: '${raw}' is not a YYYY-MM-DD date`)
      return null
    }
    return value
  }
  report.error(`${path}.date: expected a YYYY-MM-DD date`)
  return null
}

// --------------------------------------------------------------------------
// Progress rollup
// --------------------------------------------------------------------------

/** Percentage for one key result, or null when it is aborted. */
export function keyResultProgress(keyResult: KeyResult): number | null {
  const status = canonical(keyResult.status, STATUSES)
  if (status === null || status === 'Aborted') return null
  if (
    status === 'In Progress' &&
    typeof keyResult.progress === 'number' &&
    Number.isInteger(keyResult.progress)
  ) {
    return keyResult.progress
  }
  return STATUS_PROGRESS[status]
}

function mean(values: (number | null)[]): number | null {
  const live = values.filter((value): value is number => value !== null)
  if (live.length === 0) return null
  return live.reduce((sum, value) => sum + value, 0) / live.length
}

/** Mean of the objective's non-aborted key results. */
export function objectiveProgress(objective: Objective): number | null {
  return mean((objective.key_results ?? []).map(keyResultProgress))
}

/**
 * Mean of every non-aborted key result under the initiative.
 *
 * Flattened across objectives on purpose: an objective with six key results is
 * more work than one with a single key result.
 */
export function initiativeProgress(initiative: Initiative): number | null {
  const values: (number | null)[] = []
  for (const objective of initiative.objectives ?? []) {
    if (canonical(objective.status, STATUSES) === 'Aborted') continue
    values.push(...(objective.key_results ?? []).map(keyResultProgress))
  }
  return mean(values)
}

/** Percentages are undefined, not zero, when everything in scope is aborted. */
export function formatProgress(progress: number | null): string {
  return progress === null ? '—' : `${progress.toFixed(1)}%`
}
