import { readdir } from "node:fs/promises"
import { join } from "node:path"
import type { SkillOrigin } from "commons/types"
import type { Problem, Sighting } from "./types"

/** The file that makes a directory a skill. */
export const SKILL_FILE = "SKILL.md"

/**
 * Find the skills under a directory.
 *
 * Every agent lays its skill roots out the same way — a folder per skill,
 * holding a `SKILL.md` — but they nest that folder at different depths: one
 * level under `~/.claude/skills`, two under `~/.claude/skills/synced` where
 * a bucket id sits in between, four under a plugin cache keyed by
 * marketplace, plugin and version. `depth` is how many levels down to look,
 * so one walk covers all of them.
 *
 * A root that doesn't exist is not a problem worth reporting: most of these
 * are absent on most machines, and saying so for each would bury the ones
 * that are genuinely broken.
 */
export async function scanRoot(
  root: string,
  options: {
    depth?: number
    origin: SkillOrigin
    pluginId?: (dir: string) => string | null
  }
): Promise<{ sightings: Sighting[]; problems: Problem[] }> {
  const sightings: Sighting[] = []
  const problems: Problem[] = []

  async function walk(dir: string, remaining: number): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        problems.push({ path: dir, message: describe(cause) })
      }
      return
    }

    // A directory holding a SKILL.md is a skill, whatever depth it turned up
    // at — the counts above are where they usually are, not a rule.
    if (entries.some(e => e.name === SKILL_FILE && !e.isDirectory())) {
      sightings.push({
        path: join(dir, SKILL_FILE),
        origin: options.origin,
        pluginId: options.pluginId?.(dir) ?? null
      })
      return
    }

    if (remaining <= 0) {
      return
    }

    await Promise.all(
      entries
        // Symlinked skill directories are followed on purpose: a symlink
        // from an agent's own folder into the shared store is how a skill
        // reaches an agent that won't read the store itself.
        .filter(e => e.isDirectory() || e.isSymbolicLink())
        .map(e => walk(join(dir, e.name), remaining - 1))
    )
  }

  await walk(root, options.depth ?? 1)
  return { sightings, problems }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
