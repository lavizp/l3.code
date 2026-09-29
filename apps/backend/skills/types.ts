/**
 * The seam between this server and whatever coding agent owns the skills.
 *
 * Everything upstream of this file — the wire protocol, the UI, the store —
 * is written against these types only, so adding Cursor or opencode is a new
 * file implementing `SkillProvider` plus one `registerProvider` call.
 *
 * A provider does two things and no more: say where its agent looks for
 * skills, and make a directory in the shared store appear in one of those
 * places. It deliberately does *not* parse `SKILL.md` — two agents routinely
 * find the same file by different routes, and parsing it once, centrally,
 * after the paths have been resolved and deduplicated, is the only way the
 * list ends up with one row per skill instead of one per sighting.
 */

import type { SkillOrigin, SkillScope } from "commons/types"

/** The scopes this app will write to. Both of them, as it happens. */
export type WritableScope = SkillScope

/** One agent's sighting of one `SKILL.md`. */
export type Sighting = {
  /**
   * Where this agent found it — possibly a symlink into the shared store,
   * which is exactly what projection creates. Resolved centrally.
   */
  path: string
  /**
   * Who put it there. Only `yours` is ever written to: everything else is
   * replaced wholesale the next time the agent, a plugin or an account sync
   * updates, so an edit would be quietly undone.
   */
  origin: SkillOrigin
  /** The plugin that owns it, when the agent says so. */
  pluginId: string | null
}

export type Problem = {
  /** The file or directory that couldn't be read. */
  path: string
  message: string
}

export interface SkillProvider {
  /** Stable key used on the wire and in the registry, e.g. "claude-code". */
  readonly id: string
  /** What to call it in the UI, e.g. "Claude Code". */
  readonly label: string
  /**
   * Whether this agent reads a project's `.agents/skills` by itself.
   *
   * `.agents/skills` is the one directory more than one agent has agreed to
   * look in, so it is where this app writes. An agent that reads it needs
   * nothing further; an agent that doesn't gets a symlink from its own
   * directory, which is `project`'s whole job.
   */
  readonly readsSharedRoot: boolean

  /** Two or three characters standing for this agent in a badge. */
  readonly short: string

  /** Whether this agent is installed and usable here, and why not if not. */
  probe(): Promise<{ available: boolean; detail?: string }>

  /**
   * Where a skill written for this agent *alone* goes — its own directory,
   * which no other agent reads. Null when the agent has no such place at
   * that scope.
   */
  ownRoot(scope: WritableScope, cwd?: string): string | null

  /**
   * Every `SKILL.md` this agent can currently see. `cwd` is the project in
   * view, when there is one; without it, only what the agent sees from
   * anywhere.
   */
  list(cwd?: string): Promise<{ sightings: Sighting[]; problems: Problem[] }>

  /**
   * Make `dir` — a skill directory in the shared store — discoverable by
   * this agent at `scope`. A no-op for an agent that already reads the
   * shared store at that scope.
   */
  project(dir: string, scope: WritableScope, cwd?: string): Promise<void>

  /**
   * Undo `project` for the skill directory `dir`. Removes only a link that
   * actually points at `dir`, so calling it with a scope or a project the
   * skill never belonged to does nothing rather than something wrong.
   */
  unproject(dir: string, scope: WritableScope, cwd?: string): Promise<void>
}
