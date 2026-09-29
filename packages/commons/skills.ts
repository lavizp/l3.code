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
 * Where a skill lives, which decides how far it travels.
 *
 * - `project` — in the repo, travels with it, applies to that work only.
 * - `user` — in the home directory, follows the person everywhere.
 *
 * Deliberately not "who owns it" — see `SkillOrigin`. A plugin's skills are
 * installed under the home directory and so are the person's own; treating
 * those as one thing is what makes a list where the agent's defaults are
 * indistinguishable from the ones somebody wrote.
 */
export type SkillScope = "project" | "user"

/**
 * Who put a skill there, which decides whether it can be edited and who is
 * answerable for what it says.
 *
 * - `yours` — written by the person. The only kind this app will edit.
 * - `plugin` — provided by an installed plugin.
 * - `synced` — downloaded from the person's account, and re-downloaded on a
 *   timer, so an edit here has a short life.
 * - `bundled` — shipped with the agent itself.
 */
export type SkillOrigin = "yours" | "plugin" | "synced" | "bundled"

/** One agent's sighting of a skill: where it found it, and under what terms. */
export type SkillSighting = {
  providerId: string
  providerLabel: string
  /**
   * The path this agent discovered it at. Often a symlink pointing at the
   * same `SKILL.md` another agent found directly — which is the whole point
   * of the shared store, and why `Skill.id` is the resolved one.
   */
  path: string
  scope: SkillScope
  origin: SkillOrigin
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
  scope: SkillScope
  origin: SkillOrigin
  /** The plugin that provides it, when `origin` is `plugin`. */
  pluginId: string | null
  /** The directory holding the `SKILL.md`. */
  dir: string
  /** Whether this app will write to it. True only for `yours`. */
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
  /**
   * Two or three characters that stand for this agent in a badge.
   *
   * Not derived from the label: "Claude Code" and "Codex" share an initial,
   * and a badge that reads the same for both answers the one question the
   * badge exists to answer with a coin toss.
   */
  short: string
  available: boolean
  /** Why not, when it isn't. */
  detail?: string
}

/**
 * Who a new skill is for.
 *
 * `"shared"` means every agent — one file, linked into each one's directory.
 * Anything else is a provider id, and the skill goes straight into that
 * agent's own folder where no other agent will look. Both are things people
 * want: a house style every agent should follow is shared, and a skill that
 * leans on one agent's tools belongs to that agent alone.
 */
export type SkillTarget = "shared" | (string & {})

/** A place a new skill may be written, offered by the "new skill" form. */
export type SkillDestination = {
  scope: SkillScope
  target: SkillTarget
  /** What to call this choice, e.g. "Every agent" or "Codex only". */
  label: string
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
