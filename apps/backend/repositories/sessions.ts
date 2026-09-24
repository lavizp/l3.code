import { SessionModel } from "db/client"
import type { AssistantBlock } from "commons/types"
import mongoose from "mongoose"
import { config } from "../config"

/**
 * The agent whose resume id predates `agentSessions`. Rows written before
 * sessions could pick an agent kept it in its own field, so that's still
 * where we look for it.
 */
const LEGACY_AGENT_ID = "claude-code"

export type StoredSession = {
  id: string
  workspaceId: string | undefined
  /** The name the person gave it, or null when they haven't named it. */
  name: string | null
  /** Which agent provider runs this session's turns. */
  agentId: string
  /** That provider's own conversation id, when there is one to resume. */
  agentSessionId: string | undefined
}

type SessionDoc = InstanceType<typeof SessionModel>

export async function createSession(
  workspaceId: string,
  agentId: string
): Promise<StoredSession> {
  const session = await SessionModel.create({
    workspace: new mongoose.Types.ObjectId(workspaceId),
    agent: agentId,
    conversation: []
  })
  return {
    id: session._id.toString(),
    workspaceId,
    name: null,
    agentId,
    agentSessionId: undefined
  }
}

/**
 * Give a session a name, or clear it when the name is blank. Returns the
 * name as stored — null once cleared — or null-the-whole-result when there
 * is no such session, which the caller tells apart by the outer null.
 */
export async function renameSession(
  sessionId: string,
  name: string
): Promise<{ name: string | null } | null> {
  const trimmed = name.trim()
  const session = await SessionModel.findByIdAndUpdate(
    sessionId,
    trimmed ? { $set: { name: trimmed } } : { $unset: { name: "" } },
    { new: true }
  )
  if (!session) {
    return null
  }
  return { name: session.name ?? null }
}

/**
 * Drop a session and its whole conversation. The agent's own copy of the
 * conversation lives with the provider and is not ours to delete; all this
 * removes is our record of it, including the id that could resume it.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const { deletedCount } = await SessionModel.deleteOne({ _id: sessionId })
  return deletedCount > 0
}

/**
 * Append the user's message to a session and hand back both the session and
 * the id the message was stored under. Null when there is no such session.
 *
 * The session's agent is deliberately not touched: it is fixed at creation,
 * so a turn reads it rather than setting it.
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
  return { session: readSession(session), messageId: stored._id.toString() }
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

/**
 * Remember a provider's conversation id so its next turn can resume it. Kept
 * per agent, so a session that has talked to both can pick either back up.
 */
export async function saveAgentSessionId(
  sessionId: string,
  agentId: string,
  agentSessionId: string
): Promise<void> {
  await SessionModel.updateOne(
    { _id: sessionId },
    { $set: { [`agentSessions.${agentId}`]: agentSessionId } }
  )
}

/** Read a session document into the shape the rest of the server works with. */
function readSession(doc: SessionDoc): StoredSession {
  const agentId = doc.agent ?? config.defaultAgentId
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspace?.toString(),
    name: doc.name ?? null,
    agentId,
    agentSessionId: resumeIdFor(doc, agentId)
  }
}

function resumeIdFor(doc: SessionDoc, agentId: string): string | undefined {
  const stored = doc.agentSessions?.get(agentId)
  if (stored) {
    return stored
  }
  return agentId === LEGACY_AGENT_ID ? (doc.anthropicSessionId ?? undefined) : undefined
}
