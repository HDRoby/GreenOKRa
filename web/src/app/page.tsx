'use client'

import { FileDown, FilePlus2, FolderOpen, Save } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from 'yaml'

import { InitiativeCard } from '@/components/initiative.tsx'
import type { Editor } from '@/components/editor.ts'
import { ReportPanel } from '@/components/report-panel.tsx'
import {
  type Path,
  addInitiative,
  addKeyResult,
  addLink,
  addProgressNote,
  addObjective,
  removeLink,
  setField,
  setNumberField,
  setObjectiveOwners,
  setOptionalField,
  setOwners,
} from '@/lib/edit.ts'
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
  type Report,
  SI_KEYS,
  parse,
  stringify,
  toData,
  validate,
} from '@/lib/okr.ts'

const LINK_KEYS = ['title', 'url'] as const

export default function Page() {
  const docRef = useRef<Document | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<OpenedFile | null>(null)
  const [data, setData] = useState<OkrFile | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback((opened: OpenedFile) => {
    const parsed = parse(opened.text)
    if (parsed.errors.length > 0) {
      setMessage(`${opened.name} is not valid YAML: ${parsed.errors[0]?.message ?? ''}`)
      return
    }
    docRef.current = parsed
    setFile(opened)
    setReport(validate(parsed))
    setData(toData(parsed))
    setDirty(false)
    setMessage(null)
  }, [])

  const commit = useCallback((mutate: (doc: Document) => void) => {
    const doc = docRef.current
    if (!doc) return
    mutate(doc)
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
      setProgressOverride: (path, value) =>
        commit((doc) => setNumberField(doc, path, 'progress', value, KR_KEYS)),

      setOwners: (path, role, names) => commit((doc) => setOwners(doc, path, role, names)),
      setObjectiveOwners: (path, names) =>
        commit((doc) => setObjectiveOwners(doc, path, names)),

      addNote: (path, date, note) =>
        commit((doc) => addProgressNote(doc, path, date, note)),
      addKeyResult: (path) => commit((doc) => addKeyResult(doc, path)),
      addObjective: (path) => commit((doc) => addObjective(doc, path)),
      addInitiative: (id, title, timeframe) =>
        commit((doc) => addInitiative(doc, id, title, timeframe)),

      addLink: (path) => commit((doc) => addLink(doc, path)),
      setLink: (path: Path, index, key, value) =>
        commit((doc) => setField(doc, [...path, 'links', index], key, value, LINK_KEYS)),
      removeLink: (path, index) => commit((doc) => removeLink(doc, path, index)),
    }),
    [commit],
  )

  const openFile = useCallback(async () => {
    const opened = await openWithPicker()
    if (opened) {
      load(opened)
    } else if (!canSaveInPlace()) {
      fileInput.current?.click()
    }
  }, [load])

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
    setMessage(
      outcome === 'saved'
        ? `Saved ${file.name}`
        : `Downloaded ${file.name} — your browser cannot write files in place`,
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

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 pb-24">
      <header className="sticky top-0 z-10 -mx-6 mb-6 flex items-center gap-4 border-b border-line bg-canvas/90 px-6 py-3 backdrop-blur">
        <Image
          src="/logo-mark.png"
          alt=""
          width={26}
          height={22}
          priority
          className="shrink-0"
        />
        <h1 className="shrink-0 font-semibold">GreenOKRa</h1>

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
            onClick={openFile}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs hover:border-ink-faint"
          >
            <FolderOpen size={13} />
            Open
          </button>
          {file && (
            <button
              type="button"
              onClick={saveFile}
              className="flex items-center gap-1.5 rounded-md border border-accent-dim bg-accent-dim/20 px-2.5 py-1 text-xs text-ink hover:bg-accent-dim/35"
            >
              {file.handle ? <Save size={13} /> : <FileDown size={13} />}
              {file.handle ? 'Save' : 'Download'}
            </button>
          )}
        </div>
      </header>

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
        <EmptyState onOpen={openFile} onExample={loadExample} />
      ) : (
        <main className="space-y-4">
          {(data.strategic_initiatives ?? []).map((initiative, index) => (
            <InitiativeCard
              key={initiative.id ?? index}
              initiative={initiative}
              index={index}
              editor={editor}
            />
          ))}
          <NewInitiative onAdd={editor.addInitiative} />
        </main>
      )}
    </div>
  )
}

function EmptyState({
  onOpen,
  onExample,
}: {
  onOpen: () => void
  onExample: () => void
}) {
  return (
    <div className="mt-24 flex flex-col items-center gap-6 text-center">
      <Image src="/logo.png" alt="GreenOKRa" width={220} height={129} priority />
      <div>
        <h2 className="text-lg font-medium">No file open</h2>
        <p className="mt-1 max-w-md text-sm text-ink-muted">
          Open an OKR file from your computer. Everything happens in the browser —
          nothing is uploaded anywhere.
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
          onClick={onExample}
          className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
        >
          <FilePlus2 size={14} />
          Load the example
        </button>
      </div>
      {!canSaveInPlace() && (
        <p className="max-w-md text-xs text-ink-faint">
          This browser cannot write files in place, so saving will download a copy.
          Chrome and Edge can save back to the file you opened.
        </p>
      )}
    </div>
  )
}

/** New initiatives need an id up front, since ids are permanent. */
function NewInitiative({
  onAdd,
}: {
  onAdd: (id: string, title: string, timeframe: string) => void
}) {
  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const valid = /^[A-Za-z]{2,5}$/.test(id.trim()) && title.trim() !== ''

  const add = () => {
    if (!valid) return
    onAdd(id, title, timeframe.trim() || String(new Date().getFullYear()))
    setId('')
    setTitle('')
    setTimeframe('')
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-3">
      <input
        value={id}
        onChange={(event) => setId(event.target.value.toUpperCase())}
        placeholder="ID"
        maxLength={5}
        className="field w-16 font-mono text-sm uppercase"
      />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New strategic initiative"
        onKeyDown={(event) => event.key === 'Enter' && add()}
        className="field flex-1 text-sm"
      />
      <input
        value={timeframe}
        onChange={(event) => setTimeframe(event.target.value)}
        placeholder="2026"
        className="field w-20 text-sm"
      />
      <button
        type="button"
        onClick={add}
        disabled={!valid}
        className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs enabled:hover:border-accent-dim disabled:opacity-40"
      >
        <FilePlus2 size={12} />
        Add
      </button>
    </div>
  )
}
