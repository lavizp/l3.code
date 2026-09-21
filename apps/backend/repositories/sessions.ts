import { SessionModel } from "db/client"
import type { AssistantBlock } from "commons/types"
import mongoose from "mongoose"

export type StoredSession = {
  id: string
  workspaceId: string | undefined
  /**
   * The agent provider's own conversation id, used to resume. Persisted under
   * the legacy `anthropicSessionId` field so existing rows keep working.
   */
  agentSessionId: string | undefined
}

export async function createSession(workspaceId: string): Promise<StoredSession> {
  const session = await SessionModel.create({
    workspace: new mongoose.Types.ObjectId(workspaceId),
    conversation: []
  })
  return { id: session._id.toString(), workspaceId, agentSessionId: undefined }
}

/**
 * Append the user's message to a session and hand back both the session and
 * the id the message was stored under. Null when there is no such session.
 */
export async function appendUserMessage(
  sessionId: string,
  message: string
): Promise<{ session: StoredSession; messageId: string } | null> {
  const session = await SessionModel.findByIdAndUpdate(
    sessionId,
    { $push: { conversation: { role: "user", payload: { message } } } },
    { new: true }
  )
  if (!session) {
    return null
  }
  const stored = session.conversation[session.conversation.length - 1]!
  return {
    session: {
      id: session._id.toString(),
      workspaceId: session.workspace?.toString(),
      agentSessionId: session.anthropicSessionId ?? undefined
    },
    messageId: stored._id.toString()
  }
}

/** Store a finished assistant turn. Returns the id it was stored under. */
export async function appendAssistantBlocks(
  sessionId: string,
  blocks: AssistantBlock[]
): Promise<string | null> {
  const updated = await SessionModel.findByIdAndUpdate(
    sessionId,
    { $push: { conversation: { role: "assistant", payload: { type: "blocks", blocks } } } },
    { new: true }
  )
  const saved = updated?.conversation[updated.conversation.length - 1]
  return saved?._id.toString() ?? null
}

/** Remember the provider's conversation id so the next turn can resume it. */
export async function saveAgentSessionId(
  sessionId: string,
  agentSessionId: string
): Promise<void> {
  await SessionModel.updateOne(
    { _id: sessionId },
    { $set: { anthropicSessionId: agentSessionId } }
  )
}
