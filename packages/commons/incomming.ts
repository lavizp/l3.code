import z from "zod"

export const CreateWorkspaceSchema = z.object({
  path: z.string()
})
export type CreateWorkspaceSchemaType = z.infer<typeof CreateWorkspaceSchema>

export const CreateSessionSchema = z.object({
  workspaceId: z.string(),
  /**
   * Which agent runs this session, for its whole life. Omitted means the
   * server default; it cannot be changed once the session exists.
   */
  agentId: z.string().optional()
})
export type CreateSessionSchemaType = z.infer<typeof CreateSessionSchema>

export const ListDirectorySchema = z.object({
  /**
   * Absolute path to list. Omitted means the server's own starting point —
   * the client has no way of knowing what that should be.
   */
  path: z.string().optional()
})
export type ListDirectorySchemaType = z.infer<typeof ListDirectorySchema>

/**
 * What the browser's own folder dialog gives us about the folder someone
 * chose: its name, and what sits directly inside it. Never a path.
 */
export const LocateFolderSchema = z.object({
  name: z.string(),
  entries: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["file", "directory"])
    })
  )
})
export type LocateFolderSchemaType = z.infer<typeof LocateFolderSchema>

export const AddMessageSchema = z.object({
  sessionId: z.string(),
  message: z.string()
})
export type AddMessageSchemaType = z.infer<typeof AddMessageSchema>

export type IncommingMessageType =
  | {
      type: 'create-workspace'
      payload: CreateWorkspaceSchemaType
    }
  | {
      type: 'create-session'
      payload: CreateSessionSchemaType
    }
  | {
      type: 'add-message'
      payload: AddMessageSchemaType
    }
  | {
      type: 'list-directory'
      payload: ListDirectorySchemaType
    }
  | {
      type: 'locate-folder'
      payload: LocateFolderSchemaType
    }
