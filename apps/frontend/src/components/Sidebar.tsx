import { useState } from "react"
import type { ConnectionStatus } from "../hooks/useSocket"
import { isRunning, sessionTitle, type UIWorkspace } from "../lib/transcript"

const STATUS_COPY: Record<ConnectionStatus, string> = {
  connecting: "Connecting to the agent",
  open: "Connected",
  closed: "Disconnected — retrying"
}

function WorkspaceItem({
  workspace,
  open,
  activeSessionId,
  onToggle,
  onSelectSession,
  onNewSession
}: {
  workspace: UIWorkspace
  open: boolean
  activeSessionId: string | null
  onToggle: () => void
  onSelectSession: (id: string) => void
  onNewSession: (workspaceId: string) => void
}) {
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
          {workspace.sessions.map(session => {
            const active = session.id === activeSessionId
            return (
              <button
                key={session.id}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] ${
                  active ? "bg-raised text-ink" : "text-dim hover:bg-panel hover:text-ink"
                }`}
                onClick={() => onSelectSession(session.id)}
              >
                <span className="min-w-0 flex-1 truncate">{sessionTitle(session)}</span>
                {isRunning(session) && (
                  <span className="pulse shrink-0 text-[10px] text-signal" aria-label="Running">
                    ◆
                  </span>
                )}
              </button>
            )
          })}
          <button
            className="w-full px-2 py-1.5 text-left font-mono text-[12px] text-dim hover:text-ink"
            onClick={() => workspace.id && onNewSession(workspace.id)}
          >
            + New session
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  workspaces,
  activeSessionId,
  status,
  onAddWorkspace,
  onSelectSession,
  onNewSession
}: {
  workspaces: UIWorkspace[]
  activeSessionId: string | null
  status: ConnectionStatus
  onAddWorkspace: (path: string) => void
  onSelectSession: (id: string) => void
  onNewSession: (workspaceId: string) => void
}) {
  const [path, setPath] = useState("")
  const [expanded, setExpanded] = useState<string[]>([])

  function toggle(id: string) {
    setExpanded(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function add() {
    const trimmed = path.trim()
    if (!trimmed) {
      return
    }
    onAddWorkspace(trimmed)
    setPath("")
  }

  return (
    <div className="flex h-full flex-col bg-panel">
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

      <div className="flex-1 overflow-y-auto p-1.5">
        {workspaces.length === 0 ? (
          <p className="px-2 py-3 text-[13px] leading-relaxed text-dim">
            Add a folder above to give the agent somewhere to work.
          </p>
        ) : (
          workspaces.map((w, i) => (
            <WorkspaceItem
              key={w.id ?? `pending-${i}`}
              workspace={w}
              open={w.id !== null && expanded.includes(w.id)}
              activeSessionId={activeSessionId}
              onToggle={() => w.id && toggle(w.id)}
              onSelectSession={onSelectSession}
              onNewSession={onNewSession}
            />
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "open"
              ? "bg-signal"
              : status === "connecting"
                ? "bg-dim pulse"
                : "bg-alarm"
          }`}
          aria-hidden
        />
        <span className="font-mono text-[11px] text-dim">{STATUS_COPY[status]}</span>
      </div>
    </div>
  )
}
