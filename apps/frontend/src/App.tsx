import { useCallback, useState } from "react"
import type { OutgoingMessageType } from "commons/types"
import { useSocket } from "./hooks/useSocket"
import {
  appendLocalMessage,
  applyEvent,
  isRunning,
  localId,
  type UIWorkspace
} from "./lib/transcript"
import { Sidebar } from "./components/Sidebar"
import { Transcript } from "./components/Transcript"
import { Composer } from "./components/Composer"
import "./index.css"

const SERVER_URL = "ws://localhost:8080"

export function App() {
  const [workspaces, setWorkspaces] = useState<UIWorkspace[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onEvent = useCallback((event: OutgoingMessageType) => {
    setWorkspaces(prev => applyEvent(prev, event))

    if (event.type === "session-created") {
      setActiveSessionId(event.payload.id)
    }
    if (event.type === "error") {
      setError(event.payload.message)
    }
    if (event.type === "turn-ended" && event.payload.status === "error") {
      setError(event.payload.error ?? "The agent stopped before finishing.")
    }
  }, [])

  const { status, send } = useSocket(SERVER_URL, onEvent)
  const connected = status === "open"

  const workspace = workspaces.find(w => w.sessions.some(s => s.id === activeSessionId))
  const session = workspace?.sessions.find(s => s.id === activeSessionId)

  function addWorkspace(path: string) {
    const name = path.split("/").filter(Boolean).pop() ?? path
    // Show the row immediately; the server fills in the id.
    setWorkspaces(prev => [...prev, { id: null, name, path, sessions: [] }])
    send({ type: "create-workspace", payload: { path } })
  }

  function newSession(workspaceId: string) {
    send({ type: "create-session", payload: { workspaceId } })
  }

  function sendMessage(message: string) {
    if (!session) {
      return
    }
    const sessionId = session.id
    const sent = send({ type: "add-message", payload: { sessionId, message } })
    if (!sent) {
      setError("Not connected — your message wasn't sent.")
      return
    }
    // Paint it straight away; the server's echo reconciles onto this copy.
    setWorkspaces(prev => appendLocalMessage(prev, sessionId, localId(), message))
  }

  return (
    <div className="flex h-screen bg-void text-ink">
      <aside className="w-64 shrink-0 border-r border-rule">
        <Sidebar
          workspaces={workspaces}
          activeSessionId={activeSessionId}
          status={status}
          onAddWorkspace={addWorkspace}
          onSelectSession={setActiveSessionId}
          onNewSession={newSession}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="flex items-start gap-3 border-b border-alarm/40 bg-alarm/10 px-6 py-2">
            <p className="flex-1 font-mono text-[12px] text-alarm">{error}</p>
            <button
              className="font-mono text-[12px] text-alarm/70 hover:text-alarm"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {session && workspace ? (
          <>
            <header className="border-b border-rule px-6 py-3">
              <h1 className="font-mono text-[13px] text-ink">{workspace.name}</h1>
              <p className="truncate-path max-w-md font-mono text-[11px] text-dim">
                {workspace.path}
              </p>
            </header>
            <Transcript session={session} workspacePath={workspace.path} />
            <Composer onSend={sendMessage} busy={isRunning(session)} disabled={!connected} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-[15px] text-ink">No session open</p>
            <p className="max-w-sm text-[14px] leading-relaxed text-dim">
              Pick a session in the sidebar, or start a new one inside a workspace.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
