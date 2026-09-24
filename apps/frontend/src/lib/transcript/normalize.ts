import type { AssistantBlock, Message, Workspace } from "commons/types"
import type { UIMessage, UIWorkspace } from "./types"

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
      agentId: s.agentId,
      name: s.name ?? null,
      messages: (s.messages ?? []).map(normalizeMessage)
    }))
  }))
}
