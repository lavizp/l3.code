import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { link, unlink } from "../services/links"
import { scanRoot } from "./scan"
import type { Problem, SkillProvider, Sighting, WritableScope } from "./types"

/**
 * Claude Code's skills, read off the filesystem.
 *
 * The Agent SDK will happily list the skills a session can see — that is
 * what `supportedCommands()` is for — but it reports a name and a
 * description and no path, and a pane that can't say where a skill lives
 * can't open it either. The directories it reads are stable and few, so
 * this walks them directly and keeps the SDK out of the read path
 * altogether; nothing here spawns the agent, so listing costs nothing.
 */
export const claudeCode: SkillProvider = {
  id: "claude-code",
  label: "Claude Code",
  // Both agents' names begin with a C, so the badge can't.
  short: "CC",
  // It reads `.claude/skills`, and nothing else. A skill in the shared store
  // reaches it through a symlink.
  readsSharedRoot: false,
  probe,
  ownRoot,
  list,
  project,
  unproject
}

async function probe(): Promise<{ available: boolean; detail?: string }> {
  if (Bun.which("claude")) {
    return { available: true }
  }
  return {
    available: false,
    detail: "The `claude` command isn't on this machine's PATH."
  }
}

async function list(
  cwd?: string
): Promise<{ sightings: Sighting[]; problems: Problem[] }> {
  const home = homedir()

  const roots = [
    // The person's own skills, and the only user-scope root they write to.
    { root: ownRoot("user")!, depth: 1, origin: "yours" as const },
    // Skills synced down from a claude.ai account. Re-downloaded every ten
    // minutes, so anything written here is on a timer: <bucket>/<name>.
    { root: join(home, ".claude", "skills", "synced"), depth: 2, origin: "synced" as const },
    ...(cwd
      ? [{ root: ownRoot("project", cwd)!, depth: 1, origin: "yours" as const }]
      : []),
    ...(await pluginRoots(home))
  ]

  const scans = await Promise.all(
    roots.map(r =>
      scanRoot(r.root, {
        depth: r.depth,
        origin: r.origin,
        pluginId: () => ("pluginId" in r ? (r.pluginId as string) : null)
      })
    )
  )
  return {
    sightings: scans.flatMap(s => s.sightings),
    problems: scans.flatMap(s => s.problems)
  }
}

/**
 * The skill directory of every installed plugin.
 *
 * Walking the plugin cache instead would be simpler and wrong: it keeps
 * every version it has ever downloaded, so one plugin that has updated
 * three times becomes four identical-looking skills, only one of which the
 * agent will ever run. `installed_plugins.json` names the install path that
 * is actually live, which is the only copy worth showing.
 */
async function pluginRoots(home: string): Promise<
  { root: string; depth: number; origin: "plugin"; pluginId: string }[]
> {
  const [installed, disabled] = await Promise.all([
    readJson<{
      plugins?: Record<string, { installPath?: string }[]>
    }>(join(home, ".claude", "plugins", "installed_plugins.json")),
    disabledPlugins(home)
  ])

  return Object.entries(installed?.plugins ?? {})
    .filter(([id]) => !disabled.has(id))
    .flatMap(([id, entries]) =>
      (entries ?? [])
        .map(entry => entry.installPath)
        .filter((path): path is string => typeof path === "string")
        .map(path => ({
          root: join(path, "skills"),
          depth: 1,
          origin: "plugin" as const,
          pluginId: id
        }))
    )
}

/** Plugins turned off in settings, whose skills the agent won't load. */
async function disabledPlugins(home: string): Promise<Set<string>> {
  const settings = await readJson<{ enabledPlugins?: Record<string, boolean> }>(
    join(home, ".claude", "settings.json")
  )
  return new Set(
    Object.entries(settings?.enabledPlugins ?? {})
      .filter(([, on]) => on === false)
      .map(([id]) => id)
  )
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T
  } catch {
    // Absent on a machine with no plugins, and unreadable is the same
    // answer: no plugin skills, rather than a failed listing.
    return null
  }
}

/**
 * `.claude/skills` — where this agent keeps its own, and the only directory
 * it reads that this app writes to. A skill written here is Claude Code's
 * alone; Codex has no reason to look in it and doesn't.
 */
function ownRoot(scope: WritableScope, cwd?: string): string | null {
  const base = scope === "project" ? cwd : homedir()
  return base ? join(base, ".claude", "skills") : null
}

/** Where a symlink for a shared skill named `name` belongs. */
function linkPath(name: string, scope: WritableScope, cwd?: string): string | null {
  const root = ownRoot(scope, cwd)
  return root ? join(root, name) : null
}

async function project(dir: string, scope: WritableScope, cwd?: string): Promise<void> {
  const target = linkPath(basename(dir), scope, cwd)
  if (target) {
    await link(dir, target)
  }
}

async function unproject(
  dir: string,
  scope: WritableScope,
  cwd?: string
): Promise<void> {
  const at = linkPath(basename(dir), scope, cwd)
  if (at) {
    await unlink(at, dir)
  }
}
