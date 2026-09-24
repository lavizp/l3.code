import { useState } from "react"
import type { AgentSummary, DirectoryListing } from "commons/types"
import type { ConnectionStatus as Status } from "../../hooks/useSocket"
import type { UIWorkspace } from "../../lib/transcript"
import { AddWorkspaceForm } from "./AddWorkspaceForm"
import { ConnectionStatus } from "./ConnectionStatus"
import { WorkspaceItem } from "./WorkspaceItem"

export function Sidebar({
  workspaces,
  activeSessionId,
  status,
  agents,
  directory,
  directoryLoading,
  onBrowseDirectory,
  onAddWorkspace,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession
}: {
  workspaces: UIWorkspace[]
  activeSessionId: string | null
  status: Status
  agents: AgentSummary[]
  directory: DirectoryListing | null
  directoryLoading: boolean
  onBrowseDirectory: (path?: string) => void
  onAddWorkspace: (path: string) => void
  onSelectSession: (id: string) => void
  onNewSession: (workspaceId: string, agentId: string) => void
  onRenameSession: (id: string, name: string) => void
  onDeleteSession: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string[]>([])

  function toggle(id: string) {
    setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  return (
    <div className="flex h-full flex-col bg-panel">
      <AddWorkspaceForm
        listing={directory}
        loading={directoryLoading}
        onBrowse={onBrowseDirectory}
        onAdd={onAddWorkspace}
      />

      <div className="flex-1 overflow-y-auto p-1.5">
        {workspaces.length === 0 ? (
          <p className="px-2 py-3 text-[13px] leading-relaxed text-dim">
            Choose a folder above to give the agent somewhere to work.
          </p>
        ) : (
          workspaces.map((w, i) => (
            <WorkspaceItem
              key={w.id ?? `pending-${i}`}
              workspace={w}
              open={w.id !== null && expanded.includes(w.id)}
              activeSessionId={activeSessionId}
              agents={agents}
              onToggle={() => w.id && toggle(w.id)}
              onSelectSession={onSelectSession}
              onNewSession={onNewSession}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
            />
          ))
        )}
      </div>

      <ConnectionStatus status={status} />
    </div>
  )
}
