'use client'

import { Check, ExternalLink, Link2, Pencil, X } from 'lucide-react'
import { useState } from 'react'

import type { Link } from '@/lib/okr.ts'

import { TextField } from './fields.tsx'

/** Only an address a browser can actually follow gets a live link. */
function followable(url: string | undefined): boolean {
  return /^https?:\/\/\S+$/i.test(url?.trim() ?? '')
}

/**
 * A link, shown as its text and edited as two labelled parts.
 *
 * The same shape as a markdown editor's link control: normally you see the
 * words, and opening it reveals the text and the address separately. Putting
 * both on the row at all times gave equal weight to a URL nobody reads.
 */
export function LinkRow({
  link,
  onChange,
  onRemove,
}: {
  link: Link
  onChange: (key: 'title' | 'url', value: string) => void
  onRemove: () => void
}) {
  // A half-finished link opens for editing: there is nothing to show yet.
  const [editing, setEditing] = useState(() => !link.title?.trim())
  const url = link.url?.trim() ?? ''
  const live = followable(url)

  if (editing) {
    return (
      <div className="space-y-1 rounded-md border border-accent-dim/50 bg-canvas p-2">
        <label className="flex items-center gap-2 text-xs text-ink-faint">
          <span className="w-20 shrink-0 text-right">text shown</span>
          <TextField
            value={link.title ?? ''}
            placeholder="What the link says"
            onCommit={(value) => onChange('title', value)}
            className="text-ink-muted"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-faint">
          <span className="w-20 shrink-0 text-right">URI link</span>
          <TextField
            value={link.url ?? ''}
            placeholder="https://…"
            onCommit={(value) => onChange('url', value)}
            className="font-mono text-ink-muted"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent"
          >
            <Check size={12} />
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 text-xs">
      <Link2 size={12} className="shrink-0 text-ink-faint" />

      {live ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          title={`Open ${url} in a new tab`}
          className="min-w-0 truncate text-ink-muted underline decoration-line
            underline-offset-2 hover:text-accent hover:decoration-accent"
        >
          {link.title || url}
        </a>
      ) : (
        <span
          title={
            url === ''
              ? 'No address yet'
              : 'Needs to start with http:// or https:// to be followable'
          }
          className="min-w-0 truncate text-ink-muted"
        >
          {link.title || <em className="text-ink-faint">(not set)</em>}
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-1.5 opacity-0
        transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit link"
          title="Edit the text and address"
          className="text-ink-faint hover:text-ink"
        >
          <Pencil size={12} />
        </button>
        {live ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open link in a new tab"
            className="text-ink-faint hover:text-accent"
          >
            <ExternalLink size={12} />
          </a>
        ) : (
          <span
            aria-disabled="true"
            title="Add a followable address to open this"
            className="cursor-not-allowed text-ink-faint opacity-40"
          >
            <ExternalLink size={12} />
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove link"
          className="text-ink-faint hover:text-dropped"
        >
          <X size={12} />
        </button>
      </span>
    </div>
  )
}
