import { useState } from "react"
import type { DirectoryListing, FolderLocated } from "commons/types"
import { FolderMatches } from "./FolderMatches"
import { FolderPicker } from "./FolderPicker"

/**
 * Points the agent at a folder.
 *
 * The button opens the operating system's own folder dialog — the same one
 * every other application uses. What that dialog can't give back is a path,
 * so the server works out where the folder lives from its name and contents.
 * The two dialogs below are only for when that comes back unsure: a choice
 * between equally good matches, or browsing when it found nothing.
 */
export function AddWorkspaceForm({
  listing,
  loading,
  located,
  locating,
  onChooseFolder,
  onDismissLocated,
  onBrowse,
  onAdd
}: {
  listing: DirectoryListing | null
  loading: boolean
  located: FolderLocated | null
  locating: boolean
  onChooseFolder: () => void
  onDismissLocated: () => void
  onBrowse: (path?: string) => void
  onAdd: (path: string) => void
}) {
  const [browsing, setBrowsing] = useState(false)

  function browse() {
    onDismissLocated()
    setBrowsing(true)
    // Re-open where we left off; undefined lets the server pick the start.
    onBrowse(listing?.path)
  }

  function add(path: string) {
    onDismissLocated()
    setBrowsing(false)
    onAdd(path)
  }

  return (
    <div className="border-b border-rule p-3">
      <div className="mb-2 font-mono text-[12px] text-dim">Workspaces</div>
      <button
        className="w-full rounded-sm bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink hover:bg-rule disabled:opacity-40"
        onClick={onChooseFolder}
        disabled={locating}
      >
        {locating ? "Looking for it…" : "+ Choose folder…"}
      </button>

      {located && !browsing && (
        <FolderMatches
          located={located}
          onPick={add}
          onBrowse={browse}
          onCancel={onDismissLocated}
        />
      )}

      {browsing && (
        <FolderPicker
          listing={listing}
          loading={loading}
          onBrowse={onBrowse}
          onConfirm={add}
          onCancel={() => setBrowsing(false)}
        />
      )}
    </div>
  )
}
