'use client'

import { FileDown, FilePlus2, FolderOpen, Save, Sprout } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from 'yaml'

import { InitiativeCard } from '@/components/initiative.tsx'
import type { Editor } from '@/components/editor.ts'
import { ReportPanel } from '@/components/report-panel.tsx'
import { Wordmark } from '@/components/wordmark.tsx'
import { PersonFilterSelect } from '@/components/person-filter.tsx'
import { InitiativeTabs } from '@/components/tabs.tsx'
import { PortfolioSnapshot } from '@/components/portfolio-snapshot.tsx'
import {
  type Path,
  addInitiative,
  addKeyResult,
  addLink,
  addPerson,
  addProgressNote,
  addObjective,
  applyStatusRules,
  removeInitiative,
  removeKeyResult,
  removeLink,
  removeObjective,
  setField,
  setNoteField,
  setInitiativeOwner,
  setObjectiveOwners,
  setOptionalField,
  setOwners,
  updatePerson,
  sortNotes,
} from '@/lib/edit.ts'
import {
  EVERYONE,
  type PersonFilter,
  filterablePeople,
  visibleInitiatives,
} from '@/lib/filter.ts'
import { collectPools } from '@/lib/labels.ts'
import {
  type OpenedFile,
  canSaveInPlace,
  openWithPicker,
  readFromInput,
  save,
} from '@/lib/file-access.ts'
import {
  KR_KEYS,
  OBJECTIVE_KEYS,
  type OkrFile,
  type Person,
  type Report,
  SI_KEYS,
  parse,
  stringify,
  toData,
  validate,
} from '@/lib/okr.ts'

const LINK_KEYS = ['title', 'url'] as const

/**
 * A file with nothing in it yet.
 *
 * The list is empty rather than seeded with a placeholder initiative: the
 * format says a file needs at least one, so validation says so too, and the
 * page offers the same "new initiative" form it always does. Inventing a
 * TEK/O1/KR1 nobody asked for would only have to be edited away.
 */
const EMPTY_FILE = `version: 1
strategic_initiatives: []
`

