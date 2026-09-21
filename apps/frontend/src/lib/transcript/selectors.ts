import type { UISession, UIWorkspace } from "./types"

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

export function findWorkspaceOfSession(
  workspaces: UIWorkspace[],
  sessionId: string | null
): UIWorkspace | undefined {
  if (!sessionId) {
    return undefined
  }
  return workspaces.find(w => w.sessions.some(s => s.id === sessionId))
}
