/**
 * The values a file reuses — people and themes — and a colour for themes.
 *
 * The pickers offer what is already in use rather than a free text box, so a
 * theme spelled two ways does not silently split one group of objectives into
 * two, and a person is chosen rather than retyped.
 *
 * People come from the file's roster, where each is defined once. Themes are
 * still derived by scanning, since they are only ever a word on an objective
 * and there is nothing to define.
 */

import { type OkrFile, type Person, personLabel } from './okr.ts'

// Identity belongs to the format — it is what a reference means — so it is
// defined there and re-exported here for the UI's convenience.
export { findPerson, personKey, personLabel } from './okr.ts'

/** The values offered by the pickers, for one loaded file. */
export interface Pools {
  people: Person[]
  themes: string[]
}

/**
 * Everyone the file defines.
 *
 * Simply the roster: people are defined once at the top and referenced from
 * the OKRs, so there is nothing to scan for and nothing to deduplicate.
 */
export function collectPeople(file: OkrFile | null): Person[] {
  return [...(file?.people ?? [])].sort((a, b) =>
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
  return [...themes].sort((a, b) => a.localeCompare(b))
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
 * Used for themes, where a handful of values group objectives across
 * initiatives and the colour makes that grouping visible. People are
 * deliberately neutral: a hue hashed from a name teaches the reader nothing.
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
