import { describe, expect, it } from 'vitest'

import { type KeyResult } from './okr.ts'
import { bandOf, tally } from './portfolio.ts'

const kr = (status?: string): KeyResult => ({ status }) as KeyResult

describe('bandOf', () => {
  it('maps Not Started and Completed one to one', () => {
    expect(bandOf('Not Started')).toBe('Not Started')
    expect(bandOf('Completed')).toBe('Completed')
  })

  it('collapses the three middle rungs into one band', () => {
    expect(bandOf('Started')).toBe('In Progress')
    expect(bandOf('In Progress')).toBe('In Progress')
    expect(bandOf('In Completion')).toBe('In Progress')
  })

  it('gives Aborted no band, so it is not counted', () => {
    expect(bandOf('Aborted')).toBeNull()
  })

  it('reads a messily written status the way the file would', () => {
    expect(bandOf('IN_COMPLETION')).toBe('In Progress')
    expect(bandOf('  completed ')).toBe('Completed')
  })

  it('treats an unset or unknown status as not started', () => {
    expect(bandOf(undefined)).toBe('Not Started')
    expect(bandOf('Parked')).toBe('Not Started')
  })
})

describe('tally', () => {
  it('counts nothing for an empty list', () => {
    expect(tally([])).toEqual({
      'Not Started': 0,
      'In Progress': 0,
      Completed: 0,
      counted: 0,
      aborted: 0,
    })
  })

  it('sorts each key result into its band', () => {
    const totals = tally([
      kr('Not Started'),
      kr('Started'),
      kr('In Progress'),
      kr('In Completion'),
      kr('Completed'),
      kr('Completed'),
    ])
    expect(totals['Not Started']).toBe(1)
    expect(totals['In Progress']).toBe(3)
    expect(totals.Completed).toBe(2)
  })

  it('keeps Aborted out of the length but reports it', () => {
    const totals = tally([kr('Completed'), kr('Aborted'), kr('Aborted')])
    expect(totals.counted).toBe(1)
    expect(totals.aborted).toBe(2)
    // Not scored zero: an aborted key result is absent, not not-started.
    expect(totals['Not Started']).toBe(0)
  })

  it('adds the three bands up to the counted length', () => {
    const totals = tally([kr('Not Started'), kr('Started'), kr('Completed'), kr('Aborted')])
    expect(totals['Not Started'] + totals['In Progress'] + totals.Completed).toBe(
      totals.counted,
    )
  })
})
