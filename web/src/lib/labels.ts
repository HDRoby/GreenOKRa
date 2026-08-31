/**
 * The short labels a file reuses — people and themes — and a colour for each.
 *
 * These fields offer the values already in use rather than a free text box, so
 * `roberto.basile` does not quietly become `roberto basile` in one key result
 * and `r.basile` in the next, and so a theme spelled two ways does not silently
 * split one group of objectives into two.
 *
 * Both lists are derived from the document on every read, never stored beside
 * it. A value exists exactly as long as something references it: enter one and
 * every field offers it immediately; remove the last use and it stops being
 * offered, with nothing to clean up.
 */

import { type OkrFile, type Person, RACI_ROLES } from './okr.ts'

/** The values offered by the pickers, for one loaded file. */
export interface Pools {
  people: Person[]
  themes: string[]
}

/**
 * How a person is identified. The address where there is one, since that is
 * what survives a name being spelled differently; the name otherwise.
 */
export function personKey(person: Person | undefined): string {
  return (person?.email?.trim() || person?.name?.trim() || '').toLowerCase()
}

/** How a person is shown. */
export function personLabel(person: Person | undefined): string {
  return person?.name?.trim() || person?.email?.trim() || '(unnamed)'
}

function sorted(values: Set<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

/**
 * Everyone named in the file: initiative owners, objective owners, RACI.
 *
 * Deduplicated by identity, so the same address written with two spellings of
 * a name collapses to one entry — the first spelling met, which is arbitrary
 * but stable within a read.
 */
export function collectPeople(file: OkrFile | null): Person[] {
  const found = new Map<string, Person>()
  const add = (person: Person | undefined) => {
    const key = personKey(person)
    if (key && person && !found.has(key)) found.set(key, person)
  }

  for (const initiative of file?.strategic_initiatives ?? []) {
    add(initiative.owner)
    for (const objective of initiative.objectives ?? []) {
      for (const person of objective.owners ?? []) add(person)
      for (const keyResult of objective.key_results ?? []) {
        for (const role of RACI_ROLES) {
          for (const person of keyResult.owners?.[role] ?? []) add(person)
        }
      }
    }
  }
  return [...found.values()].sort((a, b) =>
    personLabel(a).localeCompare(personLabel(b)),
  )
}

/** Every theme used in the file. Themes group objectives across initiatives. */
export function collectThemes(file: OkrFile | null): string[] {
  const themes = new Set<string>()
  for (const initiative of file?.strategic_initiatives ?? []) {
    for (const objective of initiative.objectives ?? []) {
      const theme = objective.theme?.trim()
      if (theme) themes.add(theme)
    }
  }
  return sorted(themes)
}

export function collectPools(file: OkrFile | null): Pools {
  return { people: collectPeople(file), themes: collectThemes(file) }
}

/**
 * A hue derived from the label, so the same value is the same colour everywhere
 * in the file and across reloads.
 */
function hueOf(label: string): number {
  let hash = 0
  for (const character of label) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 360
  }
  return hash
}

export interface Tint {
  backgroundColor: string
  borderColor: string
  color: string
}

/**
 * A light tint for a chip: enough colour to tell values apart, no more.
 *
 * `solid` fills the chip with the colour its border normally uses, which is how
 * the person being filtered on is picked out of a page of other names. Text
 * flips dark, since the fill is light.
 */
export function labelTint(label: string, solid = false): Tint {
  const hue = hueOf(label)
  if (solid) {
    return {
      backgroundColor: `oklch(0.68 0.11 ${hue})`,
      borderColor: `oklch(0.68 0.11 ${hue})`,
      color: `oklch(0.2 0.03 ${hue})`,
    }
  }
  return {
    backgroundColor: `oklch(0.6 0.08 ${hue} / 0.16)`,
    borderColor: `oklch(0.65 0.1 ${hue} / 0.45)`,
    color: `oklch(0.88 0.05 ${hue})`,
  }
}