export default function Page() {
  const docRef = useRef<Document | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<OpenedFile | null>(null)
  const [data, setData] = useState<OkrFile | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tab, setTab] = useState(0)
  const [person, setPerson] = useState<PersonFilter>(EVERYONE)
  // Resolved after mount, never during render: the server has no `window`, so
  // asking it there and in the browser gives different answers and the
  // hydrated markup no longer matches. Null means "not known yet".
  const [canSave, setCanSave] = useState<boolean | null>(null)

  useEffect(() => {
    setCanSave(canSaveInPlace())
  }, [])

  const load = useCallback((opened: OpenedFile) => {
    const parsed = parse(opened.text)
    if (parsed.errors.length > 0) {
      setMessage(`${opened.name} is not valid YAML: ${parsed.errors[0]?.message ?? ''}`)
      return
    }
    docRef.current = parsed
    // Objectives or initiatives may be sitting at Not Started with work
    // already moving below them. Say so rather than fixing it silently.
    const advanced = applyStatusRules(parsed)
    setFile(opened)
    setReport(validate(parsed))
    setData(toData(parsed))
    setDirty(advanced.length > 0)
    setMessage(
      advanced.length > 0
        ? `${advanced.join(', ')} advanced to In Progress, following the work below.`
        : null,
    )
    setTab(0)
    setPerson(EVERYONE)
  }, [])

  const commit = useCallback((mutate: (doc: Document) => void) => {
    const doc = docRef.current
    if (!doc) return
    mutate(doc)
    applyStatusRules(doc)
    setReport(validate(doc))
    setData(toData(doc))
    setDirty(true)
    setMessage(null)
  }, [])

  const editor: Editor = useMemo(
    () => ({
      setInitiative: (path, key, value, required = true) =>
        commit((doc) =>
          required
            ? setField(doc, path, key, value, SI_KEYS)
            : setOptionalField(doc, path, key, value, SI_KEYS),
        ),
      setObjective: (path, key, value, required = true) =>
        commit((doc) =>
          required
            ? setField(doc, path, key, value, OBJECTIVE_KEYS)
            : setOptionalField(doc, path, key, value, OBJECTIVE_KEYS),
        ),
      setKeyResult: (path, key, value, required = true) =>
        commit((doc) =>
          required
            ? setField(doc, path, key, value, KR_KEYS)
            : setOptionalField(doc, path, key, value, KR_KEYS),
        ),
      setOwners: (path, role, people) =>
        commit((doc) => setOwners(doc, path, role, people)),
      setObjectiveOwners: (path, people) =>
        commit((doc) => setObjectiveOwners(doc, path, people)),
      setInitiativeOwner: (path, person) =>
        commit((doc) => setInitiativeOwner(doc, path, person)),
      editPerson: (identity, person) =>
        commit((doc) => updatePerson(doc, identity, person)),
      addPerson: (person) => {
        // The roster has to grow before the reference is written, and the
        // caller needs the identity back to write it.
        const doc = docRef.current
        if (!doc) return ''
        const identity = addPerson(doc, person)
        commit(() => {})
        return identity
      },

      addNote: (path, date, note) =>
        commit((doc) => addProgressNote(doc, path, date, note)),
      setNote: (path, index, key, value) =>
        commit((doc) => setNoteField(doc, path, index, key, value)),
      sortNotes: (path) => commit((doc) => sortNotes(doc, path)),
      addKeyResult: (path) => commit((doc) => addKeyResult(doc, path)),
      addObjective: (path) => commit((doc) => addObjective(doc, path)),
      addInitiative: (draft) => commit((doc) => addInitiative(doc, draft)),

      removeInitiative: (index) => commit((doc) => removeInitiative(doc, index)),
      removeObjective: (path, index) =>
        commit((doc) => removeObjective(doc, path, index)),
      removeKeyResult: (path, index) =>
        commit((doc) => removeKeyResult(doc, path, index)),

      addLink: (path) => commit((doc) => addLink(doc, path)),
      setLink: (path: Path, index, key, value) =>
        commit((doc) => setField(doc, [...path, 'links', index], key, value, LINK_KEYS)),
      removeLink: (path, index) => commit((doc) => removeLink(doc, path, index)),
    }),
    [commit],
  )

  const openFile = useCallback(async () => {
    const outcome = await openWithPicker()
    if (outcome.kind === 'opened') {
      load(outcome.file)
      return
    }
    if (outcome.kind === 'cancelled') return
    // The browser has no picker, or refused to use it. Either way there is
    // always the plain file input to fall back on.
    if (outcome.reason) setMessage(outcome.reason)
    fileInput.current?.click()
  }, [load])

  const newFile = useCallback(() => {
    // Starting over discards whatever is unsaved, so ask first.
    if (dirty && !window.confirm('Start a new file? Unsaved changes will be lost.')) {
      return
    }
    load({ name: 'okrs.yaml', text: EMPTY_FILE, handle: null })
  }, [dirty, load])

  const loadExample = useCallback(async () => {
    const response = await fetch('./example.yaml')
    load({ name: '2026.yaml', text: await response.text(), handle: null })
  }, [load])

  const saveFile = useCallback(async () => {
    const doc = docRef.current
    if (!doc || !file) return
    // Normalise before writing, so what lands on disk is canonical.
    setReport(validate(doc))
    setData(toData(doc))
    const outcome = await save(file, stringify(doc))
    setDirty(false)
    if (outcome.kind === 'saved') {
      setMessage(`Saved ${file.name}`)
      return
    }
    setMessage(
      outcome.reason
        ? `Downloaded ${file.name} instead. ${outcome.reason}`
        : `Downloaded ${file.name} — this browser cannot write files in place.`,
    )
  }, [file])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        void saveFile()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveFile])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const initiatives = data?.strategic_initiatives ?? []
  // Pickers offer the values already in the file, so spellings stay stable.
  const pools = collectPools(data)
  // Filtering keeps true indices, since edits are addressed by index.
  const visible = visibleInitiatives(initiatives, person)
  // Fall back to the first visible tab when the current one is filtered away
  // or a shorter file has been loaded.
  const active = visible.some(({ index }) => index === tab)
    ? tab
    : (visible[0]?.index ?? 0)
  const current = visible.find(({ index }) => index === active)?.item

  return (
    <div className={`mx-auto min-h-screen max-w-5xl px-6 pb-24 ${data ? '' : 'pt-6'}`}>
      {/* Nothing open: the empty state carries the logo and its own Open
          button, so a bar above it would only repeat itself. */}
      {data && (
        <EditorHeader
          file={file}
          dirty={dirty}
          report={report}
          people={filterablePeople(data)}
          person={person}
          onPerson={setPerson}
          onNew={newFile}
          onOpen={openFile}
          onSave={saveFile}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".yaml,.yml"
        hidden
        onChange={async (event) => {
          const chosen = event.target.files?.[0]
          if (chosen) load(await readFromInput(chosen))
          event.target.value = ''
        }}
      />

      {message && (
        <p className="mb-4 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted">
          {message}
        </p>
      )}

      {!data ? (
        <EmptyState
          onNew={newFile}
          onOpen={openFile}
          onExample={loadExample}
          canSave={canSave}
        />
      ) : (
        <main>
          <InitiativeTabs
            initiatives={visible}
            active={active}
            person={person}
            onSelect={setTab}
            people={pools.people}
            onAddPerson={editor.addPerson}
            onAdd={(draft) => {
              editor.addInitiative(draft)
              // A new initiative names nobody yet, so a filter would hide it.
              setPerson(EVERYONE)
              setTab(initiatives.length) // show what was just created
            }}
          />
          {current ? (
            <InitiativeCard
              key={active}
              initiative={current}
              index={active}
              pools={pools}
              person={person}
              editor={editor}
            />
          ) : (
            person !== EVERYONE && (
              <p className="mt-16 text-center text-sm text-ink-muted">
                Nothing in this file involves {person}.
              </p>
            )
          )}

          {/* Below everything, and across every initiative rather than the
              open one: the tabs show a file one column at a time, and this is
              the only place the whole portfolio is in view at once. */}
          <PortfolioSnapshot initiatives={visible} person={person} />
        </main>
      )}
    </div>
  )
}

function EmptyState({
  onNew,
  onOpen,
  onExample,
  canSave,
}: {
  onNew: () => void
  onOpen: () => void
  onExample: () => void
  canSave: boolean | null
}) {
  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center gap-6 text-center">
      <Wordmark size="large" />
      <div>
        <h2 className="text-lg font-medium">No file open</h2>
        <p className="mt-1 max-w-md text-sm text-ink-muted">
          Open an OKR file from your computer, or start a new one. Everything
          happens in the browser — nothing is uploaded anywhere.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-2 rounded-md border border-accent-dim bg-accent-dim/20 px-3 py-1.5 text-sm hover:bg-accent-dim/35"
        >
          <FolderOpen size={14} />
          Open a file
        </button>
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
        >
          <FilePlus2 size={14} />
          New OKR file
        </button>
        <button
          type="button"
          onClick={onExample}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
        >
          <Sprout size={14} />
          Load the example
        </button>
      </div>
      {canSave === false && (
        <p className="max-w-md text-xs text-ink-faint">
          This browser cannot write files in place, so saving will download a copy.
          Chrome and Edge can save back to the file you opened.
        </p>
      )}
    </div>
  )
}

