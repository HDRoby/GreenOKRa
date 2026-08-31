import type { InitiativeDraft, Path } from '@/lib/edit.ts'
import type { Person } from '@/lib/okr.ts'

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

  setOwners(keyResult: Path, role: string, identities: string[]): void
  setObjectiveOwners(objective: Path, identities: string[]): void
  setInitiativeOwner(initiative: Path, identity: string | null): void
  /** Correct somebody in the roster; every reference follows. */
  editPerson(identity: string, person: Person): void
  /** Put somebody new in the roster, returning how to refer to them. */
  addPerson(person: Person): string

  addNote(keyResult: Path, date: string, note: string): void
  setNote(keyResult: Path, index: number, key: 'date' | 'note', value: string): void
  /** Re-order the log after a note has been re-dated. */
  sortNotes(keyResult: Path): void
  addKeyResult(objective: Path): void
  addObjective(initiative: Path): void
  addInitiative(draft: InitiativeDraft): void

  removeInitiative(index: number): void
  removeObjective(initiative: Path, index: number): void
  removeKeyResult(objective: Path, index: number): void

  addLink(objective: Path): void
  setLink(objective: Path, index: number, key: string, value: string): void
  removeLink(objective: Path, index: number): void
}
