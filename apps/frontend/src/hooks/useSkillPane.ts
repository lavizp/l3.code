import { useCallback, useEffect, useState } from "react"
import {
  failure,
  type DirectoryListing,
  type Failure,
  type OutgoingMessageType,
  type ProviderSummary,
  type Skill,
  type SkillDestination,
  type SkillProblem,
  type SkillScope,
  type SkillSource,
  type Workspace
} from "commons/types"
import { SERVER_URL } from "../config"
import { useSocket, type ConnectionStatus } from "./useSocket"

export type SkillPane = {
  workspaces: Workspace[]
  /** The project in view, or null for the skills that follow you around. */
  workspaceId: string | null
  workspace: Workspace | undefined
  providers: ProviderSummary[]
  skills: Skill[]
  problems: SkillProblem[]
  destinations: SkillDestination[]
  /** The skill open in the editor, and the file behind it. */
  selected: Skill | undefined
  source: SkillSource | null
  /** A listing or a read is in flight. */
  loading: boolean
  saving: boolean
  status: ConnectionStatus
  connected: boolean
  attempts: number
  retryAt: number | null
  everConnected: boolean
  error: Failure | null
  directory: DirectoryListing | null
  directoryLoading: boolean
  selectWorkspace: (id: string | null) => void
  selectSkill: (path: string | null) => void
  addWorkspace: (path: string) => void
  browseDirectory: (path?: string) => void
  createSkill: (input: {
    scope: SkillScope
    /** `"shared"`, or the id of the one agent this skill is for. */
    target: string
    name: string
    description: string
  }) => void
  saveSkill: (raw: string) => void
  deleteSkill: (path: string) => void
  refresh: () => void
  dismissError: () => void
  reconnect: () => void
}

/**
 * The whole client-side view of the pane: which project is in view, what
 * skills the agents can see in it, and which one is open.
 *
 * Every write settles by re-listing rather than by patching state locally.
 * A save is not finished when the file is written — it's finished when the
 * agents can see it, and that answer comes from walking their directories
 * again. Guessing at it here would show a skill as reaching Codex before
 * anything had checked that it does.
 */
