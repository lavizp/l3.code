import { failure, type AssistantBlock } from "commons/types"
import { liveId } from "./ids"
import type { UIAssistantMessage, UIMessage, UISession, UIWorkspace } from "./types"

/**
 * Immutable helpers for reaching into the workspace tree. Everything that
 * changes state goes through one of these, so a change always addresses a
 * session by id rather than by whatever happens to be on screen.
 */

export function mapSession(
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
export function mapLiveTurn(
  workspaces: UIWorkspace[],
  sessionId: string,
  update: (message: UIAssistantMessage) => UIMessage
): UIWorkspace[] {
  const id = liveId(sessionId)
  return mapSession(workspaces, sessionId, session => ({
    ...session,
    messages: session.messages.map(m =>
      m.id === id && m.role === "assistant" ? update(m) : m
    )
  }))
}

export function mapBlocks(
  message: UIAssistantMessage,
  update: (blocks: AssistantBlock[]) => AssistantBlock[]
): UIMessage {
  return { ...message, blocks: update(message.blocks) }
}

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

/**
 * End every turn that was still streaming, because nothing more is coming.
 *
 * A live turn is only ever closed by a `turn-ended` from the server, so a
 * connection that drops mid-reply leaves one running forever: a blinking
 * caret over a half-written answer, a composer that stays disabled because
 * the session still looks busy, and — since a live turn owns the one live
 * id per session — no way for the next turn to open even once the socket is
 * back. Moving them off the live id is what makes the session usable again.
 */
export function endLiveTurns(workspaces: UIWorkspace[], at: number): UIWorkspace[] {
  let changed = false

  const next = workspaces.map(workspace => ({
    ...workspace,
    sessions: workspace.sessions.map(session => {
      if (!session.messages.some(m => m.role === "assistant" && m.running)) {
        return session
      }
      changed = true
      return {
        ...session,
        messages: session.messages.map(m =>
          m.role === "assistant" && m.running
            ? {
                ...m,
                id: `${m.id}:${at}`,
                running: false,
                notice: undefined,
                error: failure(
                  "interrupted",
                  "The connection dropped while the agent was working. Whatever it finished was saved — reconnect and ask again to pick it up."
                )
              }
            : m
        )
      }
    })
  }))

  // Leaving the array alone when nothing was running keeps React from
  // re-rendering every transcript on an idle reconnect.
  return changed ? next : workspaces
}
