import { useState } from "react"
import type { DirectoryListing } from "commons/types"
import { FolderPicker } from "./FolderPicker"

/** Points the agent at a folder, chosen by walking the server's filesystem. */
export function AddWorkspaceForm({
  listing,
  loading,
  onBrowse,
  onAdd
}: {
  listing: DirectoryListing | null
  loading: boolean
  onBrowse: (path?: string) => void
  onAdd: (path: string) => void
}) {
  const [picking, setPicking] = useState(false)

  function open() {
    setPicking(true)
    // Re-open where we left off, refreshed; undefined lets the server choose
    // the starting point the first time.
    onBrowse(listing?.path)
  }

  function confirm(path: string) {
    setPicking(false)
    onAdd(path)
  }

  return (
    <div className="border-b border-rule p-3">
      <div className="mb-2 font-mono text-[12px] text-dim">Workspaces</div>
      <button
        className="w-full rounded-sm bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink hover:bg-rule"
        onClick={open}
      >
        + Choose folder…
      </button>

      {picking && (
        <FolderPicker
          listing={listing}
          loading={loading}
          onBrowse={onBrowse}
          onConfirm={confirm}
          onCancel={() => setPicking(false)}
        />
      )}
    </div>
  )
}
