import { useCallback, useState } from "react"
import type { OutgoingMessageType } from "commons/types"
import { SERVER_URL } from "../config"
import {
  appendLocalMessage,
  applyEvent,
  findWorkspaceOfSession,
  localId,
  type UISession,
  type UIWorkspace
} from "../lib/transcript"
import { useSocket, type ConnectionStatus } from "./useSocket"

export type AgentClient = {
  workspaces: UIWorkspace[]
  workspace: UIWorkspace | undefined
  session: UISession | undefined
  activeSessionId: string | null
  status: ConnectionStatus
  connected: boolean
  error: string | null
  selectSession: (id: string | null) => void
  dismissError: () => void
  addWorkspace: (path: string) => void
  newSession: (workspaceId: string) => void
  sendMessage: (message: string) => void
}

/**
 * The whole client-side view of the agent: the workspace tree, which session
 * is open, and the three things a person can ask the server to do. Server
 * events are folded into state here; components stay presentational.
 */
export function useAgentClient(): AgentClient {
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

  const workspace = findWorkspaceOfSession(workspaces, activeSessionId)
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

  return {
    workspaces,
    workspace,
    session,
    activeSessionId,
    status,
    connected: status === "open",
    error,
    selectSession: setActiveSessionId,
    dismissError: () => setError(null),
    addWorkspace,
    newSession,
    sendMessage
  }
}
