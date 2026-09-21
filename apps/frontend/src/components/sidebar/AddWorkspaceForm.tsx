import { useState } from "react"

/** Path input for pointing the agent at a folder. */
export function AddWorkspaceForm({ onAdd }: { onAdd: (path: string) => void }) {
  const [path, setPath] = useState("")

  function add() {
    const trimmed = path.trim()
    if (!trimmed) {
      return
    }
    onAdd(trimmed)
    setPath("")
  }

  return (
    <div className="border-b border-rule p-3">
      <div className="mb-2 font-mono text-[12px] text-dim">Workspaces</div>
      <div className="flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded-sm border border-rule bg-void px-2 py-1.5 font-mono text-[12px] text-ink placeholder:text-dim/60 focus:border-dim focus:outline-none"
          placeholder="/path/to/repo"
          value={path}
          onChange={e => setPath(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") add()
          }}
          aria-label="Folder to open"
        />
        <button
          className="rounded-sm bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink hover:bg-rule disabled:opacity-40"
          onClick={add}
          disabled={!path.trim()}
        >
          Add
        </button>
      </div>
    </div>
  )
}
