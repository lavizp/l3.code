import z from "zod"

export const CreateWorkspaceSchema = z.object({
  path: z.string()
})
export type CreateWorkspaceSchemaType = z.infer<typeof CreateWorkspaceSchema>

export const ListDirectorySchema = z.object({
  /**
   * Absolute path to list. Omitted means the server's own starting point —
   * the client has no way of knowing what that should be.
   */
  path: z.string().optional()
})
export type ListDirectorySchemaType = z.infer<typeof ListDirectorySchema>

/**
 * Ask for the skills every registered agent can see.
 *
 * With a project, that's the project's own skills as well as the ones the
 * person carries everywhere; without one, only the latter — there is no
 * repo to look in.
 */
export const ListSkillsSchema = z.object({
  workspaceId: z.string().optional()
})
export type ListSkillsSchemaType = z.infer<typeof ListSkillsSchema>

/** Open one `SKILL.md` for editing. */
export const ReadSkillSchema = z.object({
  path: z.string()
})
export type ReadSkillSchemaType = z.infer<typeof ReadSkillSchema>

const SKILL_NAME = z
  .string()
  .trim()
  .min(1)
  .max(64)
  // The directory name and the agent's handle for it are the same string,
  // so it has to survive being both.
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits and dashes only")

/**
 * Write a new skill. The scope and the project decide where it lands; the
 * server answers with the path it chose rather than taking one.
 */
export const CreateSkillSchema = z.object({
  /** Required for `project` scope, meaningless for `user`. */
  workspaceId: z.string().optional(),
  scope: z.enum(["project", "user"]),
  /**
   * `"shared"`, or the id of the one agent this skill is for. It decides
   * which directory the file goes in, and that directory is the only thing
   * that decides who will ever read it.
   */
  target: z.string().min(1),
  name: SKILL_NAME,
  description: z.string().trim().min(1).max(1024),
  /** The markdown under the frontmatter. Empty means the starter template. */
  body: z.string().optional()
})
export type CreateSkillSchemaType = z.infer<typeof CreateSkillSchema>

/**
 * Overwrite a `SKILL.md` with the editor's text, frontmatter and all. The
 * path identifies it; a skill is never moved by an edit, because the place
 * it lives is what decides which agents can see it.
 */
export const UpdateSkillSchema = z.object({
  path: z.string(),
  raw: z.string(),
  /**
   * The project the client is looking at. Not used to find the file — the
   * path does that — but a write is answered with a fresh listing, and a
   * listing taken for a different project than the one on screen would
   * replace it with somebody else's skills.
   */
  workspaceId: z.string().optional()
})
export type UpdateSkillSchemaType = z.infer<typeof UpdateSkillSchema>

/** Remove a skill's directory, and any symlinks pointing at it. */
export const DeleteSkillSchema = z.object({
  path: z.string(),
  /** The project in view, so the listing that follows matches the screen. */
  workspaceId: z.string().optional()
})
export type DeleteSkillSchemaType = z.infer<typeof DeleteSkillSchema>

export type IncommingMessageType =
  | {
      type: 'create-workspace'
      payload: CreateWorkspaceSchemaType
    }
  | {
      type: 'list-directory'
      payload: ListDirectorySchemaType
    }
  | {
      type: 'list-skills'
      payload: ListSkillsSchemaType
    }
  | {
      type: 'read-skill'
      payload: ReadSkillSchemaType
    }
  | {
      type: 'create-skill'
      payload: CreateSkillSchemaType
    }
  | {
      type: 'update-skill'
      payload: UpdateSkillSchemaType
    }
  | {
      type: 'delete-skill'
      payload: DeleteSkillSchemaType
    }
