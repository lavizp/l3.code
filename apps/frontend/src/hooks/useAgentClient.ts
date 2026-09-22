import { useCallback, useRef, useState } from "react"
import type {
  AgentSummary,
  DirectoryListing,
  FolderLocated,
  IncommingMessageType,
  OutgoingMessageType
} from "commons/types"
import { SERVER_URL } from "../config"
import { pickFolder } from "../lib/folder"
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
  /**
   * Where the folder chosen in the OS dialog turned out to be, when it took
   * more than one answer — or none. A single match is just added.
   */
  located: FolderLocated | null
  /** The server is working out where the chosen folder lives. */
  locating: boolean
  selectSession: (id: string | null) => void
  dismissError: () => void
  browseDirectory: (path?: string) => void
  /** Open the operating system's folder dialog and add what comes back. */
  chooseFolder: () => Promise<void>
  dismissLocated: () => void
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
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [directory, setDirectory] = useState<DirectoryListing | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [located, setLocated] = useState<FolderLocated | null>(null)
  const [locating, setLocating] = useState(false)
  // `send` only exists after useSocket, which needs the handler first. The
  // handler answers a folder search by creating a workspace, so it reaches
  // the socket through here rather than the other way round.
  const sendRef = useRef<(message: IncommingMessageType) => boolean>(() => false)

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
    if (event.type === "folder-located") {
      setLocating(false)
      const [only, ...rest] = event.payload.candidates
      // One answer needs no question asked.
      if (only && rest.length === 0) {
        setWorkspaces(prev => [...prev, { id: null, name: baseName(only), path: only, sessions: [] }])
        sendRef.current({ type: "create-workspace", payload: { path: only } })
      } else {
        setLocated(event.payload)
      }
    }
    if (event.type === "error") {
      setError(event.payload.message)
      setLocating(false)
      // An unreadable folder answers with an error and no listing, so the
      // picker would otherwise sit on "Reading…" for good.
      setDirectoryLoading(false)
    }
    if (event.type === "turn-ended" && event.payload.status === "error") {
      setError(event.payload.error ?? "The agent stopped before finishing.")
    }
  }, [])

  const { status, send } = useSocket(SERVER_URL, onEvent)
  sendRef.current = send

  const workspace = findWorkspaceOfSession(workspaces, activeSessionId)
  const session = workspace?.sessions.find(s => s.id === activeSessionId)

  function browseDirectory(path?: string) {
    setDirectoryLoading(true)
    if (!send({ type: "list-directory", payload: { path } })) {
      setDirectoryLoading(false)
      setError("Not connected — couldn't read that folder.")
    }
  }

  async function chooseFolder() {
    const picked = await pickFolder()
    if (!picked) {
      return
    }
    setLocated(null)
    setLocating(true)
    if (!send({ type: "locate-folder", payload: picked })) {
      setLocating(false)
      setError("Not connected — couldn't look that folder up.")
    }
  }

  function addWorkspace(path: string) {
    const name = baseName(path)
    // Show the row immediately; the server fills in the id.
    setWorkspaces(prev => [...prev, { id: null, name, path, sessions: [] }])
    send({ type: "create-workspace", payload: { path } })
  }

  function newSession(workspaceId: string, agentId: string) {
    send({ type: "create-session", payload: { workspaceId, agentId } })
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
    located,
    locating,
    selectSession: setActiveSessionId,
    dismissError: () => setError(null),
    browseDirectory,
    chooseFolder,
    dismissLocated: () => setLocated(null),
    addWorkspace,
    newSession,
    sendMessage
  }
}

/** The trailing segment of a path, which is what a workspace is called. */
function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path
}
