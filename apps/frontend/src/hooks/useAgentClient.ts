import { useCallback, useState } from "react"
import type { AgentSummary, DirectoryListing, OutgoingMessageType } from "commons/types"
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
  /** The agents a new session can be started with. */
  agents: AgentSummary[]
  /** The folder the picker is currently showing, once one has been asked for. */
  directory: DirectoryListing | null
  /** A listing is in flight. */
  directoryLoading: boolean
  selectSession: (id: string | null) => void
  dismissError: () => void
  browseDirectory: (path?: string) => void
  addWorkspace: (path: string) => void
  newSession: (workspaceId: string, agentId: string) => void
  /** Name a session, or clear the name back to derived by passing "". */
  renameSession: (sessionId: string, name: string) => void
  deleteSession: (sessionId: string) => void
  sendMessage: (message: string) => void
}

/**
 * The whole client-side view of the agent: the workspace tree, which session
 * is open, and the things a person can ask the server to do. Server events
 * are folded into state here; components stay presentational.
 */
export function useAgentClient(): AgentClient {
  const [workspaces, setWorkspaces] = useState<UIWorkspace[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [directory, setDirectory] = useState<DirectoryListing | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)

  const onEvent = useCallback((event: OutgoingMessageType) => {
    setWorkspaces(prev => applyEvent(prev, event))

    if (event.type === "init") {
      // A server older than the agent choice sends no list, and a UI that
      // can't draw itself is a worse answer than one that can't start a
      // session until it reconnects.
      setAgents(event.agents ?? [])
    }
    if (event.type === "session-created") {
      setActiveSessionId(event.payload.id)
    }
    if (event.type === "session-deleted") {
      // Whatever was open is gone; fall back to the empty state rather than
      // leaving the main pane pointing at a session that no longer exists.
      const deleted = event.payload.id
      setActiveSessionId(current => (current === deleted ? null : current))
    }
    if (event.type === "directory-listed") {
      setDirectory(event.payload)
      setDirectoryLoading(false)
    }
    if (event.type === "error") {
      setError(event.payload.message)
      // An unreadable folder answers with an error and no listing, so the
      // picker would otherwise sit on "Reading…" for good.
      setDirectoryLoading(false)
    }
    if (event.type === "turn-ended" && event.payload.status === "error") {
      setError(event.payload.error ?? "The agent stopped before finishing.")
    }
  }, [])

  const { status, send } = useSocket(SERVER_URL, onEvent)

  const workspace = findWorkspaceOfSession(workspaces, activeSessionId)
  const session = workspace?.sessions.find(s => s.id === activeSessionId)

  function browseDirectory(path?: string) {
    setDirectoryLoading(true)
    if (!send({ type: "list-directory", payload: { path } })) {
      setDirectoryLoading(false)
      setError("Not connected — couldn't read that folder.")
    }
  }

  function addWorkspace(path: string) {
    const name = path.split("/").filter(Boolean).pop() ?? path
    // Show the row immediately; the server fills in the id.
    setWorkspaces(prev => [...prev, { id: null, name, path, sessions: [] }])
    send({ type: "create-workspace", payload: { path } })
  }

  function newSession(workspaceId: string, agentId: string) {
    send({ type: "create-session", payload: { workspaceId, agentId } })
  }

  function renameSession(sessionId: string, name: string) {
    if (!send({ type: "rename-session", payload: { sessionId, name } })) {
      setError("Not connected — the session wasn't renamed.")
    }
  }

  function deleteSession(sessionId: string) {
    if (!send({ type: "delete-session", payload: { sessionId } })) {
      setError("Not connected — the session wasn't deleted.")
    }
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
    agents,
    directory,
    directoryLoading,
    selectSession: setActiveSessionId,
    dismissError: () => setError(null),
    browseDirectory,
    addWorkspace,
    newSession,
    renameSession,
    deleteSession,
    sendMessage
  }
}