/** The bar shown while a file is open: what it is, and what to do with it. */
function EditorHeader({
  file,
  dirty,
  report,
  people,
  person,
  onPerson,
  onNew,
  onOpen,
  onSave,
}: {
  file: OpenedFile | null
  dirty: boolean
  report: Report | null
  people: Person[]
  person: PersonFilter
  onPerson: (person: PersonFilter) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
}) {
  return (
    <header
      className="sticky top-0 z-10 -mx-6 mb-6 border-b border-line bg-canvas/90
        px-6 py-3 backdrop-blur"
    >
      <div className="flex items-center gap-4">
        <h1 className="shrink-0">
          <Wordmark />
        </h1>

        {file && (
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
            <span className="truncate font-mono">{file.name}</span>
            {dirty && (
              <span
                title="Unsaved changes"
                className="size-1.5 shrink-0 rounded-full bg-warn"
              />
            )}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {report && <ReportPanel report={report} />}
          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1
              text-xs hover:border-ink-faint"
          >
            <FolderOpen size={13} />
            Open
          </button>
          {file && (
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-md border border-accent-dim
                bg-accent-dim/20 px-2.5 py-1 text-xs text-ink hover:bg-accent-dim/35"
            >
              {file.handle ? <Save size={13} /> : <FileDown size={13} />}
              {file.handle ? 'Save' : 'Download'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2">
        <PersonFilterSelect people={people} person={person} onChange={onPerson} />
      </div>
    </header>
  )
}
