'use client'

import { ChevronDown } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
  /** Contiguous options sharing a group get a heading above the first of them. */
  group?: string
  /**
   * How this value looks once chosen. Given here too, so the list shows the
   * very chips it is offering rather than a column of grey text.
   */
  chipClassName?: string
  chipStyle?: React.CSSProperties
}

/**
 * A select whose open list looks like the rest of the app.
 *
 * A native `<select>` would be preferable — it comes with keyboard handling,
 * touch pickers and accessibility for nothing — but its popup is drawn by the
 * operating system, and Chrome and Safari ignore almost all CSS on `<option>`.
 * A light-on-white OS menu dropping out of a dark control is jarring enough to
 * be worth reimplementing the behaviour: arrows to move, Enter to choose,
 * Escape or a click outside to dismiss, Home and End to jump.
 *
 * Focus stays on the trigger and the highlight is published through
 * `aria-activedescendant`, which is the listbox pattern and avoids juggling
 * focus between the button and the list.
 */
export function Dropdown({
  value,
  options,
  onChange,
  label,
  icon,
  triggerClassName = '',
  triggerStyle,
  align = 'left',
  defaultOpen = false,
  placeholder = '',
  onClose,
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  label: string
  icon?: React.ReactNode
  /** Shown when no option matches the value, so the trigger is never blank. */
  placeholder?: string
  /** Colour and shape of the closed control; the structure is fixed. */
  triggerClassName?: string
  triggerStyle?: React.CSSProperties
  align?: 'left' | 'right'
  defaultOpen?: boolean
  onClose?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [highlight, setHighlight] = useState(0)
  const root = useRef<HTMLDivElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value)

  const close = () => {
    setOpen(false)
    onClose?.()
  }

  const choose = (option: DropdownOption) => {
    onChange(option.value)
    setOpen(false)
    onClose?.()
  }

  // Open on the current value, not wherever the highlight was left last time.
  useEffect(() => {
    if (!open) return
    const current = options.findIndex((option) => option.value === value)
    setHighlight(current === -1 ? 0 : current)
  }, [open, value, options])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => {
    if (!open) return
    list.current
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, highlight])

  const move = (delta: number) =>
    setHighlight((current) => (current + delta + options.length) % options.length)

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        setHighlight(0)
        break
      case 'End':
        event.preventDefault()
        setHighlight(options.length - 1)
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const option = options[highlight]
        if (option) choose(option)
        break
      }
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        close()
        break
    }
  }

  return (
    <div ref={root} className="relative inline-flex">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        aria-label={label}
        title={label}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
        style={triggerStyle}
        className={`flex items-center gap-1 ${triggerClassName}`}
      >
        {icon}
        <span className="truncate">{selected?.label ?? (value || placeholder)}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          className={`absolute top-full z-30 mt-1 max-h-64 min-w-full overflow-y-auto
            rounded-md border border-line bg-surface p-1 text-xs shadow-xl
            ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map((option, index) => {
            const heading =
              option.group !== undefined && option.group !== options[index - 1]?.group
            return (
              <Fragment key={option.value}>
                {heading && (
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] tracking-wide text-ink-faint uppercase">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-highlighted={index === highlight}
                  onPointerEnter={() => setHighlight(index)}
                  onClick={() => choose(option)}
                  className={`cursor-pointer rounded px-1.5 py-1 whitespace-nowrap
                    ${index === highlight ? 'bg-line/60' : ''}`}
                >
                  {option.chipClassName || option.chipStyle ? (
                    <span className={option.chipClassName} style={option.chipStyle}>
                      {option.label}
                    </span>
                  ) : (
                    <span
                      className={
                        index === highlight || option.value === value
                          ? 'text-ink'
                          : 'text-ink-muted'
                      }
                    >
                      {option.label}
                    </span>
                  )}
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Plain string options, the common case. */
export function toOptions(values: readonly string[]): DropdownOption[] {
  return values.map((value) => ({ value, label: value }))
}
