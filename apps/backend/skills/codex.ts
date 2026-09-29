import { homedir } from "node:os"
import { basename, join } from "node:path"
import { listCodexSkills } from "../services/codex-app-server"
import { link, unlink } from "../services/links"
import type { SkillOrigin } from "commons/types"
import type { Problem, SkillProvider, Sighting, WritableScope } from "./types"

/**
 * Codex's skills, read from `codex app-server`.
 *
 * Codex looks in more places than are worth guessing at — a project's
 * `.codex/skills` and `.agents/skills`, `$CODEX_HOME/skills` and the
 * `.system` folder inside it, and a plugin cache keyed by package and
 * version — and which of them are live depends on config this app doesn't
 * read. Its own app-server already knows, and answers with the path, the
 * scope and the owning plugin for every one. So this asks rather than
 * guesses, and falls back to nothing rather than to a half-right list.
 */
export const codex: SkillProvider = {
  id: "codex",
  label: "Codex",
  // Both agents' names begin with a C, so the badge can't.
  short: "CX",
  // Codex reads a project's `.agents/skills` natively, which is why that is
  // the directory this app writes to. Its home directory is a different
  // story — see `linkPath`.
  readsSharedRoot: true,
  probe,
  ownRoot,
  list,
  project,
  unproject
}

async function probe(): Promise<{ available: boolean; detail?: string }> {
  if (Bun.which("codex")) {
    return { available: true }
  }
  return {
    available: false,
    detail: "The `codex` command isn't on this machine's PATH."
  }
}

async function list(
  cwd?: string
): Promise<{ sightings: Sighting[]; problems: Problem[] }> {
  // Without a project there is still a question worth asking — which skills
  // follow the person everywhere — and Codex answers it relative to a
  // directory, so ask about home.
  const { data } = await listCodexSkills([cwd ?? homedir()])

  const sightings: Sighting[] = []
  const problems: Problem[] = []

  for (const entry of data) {
    for (const skill of entry.skills) {
      sightings.push({
        path: skill.path,
        origin: originOf(skill.scope, skill.pluginId),
        pluginId: skill.pluginId
      })
    }
    for (const error of entry.errors) {
      problems.push({ path: error.path, message: error.message })
    }
  }

  return { sightings, problems }
}

/**
 * What Codex's own scope word means in this app's terms.
 *
 * `system` is what Codex ships with and `admin` is what an organisation
 * pushed down; both are replaced wholesale on update, as are a plugin's own
 * skills. What's left is the person's.
 */
function originOf(
  scope: "user" | "repo" | "system" | "admin",
  pluginId: string | null
): SkillOrigin {
  if (pluginId) {
    return "plugin"
  }
  return scope === "system" || scope === "admin" ? "bundled" : "yours"
}

/** `$CODEX_HOME` or `~/.codex`, whichever this machine is using. */
function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), ".codex")
}

/**
 * `.codex/skills` — where this agent keeps its own. Codex reads it at both
 * scopes, and no other agent reads it at either, so a skill written here is
 * Codex's alone.
 */
function ownRoot(scope: WritableScope, cwd?: string): string | null {
  if (scope === "project") {
    return cwd ? join(cwd, ".codex", "skills") : null
  }
  return join(codexHome(), "skills")
}

/**
 * Where a symlink for a *shared* skill belongs, or null when none is needed.
 *
 * At project scope Codex reads `.agents/skills` itself, so there is nothing
 * to do. At user scope it doesn't: its home root is `~/.codex/skills`, and
 * `~/.agents/skills` means nothing to it — so the shared store reaches it
 * the same way it reaches Claude Code, through a link.
 */
function linkPath(name: string, scope: WritableScope): string | null {
  if (scope === "project") {
    return null
  }
  return join(ownRoot("user")!, name)
}

async function project(dir: string, scope: WritableScope): Promise<void> {
  const target = linkPath(basename(dir), scope)
  if (target) {
    await link(dir, target)
  }
}

async function unproject(dir: string, scope: WritableScope): Promise<void> {
  const at = linkPath(basename(dir), scope)
  if (at) {
    await unlink(at, dir)
  }
}
