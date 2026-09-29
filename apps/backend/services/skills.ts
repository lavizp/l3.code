import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path"
import type {
  ProviderSummary,
  Skill,
  SkillDestination,
  SkillProblem,
  SkillScope,
  SkillSighting,
  SkillSource
} from "commons/types"
import { fail, FailureError } from "../errors"
import { databaseDown, databaseReady } from "../repositories/failure"
import { loadWorkspaces } from "../repositories/workspaces"
import { listProviders } from "../skills"
import type { WritableScope } from "../skills"
import { SKILL_FILE } from "../skills/scan"
import { identityOf, parseSkill, requireIdentity, serialiseSkill } from "./frontmatter"

/**
 * One list of skills, out of several agents' answers.
 *
 * Each agent is asked what it can see and replies with paths. Those paths
 * overlap heavily and on purpose: the whole point of writing a skill to a
 * shared directory is that more than one agent finds it. So the answers are
 * resolved to real files and grouped by file, and the result is one row per
 * skill carrying the list of agents that can reach it — which is the thing
 * a person actually wants to know, and the thing no single agent can say.
 */

/** The directory a skill written by this app goes in, by scope. */
export function sharedRoot(scope: WritableScope, cwd?: string): string {
  const base = scope === "project" ? cwd : homedir()
  if (!base) {
    fail("bad-request", "That skill needs a project to live in; none was chosen.")
  }
  return join(base, ".agents", "skills")
}

export async function describeProviders(): Promise<ProviderSummary[]> {
  return Promise.all(
    listProviders().map(async provider => {
      const { available, detail } = await provider.probe()
      return {
        id: provider.id,
        label: provider.label,
        available,
        detail,
        readsSharedRoot: provider.readsSharedRoot
      }
    })
  )
}

export async function listSkills(cwd?: string): Promise<{
  skills: Skill[]
  problems: SkillProblem[]
  destinations: SkillDestination[]
}> {
  const problems: SkillProblem[] = []

  // An agent that isn't installed, or whose app-server won't start, is a
  // missing row in the list — not a failed request. The other agents'
  // skills are still worth showing, and the banner already says which agent
  // couldn't be reached.
  const answers = await Promise.all(
    listProviders().map(async provider => {
      try {
        const { sightings, problems: found } = await provider.list(cwd)
        return {
          provider,
          sightings,
          problems: found.map(p => ({ ...p, providerId: provider.id }))
        }
      } catch (cause) {
        return {
          provider,
          sightings: [],
          problems: [
            {
              path: provider.label,
              providerId: provider.id,
              message: cause instanceof Error ? cause.message : String(cause)
            }
          ]
        }
      }
    })
  )

  // Real path -> the sightings of it, so a file two agents found through
  // two directories becomes one skill with two badges.
  const grouped = new Map<string, { sightings: SkillSighting[]; editable: boolean }>()

  for (const answer of answers) {
    problems.push(...answer.problems)
    for (const sighting of answer.sightings) {
      const real = await realpath(sighting.path).catch(() => sighting.path)
      const entry = grouped.get(real) ?? { sightings: [], editable: false }
      entry.sightings.push({
        providerId: answer.provider.id,
        providerLabel: answer.provider.label,
        path: sighting.path,
        scope: scopeOf(sighting.path, sighting.editable, cwd),
        pluginId: sighting.pluginId
      })
      // One agent calling a file editable is enough: it means the file is
      // the person's own, whatever route the other agent took to it.
      entry.editable ||= sighting.editable
      grouped.set(real, entry)
    }
  }

  const skills: Skill[] = []
  for (const [path, entry] of grouped) {
    try {
      const { frontmatter } = parseSkill(await readFile(path, "utf8"))
      const dir = dirname(path)
      skills.push({
        id: path,
        ...identityOf(frontmatter, basename(dir)),
        scope: narrowest(entry.sightings),
        dir,
        editable: entry.editable,
        seenBy: entry.sightings,
        frontmatter
      })
    } catch (cause) {
      problems.push({
        path,
        providerId: entry.sightings[0]?.providerId ?? "",
        message: cause instanceof Error ? cause.message : String(cause)
      })
    }
  }

  skills.sort(
    (a, b) =>
      SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  )

  return { skills, problems, destinations: destinations(cwd) }
}

/** Open one skill for editing. */
export async function readSkill(path: string): Promise<SkillSource> {
  const real = await assertSkillPath(path)
  const raw = await read(real)
  return { path: real, raw, ...parseSkill(raw) }
}

/**
 * Write a new skill into the shared store and make every agent see it.
 *
 * The scope decides the directory, and the directory is the only thing that
 * decides who can read it — so this is the one operation that has to touch
 * every provider, and the only one that creates links.
 */
export async function createSkill(options: {
  scope: WritableScope
  cwd?: string
  name: string
  description: string
  body?: string
}): Promise<SkillSource> {
  const dir = join(sharedRoot(options.scope, options.cwd), options.name)
  const path = join(dir, SKILL_FILE)

  if (await exists(path)) {
    fail("bad-request", `There's already a skill called "${options.name}" here.`)
  }

  const raw = serialiseSkill(
    { name: options.name, description: options.description },
    options.body?.trim() || starter(options.name)
  )

  await mkdir(dir, { recursive: true })
  await writeFile(path, raw, "utf8")
  await projectEverywhere(dir, options.scope, options.cwd)

  return { path, raw, ...parseSkill(raw) }
}

/**
 * Overwrite a `SKILL.md` with what the editor holds.
 *
 * The text is taken as given — including keys this app has never heard of,
 * which will belong to an agent it hasn't been taught about yet — with one
 * exception: a file that has lost its name or its description is a file no
 * agent will ever choose, and saving that silently is indistinguishable
 * from saving one that works.
 */
