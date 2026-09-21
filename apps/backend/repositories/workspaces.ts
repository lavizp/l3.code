import { SessionModel, WorkspaceModel } from "db/client"
import type { Message, Session, Workspace } from "commons/types"

export type StoredWorkspace = {
  id: string
  name: string
  path: string
}

/** The trailing segment of a path, used as the workspace's display name. */
export function workspaceNameFor(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path
}

export async function createWorkspace(path: string): Promise<StoredWorkspace> {
  const name = workspaceNameFor(path)
  const workspace = await WorkspaceModel.create({ path, name })
  return { id: workspace._id.toString(), path: workspace.path!, name }
}

export async function findWorkspaceById(
  id: string | undefined
): Promise<StoredWorkspace | null> {
  const workspace = await WorkspaceModel.findOne({ _id: id })
  if (!workspace) {
    return null
  }
  return { id: workspace._id.toString(), name: workspace.name!, path: workspace.path! }
}

/** Every workspace with its sessions and full conversation history. */
export async function loadWorkspaces(): Promise<Workspace[]> {
  const [workspaces, sessions] = await Promise.all([
    WorkspaceModel.find(),
    SessionModel.find()
  ])

  const sessionsByWorkspace = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = s.workspace?.toString()
    if (!key) {
      continue
    }
    const messages: Message[] = s.conversation.map(m => ({
      id: m._id.toString(),
      role: m.role,
      payload: m.payload
    })) as Message[]

    const list = sessionsByWorkspace.get(key) ?? []
    list.push({ id: s._id.toString(), messages })
    sessionsByWorkspace.set(key, list)
  }

  return workspaces.map(w => ({
    id: w._id.toString(),
    name: w.name!,
    path: w.path!,
    sessions: sessionsByWorkspace.get(w._id.toString()) ?? []
  }))
}
