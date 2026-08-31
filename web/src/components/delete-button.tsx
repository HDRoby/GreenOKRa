'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Delete, behind a confirmation.
 *
 * A native `<dialog>` rather than a hand-built overlay: it comes with the
 * backdrop, the focus trap, Escape to dismiss, and inertness of everything
 * behind it — all of which a div would have to reimplement and usually gets
 * wrong.
 *
 * `what` names the record, because "Are you sure?" alone does not say what is
 * about to go, and these are not recoverable.
 */
export function DeleteButton({
  what,
  onConfirm,
}: {
  what: string
  onConfirm: () => void
}) {
  const [asking, setAsking] = useState(false)
  const dialog = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (asking && !element.open) element.showModal()
    if (!asking && element.open) element.close()
  }, [asking])

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        title={`Delete ${what}`}
        className="flex items-center gap-1 text-xs text-ink-faint hover:text-dropped"
      >
        <Trash2 size={12} />
        Delete
      </button>

      <dialog
        ref={dialog}
        // Escape and the backdrop close it without going through the button.
        onClose={() => setAsking(false)}
        aria-labelledby="confirm-title"
        // `m-auto` is what centres a modal dialog in the viewport; the CSS
        // reset zeroes margins, which leaves it pinned to the corner.
        className="m-auto max-w-sm rounded-lg border border-line bg-surface p-5
          text-ink backdrop:bg-black/60"
      >
        <h2 id="confirm-title" className="text-base font-medium">
          Are you sure?
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          {what} will be removed. Nothing else refers to it afterwards, and this
          cannot be undone from here.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setAsking(false)}
            className="rounded-md border border-line px-3 py-1 text-sm
              hover:border-ink-faint"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => {
              setAsking(false)
              onConfirm()
            }}
            className="rounded-md border border-dropped bg-dropped/20 px-3 py-1
              text-sm text-ink hover:bg-dropped/35"
          >
            Yes
          </button>
        </div>
      </dialog>
    </>
  )
}
