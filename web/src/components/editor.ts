import type { Path } from '@/lib/edit.ts'

/**
 * The operations the UI can perform on the document.
 *
 * Implemented once in `page.tsx`, where each call mutates the document,
 * revalidates and re-renders. Components never touch the document directly.
 *
 * Note what is missing: there is no delete. Identifiers must stay stable, so
 * dropped work is marked `Aborted` and keeps its place.
 */
export interface Editor {
  setInitiative(path: Path, key: string, value: string, required?: boolean): void
  setObjective(path: Path, key: string, value: string, required?: boolean): void
  setKeyResult(path: Path, key: string, value: string, required?: boolean): void
  setProgressOverride(path: Path, value: number | null): void

  setOwners(keyResult: Path, role: string, names: string[]): void
  setObjectiveOwners(objective: Path, names: string[]): void

  addNote(keyResult: Path, date: string, note: string): void
  addKeyResult(objective: Path): void
  addObjective(initiative: Path): void
  addInitiative(id: string, title: string, timeframe: string): void

  addLink(objective: Path): void
  setLink(objective: Path, index: number, key: string, value: string): void
  removeLink(objective: Path, index: number): void
}
