/**
 * Opening and saving files from the browser, with no server involved.
 *
 * Chrome and Edge implement the File System Access API, which writes back to
 * the file you opened — a real Save. Safari and Firefox have no such API, and
 * some Chromium builds (Brave and Arc, for instance) expose it but refuse to
 * let it run.
 *
 * So the API is treated as an optimisation that may fail at any point, never as
 * something to rely on. Every path here degrades to the plain file input and a
 * download rather than surfacing an exception.
 */

export interface OpenedFile {
  name: string
  text: string
  handle: FileSystemFileHandle | null
}

/** What happened when we asked the browser for a file. */
export type OpenOutcome =
  | { kind: 'opened'; file: OpenedFile }
  | { kind: 'cancelled' }
  /** Use an `<input type="file">` instead. `reason` is set when worth saying. */
  | { kind: 'fallback'; reason?: string }

interface PickerWindow {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
}

/** The permission methods, which are not in every lib.dom yet. */
type Permissioned = FileSystemFileHandle & {
  queryPermission?: (descriptor: { mode: string }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: string }) => Promise<PermissionState>
}

const YAML_TYPES = [
  {
    description: 'OKR file',
    accept: { 'application/yaml': ['.yaml', '.yml'] },
  },
]

/** True when the browser claims it can write back to the file it opened. */
export function canSaveInPlace(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showOpenFilePicker === 'function'
  )
}

/**
 * Ask for permission on a handle.
 *
 * Picking a file usually grants read access implicitly, but not always — and
 * writing needs asking for explicitly. Older browsers have no permission
 * methods at all, in which case we assume the handle works and find out when
 * we use it.
 */
async function allowed(handle: FileSystemFileHandle, mode: string): Promise<boolean> {
  const permissioned = handle as Permissioned
  if (typeof permissioned.queryPermission !== 'function') return true
  try {
    if ((await permissioned.queryPermission({ mode })) === 'granted') return true
    if (typeof permissioned.requestPermission !== 'function') return false
    return (await permissioned.requestPermission({ mode })) === 'granted'
  } catch {
    return false
  }
}

/** Open a file through the browser's picker. */
export async function openWithPicker(): Promise<OpenOutcome> {
  const picker = (window as PickerWindow).showOpenFilePicker
  if (typeof picker !== 'function') return { kind: 'fallback' }

  let handle: FileSystemFileHandle | undefined
  try {
    ;[handle] = await picker({ types: YAML_TYPES, multiple: false })
  } catch (error) {
    // Dismissing the picker is not a failure worth reporting.
    if (isAbort(error)) return { kind: 'cancelled' }
    return { kind: 'fallback', reason: describeRefusal(error) }
  }
  if (!handle) return { kind: 'cancelled' }

  if (!(await allowed(handle, 'read'))) {
    return {
      kind: 'fallback',
      reason: 'This browser would not grant read access to that file.',
    }
  }

  try {
    const file = await handle.getFile()
    return { kind: 'opened', file: { name: file.name, text: await file.text(), handle } }
  } catch (error) {
    if (isAbort(error)) return { kind: 'cancelled' }
    return { kind: 'fallback', reason: describeRefusal(error) }
  }
}

function isAbort(error: unknown): boolean {
  return (error as Error | undefined)?.name === 'AbortError'
}

function describeRefusal(error: unknown): string {
  const name = (error as Error | undefined)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return (
      'This browser blocked direct file access, so opening falls back to a ' +
      'copy and saving will download. Brave and Arc block it by default; ' +
      'plain Chrome or Edge can save in place.'
    )
  }
  return `Could not open that file directly (${name ?? 'unknown error'}).`
}

/** Read a file chosen through an `<input type="file">`. */
export async function readFromInput(file: File): Promise<OpenedFile> {
  return { name: file.name, text: await file.text(), handle: null }
}

export type SaveOutcome =
  | { kind: 'saved' }
  /** Written as a download instead. `reason` is set if in-place saving failed. */
  | { kind: 'downloaded'; reason?: string }

/** Write back to the opened file, or download a copy if that is not possible. */
export async function save(file: OpenedFile, text: string): Promise<SaveOutcome> {
  if (!file.handle) {
    download(file.name, text)
    return { kind: 'downloaded' }
  }

  if (!(await allowed(file.handle, 'readwrite'))) {
    download(file.name, text)
    return {
      kind: 'downloaded',
      reason: 'This browser would not grant permission to write that file.',
    }
  }

  try {
    const writable = await file.handle.createWritable()
    await writable.write(text)
    await writable.close()
    return { kind: 'saved' }
  } catch (error) {
    // Never lose the edit because writing in place failed.
    download(file.name, text)
    return { kind: 'downloaded', reason: describeRefusal(error) }
  }
}

export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/yaml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Today as `YYYY-MM-DD` in the local timezone, for new progress notes. */
export function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
