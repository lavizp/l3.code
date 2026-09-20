import type {
  AssistantBlock,
  Message,
  OutgoingMessageType,
  ToolBlock,
  Workspace
} from "commons/types"

export type UIMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string
      role: "assistant"
      blocks: AssistantBlock[]
      running: boolean
      error?: string
    }

export type UISession = {
  id: string
  messages: UIMessage[]
}

/** `id` is null while a workspace we just created is awaiting its server id. */
export type UIWorkspace = {
  id: string | null
  name: string
  path: string
  sessions: UISession[]
}

/** Id of the in-flight assistant turn, swapped for the real one when it ends. */
export const liveId = (sessionId: string) => `live:${sessionId}`

/** Marks a message drawn locally that the server hasn't confirmed yet. */
const LOCAL_PREFIX = "local:"

export const localId = () =>
  `${LOCAL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Draw the user's own message the instant they press enter, rather than
 * waiting for the server to echo it back. The echo reconciles onto this.
 */
export function appendLocalMessage(
  workspaces: UIWorkspace[],
  sessionId: string,
  id: string,
  text: string
): UIWorkspace[] {
  return mapSession(workspaces, sessionId, session => ({
    ...session,
    messages: [...session.messages, { id, role: "user", text }]
  }))
}

/** Read a persisted message back into renderable form. */
export function normalizeMessage(message: Message): UIMessage {
  if (message.role === "user") {
    return {
      id: message.id,
      role: "user",
      text: String(message.payload?.message ?? "")
    }
  }

  const payload = message.payload as Record<string, unknown> | undefined

  if (payload && Array.isArray(payload.blocks)) {
    return {
      id: message.id,
      role: "assistant",
      blocks: payload.blocks as AssistantBlock[],
      running: false
    }
  }

  // Turns saved before streaming existed stored only the final text.
  const text =
    typeof payload?.text === "string"
      ? payload.text
      : typeof payload?.message === "string"
        ? payload.message
        : ""

  return {
    id: message.id,
    role: "assistant",
    blocks: text ? [{ kind: "text", id: `${message.id}:0`, text }] : [],
    running: false
  }
}

export function normalizeWorkspaces(workspaces: Workspace[]): UIWorkspace[] {
  return workspaces.map(w => ({
    id: w.id,
    name: w.name,
    path: w.path,
    sessions: (w.sessions ?? []).map(s => ({
      id: s.id,
      messages: (s.messages ?? []).map(normalizeMessage)
    }))
  }))
}

/** A session's label: what the person first asked, falling back to a stub. */
export function sessionTitle(session: UISession): string {
  const firstUser = session.messages.find(m => m.role === "user")
  if (firstUser && firstUser.role === "user" && firstUser.text.trim()) {
    return firstUser.text.trim().split("\n")[0]!
  }
  return "New session"
}

export function isRunning(session: UISession | undefined): boolean {
  return session?.messages.some(m => m.role === "assistant" && m.running) ?? false
}

function mapSession(
  workspaces: UIWorkspace[],
  sessionId: string,
  update: (session: UISession) => UISession
): UIWorkspace[] {
  return workspaces.map(w => {
    if (!w.sessions.some(s => s.id === sessionId)) {
      return w
    }
    return {
      ...w,
      sessions: w.sessions.map(s => (s.id === sessionId ? update(s) : s))
    }
  })
}

/** Apply a change to the live assistant turn of a session. */
function mapLiveTurn(
  workspaces: UIWorkspace[],
  sessionId: string,
  update: (message: Extract<UIMessage, { role: "assistant" }>) => UIMessage
): UIWorkspace[] {
  const id = liveId(sessionId)
  return mapSession(workspaces, sessionId, session => ({
    ...session,
    messages: session.messages.map(m =>
      m.id === id && m.role === "assistant" ? update(m) : m
    )
  }))
}

function mapBlocks(
  message: Extract<UIMessage, { role: "assistant" }>,
  update: (blocks: AssistantBlock[]) => AssistantBlock[]
): UIMessage {
  return { ...message, blocks: update(message.blocks) }
}

/**
 * Fold one server event into the workspace tree. Pure, so React state stays
 * predictable and every event is addressed by session id rather than by
 * whatever happens to be on screen.
 */
export function applyEvent(
  workspaces: UIWorkspace[],
  event: OutgoingMessageType
): UIWorkspace[] {
  switch (event.type) {
    case "init":
      return normalizeWorkspaces(event.workspaces)

    case "workspace-created": {
      const { id, name, path } = event.payload
      if (workspaces.some(w => w.id === id)) {
        return workspaces
      }
      // Resolve the optimistic row we added for this exact path.
      const pending = workspaces.findIndex(w => w.id === null && w.path === path)
      if (pending === -1) {
        return [...workspaces, { id, name, path, sessions: [] }]
      }
      return workspaces.map((w, i) =>
        i === pending ? { ...w, id, name, path } : w
      )
    }

    case "session-created": {
      const { id, workspaceId } = event.payload
      return workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, sessions: [...w.sessions, { id, messages: [] }] }
          : w
      )
    }

    case "message-added": {
      const { id, sessionId, message } = event.payload
      return mapSession(workspaces, sessionId, session => {
        if (session.messages.some(m => m.id === id)) {
          return session
        }
        // Adopt the id onto the copy we already drew locally, so the echo
        // confirms that message instead of duplicating it.
        const pending = session.messages.findIndex(
          m => m.role === "user" && m.id.startsWith(LOCAL_PREFIX) && m.text === message
        )
        if (pending !== -1) {
          return {
            ...session,
            messages: session.messages.map((m, i) => (i === pending ? { ...m, id } : m))
          }
        }
        return {
          ...session,
          messages: [...session.messages, { id, role: "user", text: message }]
        }
      })
    }

    case "turn-started": {
      const { sessionId } = event.payload
      const id = liveId(sessionId)
      return mapSession(workspaces, sessionId, session =>
        session.messages.some(m => m.id === id)
          ? session
          : {
              ...session,
              messages: [
                ...session.messages,
                { id, role: "assistant", blocks: [], running: true }
              ]
            }
      )
    }

    case "block-start": {
      const { sessionId, blockId, text } = event.payload
      return mapLiveTurn(workspaces, sessionId, message =>
        mapBlocks(message, blocks =>
          blocks.some(b => b.id === blockId)
            ? blocks
            : [...blocks, { kind: "text", id: blockId, text }]
        )
      )
    }

    case "block-delta": {
      const { sessionId, blockId, text } = event.payload
      return mapLiveTurn(workspaces, sessionId, message =>
        mapBlocks(message, blocks => {
          if (!blocks.some(b => b.id === blockId)) {
            return [...blocks, { kind: "text", id: blockId, text }]
          }
          return blocks.map(b =>
            b.id === blockId && b.kind === "text" ? { ...b, text: b.text + text } : b
          )
        })
      )
    }

    case "tool-start": {
      const { sessionId, blockId, toolUseId, name, input } = event.payload
      return mapLiveTurn(workspaces, sessionId, message =>
        mapBlocks(message, blocks =>
          blocks.some(b => b.id === blockId)
            ? blocks
            : [
                ...blocks,
                {
                  kind: "tool",
                  id: blockId,
                  toolUseId,
                  name,
                  input,
                  status: "running"
                } satisfies ToolBlock
              ]
        )
      )
    }

    case "tool-end": {
      const { sessionId, toolUseId, result, isError } = event.payload
      return mapLiveTurn(workspaces, sessionId, message =>
        mapBlocks(message, blocks =>
          blocks.map(b =>
            b.kind === "tool" && b.toolUseId === toolUseId
              ? { ...b, result, status: isError ? "error" : "done" }
              : b
          )
        )
      )
    }

    case "turn-ended": {
      const { sessionId, id, status, error } = event.payload
      const live = liveId(sessionId)
      return mapSession(workspaces, sessionId, session => ({
        ...session,
        messages: session.messages.flatMap(m => {
          if (m.id !== live || m.role !== "assistant") {
            return [m]
          }
          // An empty turn that didn't fail has nothing to show.
          if (m.blocks.length === 0 && status !== "error") {
            return []
          }
          // Always move off the live id, otherwise the next turn in this
          // session would collide with this one and never open.
          return [
            {
              ...m,
              id: id ?? `${live}:${Date.now()}`,
              running: false,
              error
            }
          ]
        })
      }))
    }

    default:
      return workspaces
  }
}
