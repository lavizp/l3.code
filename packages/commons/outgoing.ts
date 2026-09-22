import z from "zod"

export const WorkspaceCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string()
})
export type WorkspaceCreatedSchemaype = z.infer<typeof WorkspaceCreatedSchema>

export const SessionCreated = z.object({
  id: z.string(),
  workspaceId: z.string(),
  agentId: z.string()
})
export type SessionCreatedType = z.infer<typeof SessionCreated>

export const MessageAdded = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.literal("user"),
  message: z.string()
})
export type MessageAddedType = z.infer<typeof MessageAdded>

/** One folder in a directory listing: somewhere to descend into, or to pick. */
export type DirectoryEntry = {
  name: string
  path: string
}

/**
 * One level of the server's filesystem, for the folder picker. A browser
 * never reveals an absolute path — a folder input only exposes names
 * relative to whatever was chosen — and an absolute path is exactly what an
 * agent needs for its working directory, so the walking happens server-side.
 */
export type DirectoryListing = {
  /** The absolute path that was listed, resolved. */
  path: string
  /** One level up, or null when there is nowhere further to go. */
  parent: string | null
  /** Sub-directories only. The picker chooses folders, not files. */
  entries: DirectoryEntry[]
}

/**
 * Where a folder chosen in the browser's own dialog actually lives.
 *
 * The dialog gives a name and the folder's contents but no path, so the
 * server finds it again by looking for that name with those contents. More
 * than one path means two folders fit the description equally well and only
 * a person can say which; none means the search didn't reach it.
 */
export type FolderLocated = {
  name: string
  /** Absolute paths that fit, closest fit first. */
  candidates: string[]
  /** More fitted than are listed: the fingerprint wasn't discriminating. */
  truncated: boolean
}

/**
 * One renderable piece of an assistant turn. A turn is an ordered list of
 * these: prose the model wrote, interleaved with the tools it ran.
 */
export type TextBlock = {
  kind: "text"
  id: string
  text: string
}

export type ToolBlock = {
  kind: "tool"
  id: string
  toolUseId: string
  name: string
  input: unknown
  result?: string
  status: "running" | "done" | "error"
}

export type AssistantBlock = TextBlock | ToolBlock

export type TurnStatus = "done" | "error" | "cancelled"

export type OutgoingMessageType =
  | {
      type: 'workspace-created'
      payload: WorkspaceCreatedSchemaype
    }
  | {
      type: 'session-created'
      payload: SessionCreatedType
    }
  | {
      type: 'message-added'
      payload: MessageAddedType
    }
  | {
      type: 'init'
      workspaces: Workspace[]
      /** The agents to choose between when starting a session. */
      agents: AgentSummary[]
  }
  /** The agent picked up the turn. The client opens a live assistant message. */
  | {
      type: 'turn-started'
      payload: { sessionId: string }
    }
  /** A new prose block opened in the live turn. */
  | {
      type: 'block-start'
      payload: { sessionId: string; blockId: string; text: string }
    }
  /** Incremental text for an open prose block. */
  | {
      type: 'block-delta'
      payload: { sessionId: string; blockId: string; text: string }
    }
  /** The model invoked a tool. Rendered immediately, before the result exists. */
  | {
      type: 'tool-start'
      payload: {
        sessionId: string
        blockId: string
        toolUseId: string
        name: string
        input: unknown
      }
    }
  /** The tool returned. Resolves the matching tool-start. */
  | {
      type: 'tool-end'
      payload: {
        sessionId: string
        toolUseId: string
        result: string
        isError: boolean
      }
    }
  /** The turn finished. `id` is the persisted message id for the whole turn. */
  | {
      type: 'turn-ended'
      payload: {
        sessionId: string
        id: string | null
        status: TurnStatus
        error?: string
      }
    }
  /** Answer to `locate-folder`: where the chosen folder turned out to be. */
  | {
      type: 'folder-located'
      payload: FolderLocated
    }
  /** Answer to `list-directory`, for the folder picker. */
  | {
      type: 'directory-listed'
      payload: DirectoryListing
    }
  | {
      type: 'error'
      payload: { sessionId?: string; message: string }
    }

export type Workspace = {
  id: string,
  name: string,
  path: string,
  sessions: Session[]
}

export type Session = {
  id: string,
  /** The agent that runs this session's turns. Fixed when it was created. */
  agentId: string,
  messages: Message[]
}

/** One agent a client may choose between. */
export type AgentSummary = {
  id: string
  label: string
}

export type Message = {
  id: string;
  role: "user",
  payload: {
    message: string
  }
} | {
  id: string;
  role: "assistant",
  payload: AssistantPayload
}

/**
 * What we persist for an assistant turn. `blocks` is the current shape;
 * the `result` shape predates streaming and is still read back from Mongo.
 */
export type AssistantPayload =
  | { type: "blocks"; blocks: AssistantBlock[] }
  | { type: "result"; text: string }
  | Record<string, unknown>
