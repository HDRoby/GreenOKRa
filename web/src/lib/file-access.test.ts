import { afterEach, describe, expect, test, vi } from 'vitest'

import { canSaveInPlace, openWithPicker, save } from './file-access.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A handle that behaves, unless a method is overridden to misbehave. */
function fakeHandle(overrides: Record<string, unknown> = {}): FileSystemFileHandle {
  return {
    getFile: async () => new File(['okrs: yes\n'], 'plan.yaml'),
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
    }),
    ...overrides,
  } as unknown as FileSystemFileHandle
}

function stubPicker(behaviour: () => Promise<FileSystemFileHandle[]>) {
  vi.stubGlobal('window', { showOpenFilePicker: behaviour })
}

function refuse(name: string) {
  return new DOMException('the platform said no', name)
}

/** Capture downloads without a DOM, preserving `new URL()`. */
function stubDownloads(): string[] {
  const downloaded: string[] = []
  const RealURL = globalThis.URL
  class StubURL extends RealURL {
    static createObjectURL = () => 'blob:stub'
    static revokeObjectURL = () => {}
  }
  vi.stubGlobal('URL', StubURL)
  vi.stubGlobal('document', {
    createElement: () => ({
      href: '',
      download: '',
      click() {
        downloaded.push(this.download)
      },
    }),
  })
  return downloaded
}

describe('opening', () => {
  test('falls back silently when the browser has no picker', async () => {
    vi.stubGlobal('window', {})
    expect(canSaveInPlace()).toBe(false)
    expect(await openWithPicker()).toEqual({ kind: 'fallback' })
  })

  test('reads the file when the picker works', async () => {
    const handle = fakeHandle()
    stubPicker(async () => [handle])

    const outcome = await openWithPicker()

    expect(outcome).toEqual({
      kind: 'opened',
      file: { name: 'plan.yaml', text: 'okrs: yes\n', handle },
    })
  })

  test('treats a dismissed picker as a cancellation, not a failure', async () => {
    stubPicker(async () => {
      throw refuse('AbortError')
    })
    expect(await openWithPicker()).toEqual({ kind: 'cancelled' })
  })

  test('falls back with an explanation when the picker itself is blocked', async () => {
    stubPicker(async () => {
      throw refuse('NotAllowedError')
    })

    const outcome = await openWithPicker()

    expect(outcome.kind).toBe('fallback')
    expect(outcome.kind === 'fallback' && outcome.reason).toContain('blocked')
  })

  /**
   * The reported bug: the picker hands back a handle, then reading it throws
   * NotAllowedError. This must degrade, not escape as an unhandled rejection.
   */
  test('falls back when the handle refuses to be read', async () => {
    stubPicker(async () => [
      fakeHandle({
        getFile: async () => {
          throw refuse('NotAllowedError')
        },
      }),
    ])

    const outcome = await openWithPicker()

    expect(outcome.kind).toBe('fallback')
    expect(outcome.kind === 'fallback' && outcome.reason).toContain('Chrome or Edge')
  })

  test('falls back when read permission is refused', async () => {
    stubPicker(async () => [
      fakeHandle({
        queryPermission: async () => 'prompt',
        requestPermission: async () => 'denied',
        getFile: async () => {
          throw new Error('should never be reached')
        },
      }),
    ])

    const outcome = await openWithPicker()

    expect(outcome.kind).toBe('fallback')
    expect(outcome.kind === 'fallback' && outcome.reason).toContain('read access')
  })

  test('proceeds when permission is already granted', async () => {
    stubPicker(async () => [
      fakeHandle({
        queryPermission: async () => 'granted',
        requestPermission: async () => {
          throw new Error('should not need to ask again')
        },
      }),
    ])

    expect((await openWithPicker()).kind).toBe('opened')
  })

  test('survives a picker that resolves to nothing', async () => {
    stubPicker(async () => [])
    expect(await openWithPicker()).toEqual({ kind: 'cancelled' })
  })
})

describe('saving', () => {
  test('writes in place when the handle allows it', async () => {
    const written: string[] = []
    const handle = fakeHandle({
      createWritable: async () => ({
        write: async (text: string) => {
          written.push(text)
        },
        close: async () => {},
      }),
    })

    const outcome = await save({ name: 'plan.yaml', text: '', handle }, 'new: text\n')

    expect(outcome).toEqual({ kind: 'saved' })
    expect(written).toEqual(['new: text\n'])
  })

  test('downloads when there is no handle', async () => {
    const downloaded = stubDownloads()

    const outcome = await save({ name: 'plan.yaml', text: '', handle: null }, 'a: b\n')

    expect(outcome).toEqual({ kind: 'downloaded' })
    expect(downloaded).toEqual(['plan.yaml'])
  })

  test('never loses the edit when writing in place is blocked', async () => {
    const downloaded = stubDownloads()
    const handle = fakeHandle({
      createWritable: async () => {
        throw refuse('NotAllowedError')
      },
    })

    const outcome = await save({ name: 'plan.yaml', text: '', handle }, 'a: b\n')

    expect(outcome.kind).toBe('downloaded')
    expect(outcome.kind === 'downloaded' && outcome.reason).toContain('blocked')
    expect(downloaded).toEqual(['plan.yaml'])
  })

  test('downloads when write permission is refused', async () => {
    const downloaded = stubDownloads()
    const handle = fakeHandle({
      queryPermission: async () => 'denied',
      requestPermission: async () => 'denied',
    })

    const outcome = await save({ name: 'plan.yaml', text: '', handle }, 'a: b\n')

    expect(outcome.kind).toBe('downloaded')
    expect(downloaded).toEqual(['plan.yaml'])
  })
})
