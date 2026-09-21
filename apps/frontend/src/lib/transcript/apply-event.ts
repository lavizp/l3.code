import type { OutgoingMessageType, ToolBlock } from "commons/types"
import { isLocalId, liveId } from "./ids"
import { normalizeWorkspaces } from "./normalize"
import type { UIWorkspace } from "./types"
import { mapBlocks, mapLiveTurn, mapSession } from "./update"

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
      return workspaces.map((w, i) => (i === pending ? { ...w, id, name, path } : w))
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
          m => m.role === "user" && isLocalId(m.id) && m.text === message
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
          return [{ ...m, id: id ?? `${live}:${Date.now()}`, running: false, error }]
        })
      }))
    }

    default:
      return workspaces
  }
}
