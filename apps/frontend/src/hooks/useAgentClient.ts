import { useCallback, useRef, useState } from "react"
import {
  failure,
  type AgentSummary,
  type DirectoryListing,
  type Failure,
  type OutgoingMessageType
} from "commons/types"
import { SERVER_URL } from "../config"
import {
  appendLocalMessage,
  applyEvent,
  endLiveTurns,
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
  /** Failed reconnection attempts since the last time we were connected. */
  attempts: number
  /** When the next automatic reconnect fires, while waiting for it. */
  retryAt: number | null
  /** False before the first successful connect: the server may not be up. */
  everConnected: boolean
  /** The most recent thing that went wrong, until it's dismissed. */
  error: Failure | null
  /** The agents a new session can be started with. */
  agents: AgentSummary[]
  /** The folder the picker is currently showing, once one has been asked for. */
  directory: DirectoryListing | null
  /** A listing is in flight. */
  directoryLoading: boolean
  /** Whether there is a message to send again after a failure. */
  canRetry: boolean
  selectSession: (id: string | null) => void
  dismissError: () => void
  /** Try the socket again now rather than waiting out the backoff. */
  reconnect: () => void
  /** Send the last message again, for a turn that failed for a passing reason. */
  retry: () => void
  browseDirectory: (path?: string) => void
  addWorkspace: (path: string) => void
  newSession: (workspaceId: string, agentId: string) => void
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
  const [error, setError] = useState<Failure | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [directory, setDirectory] = useState<DirectoryListing | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)

  // What to send again if the turn failed for a reason that might pass. Kept
  // in a ref because it isn't drawn — only `canRetry` is. `delivered` says
  // whether the server ever saw it, which decides whether re-sending needs
  // to draw the message again or reuses the copy already on screen.
  const lastSent = useRef<{
    sessionId: string
    message: string
    delivered: boolean
  } | null>(null)
  const [canRetry, setCanRetry] = useState(false)

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
    if (event.type === "directory-listed") {
      setDirectory(event.payload)
      setDirectoryLoading(false)
    }
    if (event.type === "error") {
      setError(event.payload.error)
      // An unreadable folder answers with an error and no listing, so the
      // picker would otherwise sit on "Reading…" for good.
      setDirectoryLoading(false)
    }
    if (event.type === "turn-ended") {
      const failed = event.payload.error
      // The transcript keeps the reason next to the reply it explains; the
      // banner is what offers to do something about it, and what stays
      // visible after scrolling away. An interruption is the exception:
      // `onDropped` has already said the connection went, and saying it
      // twice for the same event helps nobody.
      if (failed && failed.kind !== "interrupted") {
        setError(failed)
        setCanRetry(
          failed.retryable && lastSent.current?.sessionId === event.payload.sessionId
        )
      }
    }
  }, [])

  const onDropped = useCallback(() => {
    // The socket went away mid-turn. Nothing else will ever close those
    // turns, so close them here.
    setWorkspaces(prev => endLiveTurns(prev, Date.now()))
    setDirectoryLoading(false)
    setError(
      failure("connection", "Lost the connection to the agent server. Reconnecting…")
    )
    setCanRetry(lastSent.current !== null)
  }, [])

  const socket = useSocket(SERVER_URL, { onEvent, onDropped })
  const { send } = socket

  const workspace = findWorkspaceOfSession(workspaces, activeSessionId)
  const session = workspace?.sessions.find(s => s.id === activeSessionId)

  function offline(what: string): void {
    setError(
      failure(
        "connection",
        socket.everConnected
          ? `Not connected — ${what}`
          : `Can't reach the agent server — ${what} Check that the backend is running.`
      )
    )
  }

  function browseDirectory(path?: string) {
    setDirectoryLoading(true)
    if (!send({ type: "list-directory", payload: { path } })) {
      setDirectoryLoading(false)
      offline("couldn't read that folder.")
    }
  }

  function addWorkspace(path: string) {
    const name = path.split("/").filter(Boolean).pop() ?? path
    if (!send({ type: "create-workspace", payload: { path } })) {
      offline("that folder wasn't added.")
      return
    }
    // Show the row immediately; the server fills in the id.
    setWorkspaces(prev => [...prev, { id: null, name, path, sessions: [] }])
  }

  function newSession(workspaceId: string, agentId: string) {
    if (!send({ type: "create-session", payload: { workspaceId, agentId } })) {
      offline("the session wasn't started.")
    }
  }

  function deliver(sessionId: string, message: string): boolean {
    const sent = send({ type: "add-message", payload: { sessionId, message } })
    lastSent.current = { sessionId, message, delivered: sent }
    if (!sent) {
      offline("your message wasn't sent.")
      setCanRetry(true)
      return false
    }
    setCanRetry(false)
    setError(null)
    return true
  }

  function sendMessage(message: string) {
    if (!session) {
      return
    }
    const sessionId = session.id
    deliver(sessionId, message)
    // Paint it straight away, sent or not: an unsent message still belongs on
    // screen, greyed by the banner above it, so retrying has something to
    // point at. The server's echo reconciles onto this copy.
    setWorkspaces(prev => appendLocalMessage(prev, sessionId, localId(), message))
  }

  /**
   * Send the last message again.
   *
   * A message the server never received still has its unconfirmed copy on
   * screen, and the echo will reconcile onto that one. A message that did
   * arrive and then failed mid-turn is already saved under a real id, so
   * sending it again is a second ask — drawn as a second message, because
   * that is what the transcript will say when it's reloaded.
   */
  function retry() {
    const pending = lastSent.current
    if (!pending) {
      return
    }
    const askedAgain = pending.delivered
    if (!deliver(pending.sessionId, pending.message) || !askedAgain) {
      return
    }
    setWorkspaces(prev =>
      appendLocalMessage(prev, pending.sessionId, localId(), pending.message)
    )
  }

  return {
    workspaces,
    workspace,
    session,
    activeSessionId,
    status: socket.status,
    connected: socket.status === "open",
    attempts: socket.attempts,
    retryAt: socket.retryAt,
    everConnected: socket.everConnected,
    error,
    agents,
    directory,
    directoryLoading,
    canRetry,
    selectSession: setActiveSessionId,
    dismissError: () => setError(null),
    reconnect: socket.reconnect,
    retry,
    browseDirectory,
    addWorkspace,
    newSession,
    sendMessage
  }
}
