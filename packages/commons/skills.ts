/**
 * What a skill is, in terms both ends of the wire understand.
 *
 * A skill on disk is a directory holding a `SKILL.md`: YAML frontmatter
 * naming and describing it, then markdown the agent reads once it decides
 * the skill applies. Every agent this app knows about reads that same shape
 * — they disagree only about *where* to look and which frontmatter keys they
 * honour. So there is one `Skill` type here, and the disagreement lives in
 * `seenBy`.
 */

/**
 * How far a skill reaches.
 *
 * - `project` — lives in the repo, travels with it, applies to that work only.
 * - `user` — lives in the home directory, follows the person everywhere.
 * - `system` — came with the agent or with a plugin. Shown, never edited:
 *   the next update would overwrite anything written here.
 */
export type SkillScope = "project" | "user" | "system"

/** One agent's sighting of a skill: where it found it, and under what terms. */
export type SkillSighting = {
  providerId: string
  providerLabel: string
  /**
   * The path this agent discovered it at. Often a symlink pointing at the
   * same `SKILL.md` another agent found directly — which is the whole point
   * of the shared store, and why `Skill.path` is the resolved one.
   */
  path: string
  scope: SkillScope
  /** The plugin that owns it, when one does. */
  pluginId: string | null
}

export type Skill = {
  /**
   * The resolved absolute path of the `SKILL.md`. Two agents that found the
   * same file through different directories produce one skill, not two, so
   * identity is the file rather than the name — names collide across scopes.
   */
  id: string
  name: string
  description: string
  /** The narrowest scope it was seen at; what the list groups by. */
  scope: SkillScope
  /** The directory holding the `SKILL.md`. */
  dir: string
  /** Whether this app will write to it. False for anything an agent owns. */
  editable: boolean
  /** Every agent that can see it, and where. Never empty. */
  seenBy: SkillSighting[]
  /** The frontmatter as parsed, for the editor's form and the honour badges. */
  frontmatter: Record<string, unknown>
}

/** A `SKILL.md` that couldn't be read, reported rather than silently skipped. */
export type SkillProblem = {
  path: string
  message: string
  providerId: string
}

/** One agent, and whether it can be asked anything on this machine. */
export type ProviderSummary = {
  id: string
  label: string
  available: boolean
  /** Why not, when it isn't. */
  detail?: string
  /**
   * Whether this agent reads the shared `.agents/skills` directory by
   * itself. The ones that don't get a symlink instead.
   */
  readsSharedRoot: boolean
}

/** A place a new skill may be written, offered by the "new skill" form. */
export type SkillDestination = {
  scope: SkillScope
  /** The directory new skills land in, e.g. `<project>/.agents/skills`. */
  path: string
  /** Which agents will see it once it's there, by id. */
  reaches: string[]
}

/** A skill opened for editing: the file as it is, and as it parses. */
export type SkillSource = {
  path: string
  /** The whole `SKILL.md`, frontmatter included. The editor's text. */
  raw: string
  frontmatter: Record<string, unknown>
  /** Everything after the frontmatter. */
  body: string
}

/**
 * Frontmatter keys, and which agents act on them.
 *
 * Both agents ignore keys they don't know, so one file can carry the union
 * and stay correct for everyone — but someone setting `allowed-tools` should
 * be told that only Claude Code will act on it rather than finding out from
 * an agent that didn't.
 */
export const FRONTMATTER_SUPPORT: Record<string, readonly string[]> = {
  name: ["claude-code", "codex"],
  description: ["claude-code", "codex"],
  "allowed-tools": ["claude-code"],
  "argument-hint": ["claude-code"],
  "disable-model-invocation": ["claude-code"],
  "user-invocable": ["claude-code"],
  model: ["claude-code"],
  version: ["claude-code"],
  license: ["claude-code"],
  metadata: ["codex"]
}