export async function updateSkill(path: string, raw: string): Promise<SkillSource> {
  const real = await assertSkillPath(path)
  const parsed = parseSkill(raw)
  requireIdentity(parsed.frontmatter)

  await writeFile(real, raw.endsWith("\n") ? raw : `${raw}\n`, "utf8")
  const saved = await read(real)
  return { path: real, raw: saved, ...parseSkill(saved) }
}

/** Remove a skill's directory, and the links pointing at it. */
export async function deleteSkill(path: string): Promise<void> {
  const real = await assertSkillPath(path)
  const dir = dirname(real)
  const name = basename(dir)

  // Links first. A link left behind after its target is gone is a dangling
  // entry in somebody's `~/.claude/skills` that this app can no longer see
  // to clean up. Both scopes are tried because the path alone doesn't say
  // which one it was written at; each provider only removes a link that
  // resolves back to this directory, so the extra attempt costs nothing.
  const project = dirname(dirname(dirname(dir)))
  for (const scope of ["project", "user"] as const) {
    for (const provider of listProviders()) {
      await provider
        .unproject(dir, scope, project)
        .catch(cause =>
          console.warn(`Couldn't unlink ${name} from ${provider.id}:`, cause)
        )
    }
  }

  await rm(dir, { recursive: true, force: true })
}

/** Make a skill directory discoverable by every agent that needs help. */
async function projectEverywhere(
  dir: string,
  scope: WritableScope,
  cwd?: string
): Promise<void> {
  for (const provider of listProviders()) {
    await provider.project(dir, scope, cwd)
  }
}

/**
 * The path, resolved, or a refusal.
 *
 * This is the boundary where a path off the wire becomes a file this server
 * writes to, so it is the boundary that decides what it may write to. Two
 * conditions, both necessary: it has to be a `SKILL.md`, and it has to sit
 * under a directory somebody deliberately put in scope — a registered
 * project, or the home directory's own agent folders. Anything else is a
 * client asking this server to edit a file for reasons of its own.
 */
async function assertSkillPath(path: string): Promise<string> {
  const real = await realpath(resolve(path)).catch(() => {
    fail("not-found", "There's no skill at that path any more.")
  })

  if (basename(real) !== SKILL_FILE) {
    fail("bad-request", `Only ${SKILL_FILE} files are skills.`)
  }

  const { roots, projectsKnown } = await editableRoots()
  if (roots.some(root => contains(root, real))) {
    return real
  }

  // The home roots need nothing but a home directory; the projects come out
  // of the database. So a path that matched neither might be a path outside
  // everything — or might be a project skill during an outage, which is a
  // different sentence and a different thing to do about it.
  if (!projectsKnown) {
    throw new FailureError(databaseDown())
  }
  fail(
    "bad-request",
    "That skill is outside every project this app knows about, so it won't be touched."
  )
}

/**
 * Everywhere a skill may legitimately be edited from, and whether the list
 * of projects made it into that answer.
 */
async function editableRoots(): Promise<{ roots: string[]; projectsKnown: boolean }> {
  const home = homedir()
  const roots = [
    join(home, ".agents", "skills"),
    join(home, ".claude", "skills"),
    join(home, ".codex", "skills")
  ]

  // Asked while the driver is down, `find()` buffers for ten seconds before
  // giving up, and every save would wear that wait. The readiness flag is
  // the same answer, immediately.
  if (!databaseReady()) {
    return { roots, projectsKnown: false }
  }

  try {
    const workspaces = await loadWorkspaces()
    return { roots: [...roots, ...workspaces.map(w => w.path)], projectsKnown: true }
  } catch (cause) {
    console.error("Couldn't load the project list while checking a path:", cause)
    return { roots, projectsKnown: false }
  }
}

/** Whether `path` sits inside `root` — not merely starts with its letters. */
function contains(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)
}

function destinations(cwd?: string): SkillDestination[] {
  const reaches = listProviders().map(p => p.id)
  return [
    ...(cwd
      ? [{ scope: "project" as const, path: sharedRoot("project", cwd), reaches }]
      : []),
    { scope: "user" as const, path: sharedRoot("user"), reaches }
  ]
}

const SCOPE_ORDER: Record<SkillScope, number> = { project: 0, user: 1, system: 2 }

/** The scope one sighting implies. See `narrowest` for why it's per-sighting. */
function scopeOf(path: string, editable: boolean, cwd?: string): SkillScope {
  if (cwd && contains(cwd, path)) {
    return "project"
  }
  // Anything the agent owns and will overwrite on its next update belongs
  // with the built-ins, wherever on disk it happens to sit.
  return editable ? "user" : "system"
}

/**
 * The scope a skill is filed under when its sightings disagree.
 *
 * They disagree whenever a project skill is linked into a home directory:
 * one agent finds it in the repo, another through `~`. The narrower answer
 * is the true one — the file is in the repo, and that is where deleting it
 * would delete it from.
 */
function narrowest(sightings: SkillSighting[]): SkillScope {
  return sightings.reduce<SkillScope>(
    (best, s) => (SCOPE_ORDER[s.scope] < SCOPE_ORDER[best] ? s.scope : best),
    "system"
  )
}

async function read(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8")
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      fail("not-found", "There's no skill at that path any more.")
    }
    throw cause
  }
}

async function exists(path: string): Promise<boolean> {
  return readFile(path).then(
    () => true,
    () => false
  )
}

/** What a brand-new `SKILL.md` says before anybody has written it. */
function starter(name: string): string {
  return `# ${name}

Describe what an agent should do once it has decided this skill applies.
The description in the frontmatter is what gets it chosen; this part is
what it reads afterwards, so it can assume the decision is already made.
`
}
