import { WorkspaceModel } from "db/client"
import type { Workspace } from "commons/types"

/** The trailing segment of a path, used as the project's display name. */
export function workspaceNameFor(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path
}

export async function createWorkspace(path: string): Promise<Workspace> {
  const name = workspaceNameFor(path)
  const workspace = await WorkspaceModel.create({ path, name })
  return { id: workspace._id.toString(), path: workspace.path!, name }
}

export async function findWorkspaceById(
  id: string | undefined
): Promise<Workspace | null> {
  if (!id) {
    return null
  }
  const workspace = await WorkspaceModel.findOne({ _id: id })
  if (!workspace) {
    return null
  }
  return { id: workspace._id.toString(), name: workspace.name!, path: workspace.path! }
}

/** Every project this app has been pointed at. */
export async function loadWorkspaces(): Promise<Workspace[]> {
  const workspaces = await WorkspaceModel.find()
  return workspaces.map(w => ({
    id: w._id.toString(),
    name: w.name!,
    path: w.path!
  }))
}
