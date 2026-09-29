import z from "zod"
import type { Failure } from "./errors"
import type {
  ProviderSummary,
  Skill,
  SkillDestination,
  SkillProblem,
  SkillSource
} from "./skills"


export const WorkspaceCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string()
})
export type WorkspaceCreatedSchemaype = z.infer<typeof WorkspaceCreatedSchema>

/** One folder in a directory listing: somewhere to descend into, or to pick. */
export type DirectoryEntry = {
  name: string
  path: string
}

/**
 * One level of the server's filesystem, for the folder picker. A browser
 * never reveals an absolute path — a folder input only exposes names
 * relative to whatever was chosen — and an absolute path is exactly what an
 * agent needs to look for a project's skills, so the walking happens
 * server-side.
 */
export type DirectoryListing = {
  /** The absolute path that was listed, resolved. */
  path: string
  /** One level up, or null when there is nowhere further to go. */
  parent: string | null
  /** Sub-directories only. The picker chooses folders, not files. */
  entries: DirectoryEntry[]
}

/** A project this app knows about: somewhere its skills can be found. */
export type Workspace = {
  id: string
  name: string
  path: string
}

export type OutgoingMessageType =
  | {
      type: 'init'
      workspaces: Workspace[]
      /** Every agent whose skills this server can read, and whether it can. */
      providers: ProviderSummary[]
    }
  | {
      type: 'workspace-created'
      payload: WorkspaceCreatedSchemaype
    }
  /** Answer to `list-directory`, for the folder picker. */
  | {
      type: 'directory-listed'
      payload: DirectoryListing
    }
  /**
   * Every skill in scope, deduplicated across agents. `workspaceId` is null
   * when the listing covers only the skills that follow the person around.
   */
  | {
      type: 'skills-listed'
      payload: {
        workspaceId: string | null
        skills: Skill[]
        /** `SKILL.md` files that wouldn't parse, named rather than dropped. */
        problems: SkillProblem[]
        /** Where a new skill may be written, and who would then see it. */
        destinations: SkillDestination[]
      }
    }
  /** Answer to `read-skill`: one file, as text and as parsed. */
  | {
      type: 'skill-read'
      payload: SkillSource
    }
  /**
   * A skill was written. Carries the saved source so the editor can settle
   * onto exactly what is on disk — the server normalises what it is given.
   * The skill itself arrives in the `skills-listed` that follows, because
   * what a skill reaches is a question about the filesystem rather than
   * about the write.
   */
  | {
      type: 'skill-saved'
      payload: {
        source: SkillSource
        /** True the first time, so the client can select it. */
        created: boolean
      }
    }
  | {
      type: 'skill-deleted'
      payload: { path: string }
    }
  /** Something failed: a bad request, the database, the filesystem, us. */
  | {
      type: 'error'
      payload: { error: Failure }
    }
