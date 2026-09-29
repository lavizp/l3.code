import type { DirectoryListing, ProviderSummary, Workspace } from "commons/types"
import type { ConnectionStatus as Status } from "../../hooks/useSocket"
import { AddWorkspaceForm } from "./AddWorkspaceForm"
import { ConnectionStatus } from "./ConnectionStatus"
import { ProviderList } from "./ProviderList"

/**
 * What's in view: a project, or nothing but the skills that follow the
 * person around.
 *
 * "Personal" is a row rather than a mode because it is the same question as
 * a project — which folder are we reading skills out of — and putting it in
 * the same list is what makes a personal skill and a project skill feel like
 * the same kind of thing, which they are.
 */
export function Sidebar({
  workspaces,
  workspaceId,
  providers,
  status,
  attempts,
  retryAt,
  everConnected,
  directory,
  directoryLoading,
  onSelectWorkspace,
  onBrowseDirectory,
  onAddWorkspace,
  onReconnect
}: {
  workspaces: Workspace[]
  workspaceId: string | null
  providers: ProviderSummary[]
  status: Status
  attempts: number
  retryAt: number | null
  everConnected: boolean
  directory: DirectoryListing | null
  directoryLoading: boolean
  onSelectWorkspace: (id: string | null) => void
  onBrowseDirectory: (path?: string) => void
  onAddWorkspace: (path: string) => void
  onReconnect: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-panel">
      <AddWorkspaceForm
        listing={directory}
        loading={directoryLoading}
        onBrowse={onBrowseDirectory}
        onAdd={onAddWorkspace}
      />

      <div className="flex-1 overflow-y-auto p-1.5">
        <Row
          name="Personal"
          detail="Skills you carry everywhere"
          active={workspaceId === null}
          onSelect={() => onSelectWorkspace(null)}
        />

        {workspaces.map((workspace, i) => (
          <Row
            key={workspace.id || `pending-${i}`}
            name={workspace.name}
            detail={workspace.path}
            path
            active={workspace.id === workspaceId}
            onSelect={() => workspace.id && onSelectWorkspace(workspace.id)}
          />
        ))}
      </div>

      <ProviderList providers={providers} />

      <ConnectionStatus
        status={status}
        attempts={attempts}
        retryAt={retryAt}
        everConnected={everConnected}
        onReconnect={onReconnect}
      />
    </div>
  )
}

function Row({
  name,
  detail,
  path,
  active,
  onSelect
}: {
  name: string
  detail: string
  /** Truncate from the left, so the end of a folder path stays legible. */
  path?: boolean
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`block w-full rounded px-2 py-1.5 text-left transition-colors ${
        active ? "bg-raised" : "hover:bg-raised/60"
      }`}
    >
      <span className="block truncate font-mono text-[13px] text-ink">{name}</span>
      <span
        className={`mt-0.5 block font-mono text-[11px] text-dim ${
          path ? "truncate-path" : "truncate"
        }`}
      >
        {detail}
      </span>
    </button>
  )
}
