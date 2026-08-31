/**
 * Opening and saving files from the browser, with no server involved.
 *
 * Chrome and Edge support the File System Access API, which writes back to the
 * file you opened — a real Save. Safari and Firefox do not, so there we fall
 * back to a file input for opening and a download for saving.
 */

export interface OpenedFile {
  name: string
  text: string
  handle: FileSystemFileHandle | null
}

interface PickerWindow {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
}

const YAML_TYPES = [
  {
    description: 'OKR file',
    accept: { 'application/yaml': ['.yaml', '.yml'] },
  },
]

/** True when the browser can write back to the file that was opened. */
export function canSaveInPlace(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showOpenFilePicker === 'function'
  )
}

/**
 * Open a file through the picker. Returns null when the browser has no picker
 * (the caller shows a file input instead) or when the user cancels.
 */
export async function openWithPicker(): Promise<OpenedFile | null> {
  const picker = (window as PickerWindow).showOpenFilePicker
  if (typeof picker !== 'function') return null

  try {
    const [handle] = await picker({ types: YAML_TYPES, multiple: false })
    if (!handle) return null
    const file = await handle.getFile()
    return { name: file.name, text: await file.text(), handle }
  } catch (error) {
    // The user dismissing the picker is not an error worth reporting.
    if ((error as Error).name === 'AbortError') return null
    throw error
  }
}

/** Read a file chosen through an `<input type="file">`. */
export async function readFromInput(file: File): Promise<OpenedFile> {
  return { name: file.name, text: await file.text(), handle: null }
}

export type SaveOutcome = 'saved' | 'downloaded'

/** Write back to the opened file, or download a copy if that is not possible. */
export async function save(file: OpenedFile, text: string): Promise<SaveOutcome> {
  if (file.handle) {
    const writable = await file.handle.createWritable()
    await writable.write(text)
    await writable.close()
    return 'saved'
  }
  download(file.name, text)
  return 'downloaded'
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
