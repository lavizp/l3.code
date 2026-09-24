import {
  AddMessageSchema,
  CreateSessionSchema,
  CreateWorkspaceSchema,
  DeleteSessionSchema,
  ListDirectorySchema,
  failure,
} from "commons/types"
import { fail, FailureError, toFailure } from "../errors"
import { databaseDown, databaseFailure, databaseReady } from "../repositories/failure"
  import {RenameSessionSchema,
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
 * Sessions with a turn already running, so a second `add-message` for the
 * same session is refused rather than run alongside the first. Two agents in
 * one working directory interleave their edits and their transcripts, and
 * the second one resumes from a conversation the first hasn't finished
 * writing.
 */
const running = new Set<string>()

/**
 * Enough of a schema to validate with. Structural rather than `ZodType` so
 * this stays off zod's dependency list: the schemas come from `commons`, and
 * nothing here builds one.
 */
type Validator<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | {
        success: false
        error: { issues: readonly { path: PropertyKey[]; message: string }[] }
      }
}

/** Parse a payload or refuse the request, saying which field was wrong. */
function parse<T>(schema: Validator<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const where = result.error.issues
      .map(issue => `${issue.path.join(".") || "payload"}: ${issue.message}`)
      .join("; ")
    fail("bad-request", "The server didn't understand that request.", {
      detail: where
    })
  }
  return result.data
}

/**
 * One entry per incoming message type. Each handler validates its own payload
 * and answers on the same connection; anything it throws is classified and
 * reported back to the client by `routeMessage`.
 */
const HANDLERS: Record<IncommingMessageType["type"], Handler> = {
  "create-workspace": async (connection, payload) => {
    const data = parse(CreateWorkspaceSchema, payload)
    const workspace = await createWorkspace(data.path).catch(cause => {
      throw new FailureError(databaseFailure(cause, "workspace"))
    })
    connection.send({ type: "workspace-created", payload: workspace })
  },

  "list-directory": async (connection, payload) => {
    // No payload at all is a fair way to ask for the default starting point.
    const data = parse(ListDirectorySchema, payload ?? {})
    connection.send({
      type: "directory-listed",
      payload: await listDirectory(data.path)
    })
  },

  "create-session": async (connection, payload) => {
    const data = parse(CreateSessionSchema, payload)
    // Resolve the agent before writing anything, so an id the client made
    // up fails the request instead of creating a session nothing can run.
    // This is the only point at which a session's agent is decided.
    const agent = agentOr400(data.agentId)
    const session = await createSession(data.workspaceId, agent.id).catch(cause => {
      throw new FailureError(databaseFailure(cause, "session"))
    })
    connection.send({
      type: "session-created",
      payload: {
        id: session.id,
        workspaceId: data.workspaceId,
        agentId: agent.id
      }
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
    const data = parse(AddMessageSchema, payload)

    if (running.has(data.sessionId)) {
      fail(
        "bad-request",
        "This session is already working on something. Wait for it to finish."
      )
    }

    running.add(data.sessionId)
    try {
      await runTurn({
        sessionId: data.sessionId,
        message: data.message,
        emit: event => connection.send(event),
        signal: connection.signal
      })
    } finally {
      running.delete(data.sessionId)
    }
  }
}

/**
 * Hand a message to its handler and make sure the client hears about it
 * either way. Nothing throws out of here: a websocket has no request/response
 * pairing, so an error that escapes is an error the client waits on forever.
 */
export async function routeMessage(
  connection: Connection,
  msg: IncommingMessageType
): Promise<void> {
  const handle = HANDLERS[msg?.type]
  if (!handle) {
    connection.fail(
      failure("bad-request", "The server doesn't know that kind of message.", {
        detail: `type: ${JSON.stringify(msg?.type)}`
      })
    )
    return
  }

  try {
    requireDatabaseFor(msg)
    await handle(connection, msg.payload)
  } catch (cause) {
    const error = toFailure(cause)
    // Our own bugs are worth a stack in the log; a mistyped folder isn't.
    if (error.kind === "internal") {
      console.error(`Failed to handle "${msg.type}":`, cause)
    } else {
      console.warn(`Refused "${msg.type}": ${error.message}`, error.detail ?? "")
    }
    connection.fail(error, sessionIdOf(msg))
  }
}

/**
 * Everything but the folder picker needs the database. Checking up front
 * turns a 30-second driver timeout into an immediate, honest answer.
 */
function requireDatabaseFor(msg: IncommingMessageType): void {
  if (msg.type !== "list-directory" && !databaseReady()) {
    throw new FailureError(databaseDown())
  }
}

/** The chosen agent, or a refusal naming what a client may actually pick. */
function agentOr400(id: string | undefined) {
  try {
    return getAgent(id)
  } catch (cause) {
    return fail("bad-request", `No agent called "${id}" is registered on this server.`, {
      detail: cause instanceof Error ? cause.message : undefined
    })
  }
}

/** So an error can be attached to the session it belongs to, when there is one. */
function sessionIdOf(msg: IncommingMessageType): string | undefined {
  return msg.type === "add-message" ? msg.payload?.sessionId : undefined
}
