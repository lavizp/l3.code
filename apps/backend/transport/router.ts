import {
  AddMessageSchema,
  CreateSessionSchema,
  CreateWorkspaceSchema,
  DeleteSessionSchema,
  ListDirectorySchema,
  RenameSessionSchema,
  type IncommingMessageType
} from "commons/types"
import { getAgent } from "../agents"
import {
  createSession,
  deleteSession,
  renameSession
} from "../repositories/sessions"
import { createWorkspace } from "../repositories/workspaces"
import { listDirectory } from "../services/directory"
import { runTurn } from "../services/turn-runner"
import type { Connection } from "./connection"

type Handler = (connection: Connection, payload: unknown) => Promise<void>

/**
 * One entry per incoming message type. Each handler validates its own payload
 * and answers on the same connection; anything it throws is reported back to
 * the client as an error by the caller.
 */
const HANDLERS: Record<IncommingMessageType["type"], Handler> = {
  "create-workspace": async (connection, payload) => {
    const { success, data } = CreateWorkspaceSchema.safeParse(payload)
    if (!success) {
      throw new Error("Incorrect Schema")
    }
    const workspace = await createWorkspace(data.path)
    connection.send({ type: "workspace-created", payload: workspace })
  },

  "list-directory": async (connection, payload) => {
    // No payload at all is a fair way to ask for the default starting point.
    const { success, data } = ListDirectorySchema.safeParse(payload ?? {})
    if (!success) {
      throw new Error("Incorrect Schema")
    }
    connection.send({
      type: "directory-listed",
      payload: await listDirectory(data.path)
    })
  },

  "create-session": async (connection, payload) => {
    const { success, data } = CreateSessionSchema.safeParse(payload)
    if (!success) {
      throw new Error("Incorrect Schema")
    }
    // Resolve the agent before writing anything, so an id the client made
    // up fails the request instead of creating a session nothing can run.
    // This is the only point at which a session's agent is decided.
    const agent = getAgent(data.agentId)
    const session = await createSession(data.workspaceId, agent.id)
    connection.send({
      type: "session-created",
      payload: { id: session.id, workspaceId: data.workspaceId, agentId: agent.id }
    })
  },

  "rename-session": async (connection, payload) => {
    const { success, data } = RenameSessionSchema.safeParse(payload)
    if (!success) {
      throw new Error("Incorrect Schema")
    }
    const renamed = await renameSession(data.sessionId, data.name)
    if (!renamed) {
      throw new Error("Session Not found")
    }
    connection.send({
      type: "session-renamed",
      payload: { id: data.sessionId, name: renamed.name }
    })
  },

  "delete-session": async (connection, payload) => {
    const { success, data } = DeleteSessionSchema.safeParse(payload)
    if (!success) {
      throw new Error("Incorrect Schema")
    }
    // A session already gone is the outcome that was asked for, so tell the
    // client it's gone either way rather than failing on the second try.
    await deleteSession(data.sessionId)
    connection.send({ type: "session-deleted", payload: { id: data.sessionId } })
  },

  "add-message": async (connection, payload) => {
    const { success, data } = AddMessageSchema.safeParse(payload)
    if (!success) {
      throw new Error("Incorrect Schema")
    }
    await runTurn({
      sessionId: data.sessionId,
      message: data.message,
      emit: event => connection.send(event)
    })
  }
}

export async function routeMessage(
  connection: Connection,
  msg: IncommingMessageType
): Promise<void> {
  const handle = HANDLERS[msg?.type]
  if (!handle) {
    throw new Error("Incomming Message Flawed")
  }
  await handle(connection, msg.payload)
}
