import type { AgentSummary } from "commons/types"
import type { UIWorkspace } from "../../lib/transcript"
import { NewSession } from "./NewSession"
import { SessionRow } from "./SessionRow"

export function WorkspaceItem({
  workspace,
  open,
  activeSessionId,
  agents,
  onToggle,
  onSelectSession,
  onNewSession
}: {
  workspace: UIWorkspace
  open: boolean
  activeSessionId: string | null
  agents: AgentSummary[]
  onToggle: () => void
  onSelectSession: (id: string) => void
  onNewSession: (workspaceId: string, agentId: string) => void
}) {
  // A workspace we just created has no server id yet, so it can't be opened.
  const pending = workspace.id === null

  return (
    <div className="mb-0.5">
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-raised disabled:opacity-40"
        onClick={onToggle}
        disabled={pending}
        aria-expanded={open}
      >
        <span
          className={`shrink-0 text-dim transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ›
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] text-ink">
            {workspace.name}
          </span>
          <span className="truncate-path block font-mono text-[11px] text-dim">
            {workspace.path}
          </span>
        </span>
        {pending ? (
          <span className="shrink-0 font-mono text-[11px] text-dim">saving</span>
        ) : (
          workspace.sessions.length > 0 && (
            <span className="shrink-0 font-mono text-[11px] text-dim">
              {workspace.sessions.length}
            </span>
          )
        )}
      </button>

      {open && !pending && (
        <div className="ml-4 border-l border-rule pl-1">
          {workspace.sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
            />
          ))}
          <NewSession
            agents={agents}
            onCreate={agentId => workspace.id && onNewSession(workspace.id, agentId)}
          />
        </div>
      )}
    </div>
  )
}
