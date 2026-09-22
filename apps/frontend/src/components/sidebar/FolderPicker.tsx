import { useEffect, useState } from "react"
import type { DirectoryListing } from "commons/types"

/**
 * Walk the server's filesystem and pick a folder by clicking it.
 *
 * The listing comes from the backend rather than a folder input because a
 * browser never discloses an absolute path, and an absolute path is what the
 * agent needs to work in. The path line stays editable anyway — it's the
 * quickest way to reach a dot-directory or somewhere far from home, and it
 * costs nothing to leave open.
 */
export function FolderPicker({
  listing,
  loading,
  onBrowse,
  onConfirm,
  onCancel
}: {
  listing: DirectoryListing | null
  loading: boolean
  onBrowse: (path?: string) => void
  onConfirm: (path: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(listing?.path ?? "")

  // Follow along as we walk, but don't fight anything half-typed: this only
  // runs when the listing itself moves.
  useEffect(() => {
    if (listing) {
      setDraft(listing.path)
    }
  }, [listing?.path])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-6"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-sm border border-rule bg-panel"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a folder"
      >
        <div className="border-b border-rule px-3 py-2 font-mono text-[12px] text-dim">
          Choose a folder
        </div>

        <div className="flex gap-1.5 border-b border-rule p-3">
          <input
            className="min-w-0 flex-1 rounded-sm border border-rule bg-void px-2 py-1.5 font-mono text-[12px] text-ink placeholder:text-dim/60 focus:border-dim focus:outline-none"
            value={draft}
            placeholder="/path/to/repo"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                onBrowse(draft.trim() || undefined)
              }
            }}
            aria-label="Current folder"
          />
          <button
            className="rounded-sm bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink hover:bg-rule disabled:opacity-40"
            onClick={() => listing?.parent && onBrowse(listing.parent)}
            disabled={!listing?.parent}
            title="Up one level"
            aria-label="Up one level"
          >
            ↑
          </button>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-1.5">
          {loading && !listing ? (
            <p className="px-2 py-3 font-mono text-[12px] text-dim">Reading…</p>
          ) : !listing ? (
            <p className="px-2 py-3 font-mono text-[12px] text-dim">
              Nothing loaded yet.
            </p>
          ) : listing.entries.length === 0 ? (
            <p className="px-2 py-3 font-mono text-[12px] text-dim">
              No sub-folders here. Pick this one, or go up.
            </p>
          ) : (
            listing.entries.map(entry => (
              <button
                key={entry.path}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left font-mono text-[12px] text-ink hover:bg-raised"
                onClick={() => onBrowse(entry.path)}
                // Double-clicking a folder is the habit from every other
                // picker, and it should mean "this one" rather than "again".
                onDoubleClick={() => onConfirm(entry.path)}
              >
                <span className="text-dim">▸</span>
                <span className="truncate">{entry.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-rule p-3">
          <span
            className="truncate-path min-w-0 flex-1 font-mono text-[11px] text-dim"
            title={listing?.path ?? ""}
          >
            {listing?.path ?? ""}
          </span>
          <button
            className="rounded-sm px-2.5 py-1.5 font-mono text-[12px] text-dim hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-sm bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink hover:bg-rule disabled:opacity-40"
            onClick={() => listing && onConfirm(listing.path)}
            disabled={!listing}
          >
            Use this folder
          </button>
        </div>
      </div>
    </div>
  )
}