export function useSkillPane(): SkillPane {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [problems, setProblems] = useState<SkillProblem[]>([])
  const [destinations, setDestinations] = useState<SkillDestination[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [source, setSource] = useState<SkillSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Failure | null>(null)
  const [directory, setDirectory] = useState<DirectoryListing | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)

  const onEvent = useCallback((event: OutgoingMessageType) => {
    switch (event.type) {
      case "init":
        setWorkspaces(event.workspaces)
        setProviders(event.providers)
        break

      case "workspace-created":
        setWorkspaces(prev => [
          // The optimistic row has no id yet; the real one replaces it.
          ...prev.filter(w => w.path !== event.payload.path),
          event.payload
        ])
        setWorkspaceId(event.payload.id)
        break

      case "directory-listed":
        setDirectory(event.payload)
        setDirectoryLoading(false)
        break

      case "skills-listed":
        setSkills(event.payload.skills)
        setProblems(event.payload.problems)
        setDestinations(event.payload.destinations)
        setLoading(false)
        setSaving(false)
        break

      case "skill-read":
        setSource(event.payload)
        setSelectedPath(event.payload.path)
        setLoading(false)
        break

      case "skill-saved":
        setSource(event.payload.source)
        setSelectedPath(event.payload.source.path)
        setSaving(false)
        setError(null)
        break

      case "skill-deleted":
        setSelectedPath(current => (current === event.payload.path ? null : current))
        setSource(current => (current?.path === event.payload.path ? null : current))
        break

      case "error":
        setError(event.payload.error)
        // Anything that was in flight has been answered with this instead,
        // so nothing is still coming and every spinner should stop.
        setLoading(false)
        setSaving(false)
        setDirectoryLoading(false)
        break
    }
  }, [])

  const onDropped = useCallback(() => {
    setLoading(false)
    setSaving(false)
    setDirectoryLoading(false)
    setError(
      failure("connection", "Lost the connection to the skill server. Reconnecting…")
    )
  }, [])

  const socket = useSocket(SERVER_URL, { onEvent, onDropped })
  const { send } = socket
  const connected = socket.status === "open"

  function offline(what: string): void {
    setError(
      failure(
        "connection",
        socket.everConnected
          ? `Not connected — ${what}`
          : `Can't reach the skill server — ${what} Check that the backend is running.`
      )
    )
  }

  const list = useCallback(
    (id: string | null) => {
      setLoading(true)
      if (!send({ type: "list-skills", payload: { workspaceId: id ?? undefined } })) {
        setLoading(false)
        offline("the skill list couldn't be loaded.")
      }
    },
    [send, socket.everConnected]
  )

  // Re-list whenever the project in view changes, and again on reconnect:
  // skills are files, and files change while this app isn't looking.
  useEffect(() => {
    if (connected) {
      list(workspaceId)
    }
  }, [connected, workspaceId, list])

  function selectWorkspace(id: string | null) {
    setWorkspaceId(id)
    // The open skill may not exist in the new project; the listing decides.
    setSelectedPath(null)
    setSource(null)
  }

  function selectSkill(path: string | null) {
    setSelectedPath(path)
    if (!path) {
      setSource(null)
      return
    }
    setSource(null)
    setLoading(true)
    if (!send({ type: "read-skill", payload: { path } })) {
      setLoading(false)
      offline("that skill couldn't be opened.")
    }
  }

  function addWorkspace(path: string) {
    if (!send({ type: "create-workspace", payload: { path } })) {
      offline("that folder wasn't added.")
      return
    }
    const name = path.split("/").filter(Boolean).pop() ?? path
    // Show the row immediately; the server fills in the id.
    setWorkspaces(prev => [...prev, { id: "", name, path }])
  }

  function browseDirectory(path?: string) {
    setDirectoryLoading(true)
    if (!send({ type: "list-directory", payload: { path } })) {
      setDirectoryLoading(false)
      offline("couldn't read that folder.")
    }
  }

  function createSkill(input: {
    scope: SkillScope
    target: string
    name: string
    description: string
  }) {
    setSaving(true)
    const sent = send({
      type: "create-skill",
      payload: {
        scope: input.scope,
        target: input.target,
        name: input.name,
        description: input.description,
        workspaceId: input.scope === "project" ? (workspaceId ?? undefined) : undefined
      }
    })
    if (!sent) {
      setSaving(false)
      offline("the skill wasn't created.")
    }
  }

  function saveSkill(raw: string) {
    if (!selectedPath) {
      return
    }
    setSaving(true)
    const sent = send({
      type: "update-skill",
      payload: { path: selectedPath, raw, workspaceId: workspaceId ?? undefined }
    })
    if (!sent) {
      setSaving(false)
      offline("your changes weren't saved.")
    }
  }

  function deleteSkill(path: string) {
    // The server answers the delete with a fresh listing, so nothing is
    // removed here; the list settles on what is actually on disk.
    const sent = send({
      type: "delete-skill",
      payload: { path, workspaceId: workspaceId ?? undefined }
    })
    if (!sent) {
      offline("that skill wasn't deleted.")
    }
  }

  const workspace = workspaces.find(w => w.id === workspaceId)

  // A project view is about the project. The server lists everything each
  // agent can see from inside it — personal skills, plugins, the agents' own
  // — which is the honest answer to "what will the agent read here", but
  // buries the handful that belong to the repo under dozens that don't. Those
  // are one click away under Personal, so here only the repo's own are shown,
  // and new skills are written into the repo.
  const inProject = workspaceId !== null
  const shownSkills = inProject ? skills.filter(s => s.scope === "project") : skills
  const shownProblems =
    inProject && workspace
      ? problems.filter(p => isInside(workspace.path, p.path))
      : problems
  const shownDestinations = inProject
    ? destinations.filter(d => d.scope === "project")
    : destinations

  return {
    workspaces,
    workspaceId,
    workspace,
    providers,
    skills: shownSkills,
    problems: shownProblems,
    destinations: shownDestinations,
    selected: shownSkills.find(s => s.id === selectedPath),
    source,
    loading,
    saving,
    status: socket.status,
    connected,
    attempts: socket.attempts,
    retryAt: socket.retryAt,
    everConnected: socket.everConnected,
    error,
    directory,
    directoryLoading,
    selectWorkspace,
    selectSkill,
    addWorkspace,
    browseDirectory,
    createSkill,
    saveSkill,
    deleteSkill,
    refresh: () => list(workspaceId),
    dismissError: () => setError(null),
    reconnect: socket.reconnect
  }
}

/** Whether `path` sits inside the folder `root`, not merely shares its prefix. */
function isInside(root: string, path: string): boolean {
  const base = root.endsWith("/") ? root : `${root}/`
  return path.startsWith(base)
}
