import {
  CreateSkillSchema,
  CreateWorkspaceSchema,
  DeleteSkillSchema,
  ListDirectorySchema,
  ListSkillsSchema,
  ReadSkillSchema,
  UpdateSkillSchema,
  failure,
  type IncommingMessageType,
  type SkillSource
} from "commons/types"
import { fail, FailureError, toFailure } from "../errors"
import { databaseDown, databaseFailure, databaseReady } from "../repositories/failure"
import { createWorkspace, findWorkspaceById } from "../repositories/workspaces"
import { listDirectory } from "../services/directory"
import {
  createSkill,
  deleteSkill,
  listSkills,
  readSkill,
  updateSkill
} from "../services/skills"
import type { Connection } from "./connection"

type Handler = (connection: Connection, payload: unknown) => Promise<void>

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
 * The folder behind a workspace id, or a refusal. Every skill operation that
 * names a project goes through here, so an id the client invented can never
 * become a path this server reads or writes.
 */
async function projectPath(id: string | undefined): Promise<string | undefined> {
  if (!id) {
    return undefined
  }
  const workspace = await findWorkspaceById(id).catch(cause => {
    throw new FailureError(databaseFailure(cause, "project"))
  })
  if (!workspace) {
    fail("not-found", "No such project.")
  }
  return workspace.path
}

/** Send the whole list back, which is what every write settles onto. */
async function sendSkills(
  connection: Connection,
  workspaceId: string | undefined
): Promise<void> {
  const cwd = await projectPath(workspaceId)
  const listing = await listSkills(cwd)
  connection.send({
    type: "skills-listed",
    payload: { workspaceId: workspaceId ?? null, ...listing }
  })
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
      throw new FailureError(databaseFailure(cause, "project"))
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

  "list-skills": async (connection, payload) => {
    const data = parse(ListSkillsSchema, payload ?? {})
    await sendSkills(connection, data.workspaceId)
  },

  "read-skill": async (connection, payload) => {
    const data = parse(ReadSkillSchema, payload)
    connection.send({ type: "skill-read", payload: await readSkill(data.path) })
  },

  "create-skill": async (connection, payload) => {
    const data = parse(CreateSkillSchema, payload)
    if (data.scope === "project" && !data.workspaceId) {
      fail("bad-request", "A project skill needs a project to live in.")
    }
    const cwd = await projectPath(data.workspaceId)
    const source = await createSkill({ ...data, cwd })
    await sendSaved(connection, source, data.workspaceId, true)
  },

  "update-skill": async (connection, payload) => {
    const data = parse(UpdateSkillSchema, payload)
    const source = await updateSkill(data.path, data.raw)
    await sendSaved(connection, source, data.workspaceId, false)
  },

  "delete-skill": async (connection, payload) => {
    const data = parse(DeleteSkillSchema, payload)
    await deleteSkill(data.path)
    connection.send({ type: "skill-deleted", payload: { path: data.path } })
    await sendSkills(connection, data.workspaceId)
  }
}

/**
 * Answer a write with the saved file, then with the list as it now stands.
 *
 * Writing a skill and finding out who can read it are two different
 * questions, and the second is the one that matters: a skill nobody can see
 * is a file, not a skill. So a save is never reported on its own — the
 * listing that follows is what proves the link landed.
 */
async function sendSaved(
  connection: Connection,
  source: SkillSource,
  workspaceId: string | undefined,
  created: boolean
): Promise<void> {
  connection.send({ type: "skill-saved", payload: { source, created } })
  await sendSkills(connection, workspaceId)
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
    connection.fail(error)
  }
}

/**
 * The database holds the list of projects and nothing else — the skills
 * themselves are files. So the folder picker and every operation that names
 * no project keep working while Mongo is down, and only the ones that have
 * to turn an id into a path are refused.
 */
function requireDatabaseFor(msg: IncommingMessageType): void {
  const needsProject =
    msg.type === "create-workspace" ||
    (msg.type !== "list-directory" &&
      typeof (msg.payload as { workspaceId?: string } | undefined)?.workspaceId ===
        "string")

  if (needsProject && !databaseReady()) {
    throw new FailureError(databaseDown())
  }
}
