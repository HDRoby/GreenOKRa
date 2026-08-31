/**
 * Narrowing the view to one person.
 *
 * Someone is "involved" at a level if they are named there or anywhere below
 * it, so filtering to a person shows the whole shape of their work rather than
 * scattered key results with no context.
 *
 * Matching at one level reveals everything beneath it: if you own an
 * objective, every key result under it is your concern, whether or not your
 * name is repeated on each one.
 */

import {
  type Initiative,
  type KeyResult,
  type Objective,
  type OkrFile,
  type Person,
  personKey,
  personLabel,
} from './okr.ts'

/** No filter. The default. */
export const EVERYONE = null

/**
 * A person's identity — their address, or their name where there is none — or
 * `EVERYONE`. Compared rather than a display name, so two spellings of one
 * person still filter as one person.
 */
export type PersonFilter = string | null

/**
 * The roles that make the work yours: RACI's A and R, plus the plain `owner`
 * and `owners` fields.
 *
 * Consulted and informed are people to keep in the loop, not people whose work
 * it is, so filtering to a person does not drag in everything they have ever
 * been copied on.
 */
const OWNING_ROLES = ['accountable', 'responsible'] as const

export function keyResultInvolves(keyResult: KeyResult, person: string): boolean {
  return OWNING_ROLES.some((role) => (keyResult.owners?.[role] ?? []).includes(person))
}

export function objectiveInvolves(objective: Objective, person: string): boolean {
  if ((objective.owners ?? []).includes(person)) return true
  return (objective.key_results ?? []).some((keyResult) =>
    keyResultInvolves(keyResult, person),
  )
}

export function initiativeInvolves(initiative: Initiative, person: string): boolean {
  if (initiative.owner === person) return true
  return (initiative.objectives ?? []).some((objective) =>
    objectiveInvolves(objective, person),
  )
}

/**
 * The people worth offering in the filter: those who own work somewhere.
 *
 * Deliberately narrower than the names offered by the owner fields. Filtering
 * matches only the owning roles, so someone who appears solely as consulted or
 * informed could never match anything — offering them would be a dead choice.
 */
export function filterablePeople(file: OkrFile | null): Person[] {
  const owning = new Set<string>()
  const add = (identity: string | undefined) => {
    if (identity) owning.add(identity)
  }

  for (const initiative of file?.strategic_initiatives ?? []) {
    add(initiative.owner)
    for (const objective of initiative.objectives ?? []) {
      for (const identity of objective.owners ?? []) add(identity)
      for (const keyResult of objective.key_results ?? []) {
        for (const role of OWNING_ROLES) {
          for (const identity of keyResult.owners?.[role] ?? []) add(identity)
        }
      }
    }
  }

  // The roster may hold somebody nobody has been given yet, or somebody left
  // only in a consulted role. Neither could match, so neither is offered.
  return (file?.people ?? [])
    .filter((person) => owning.has(personKey(person)))
    .sort((a, b) => personLabel(a).localeCompare(personLabel(b)))
}

export interface Indexed<T> {
  item: T
  index: number
}

/**
 * Pair each item with its position in the document, then filter.
 *
 * Editing addresses nodes by index — `strategic_initiatives[2].objectives[0]` —
 * so a filtered list has to carry the original index with it. Filtering first
 * and indexing after would renumber everything and send every edit to the
 * wrong record.
 */
export function withIndices<T>(
  items: T[],
  keep?: (item: T) => boolean,
): Indexed<T>[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => keep === undefined || keep(item))
}

/** The initiatives to show, carrying their true indices. */
export function visibleInitiatives(
  initiatives: Initiative[],
  person: PersonFilter,
): Indexed<Initiative>[] {
  return withIndices(
    initiatives,
    person === EVERYONE ? undefined : (item) => initiativeInvolves(item, person),
  )
}

/**
 * The objectives to show within an initiative.
 *
 * `inherited` is true when the initiative itself is the person's, in which case
 * everything under it is shown.
 */
export function visibleObjectives(
  objectives: Objective[],
  person: PersonFilter,
  inherited: boolean,
): Indexed<Objective>[] {
  return withIndices(
    objectives,
    person === EVERYONE || inherited
      ? undefined
      : (item) => objectiveInvolves(item, person),
  )
}

/** The key results to show within an objective. Same inheritance rule. */
export function visibleKeyResults(
  keyResults: KeyResult[],
  person: PersonFilter,
  inherited: boolean,
): Indexed<KeyResult>[] {
  return withIndices(
    keyResults,
    person === EVERYONE || inherited
      ? undefined
      : (item) => keyResultInvolves(item, person),
  )
}

/** True when this person owns the initiative outright. */
export function ownsInitiative(
  initiative: Initiative,
  person: PersonFilter,
): boolean {
  return person !== EVERYONE && initiative.owner === person
}

/** True when this person is named on the objective itself. */
export function ownsObjective(objective: Objective, person: PersonFilter): boolean {
  return person !== EVERYONE && (objective.owners ?? []).includes(person)
}
