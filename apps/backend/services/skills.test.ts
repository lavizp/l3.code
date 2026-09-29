import { afterEach, beforeEach, expect, test } from "bun:test"
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
// Importing the registry is what puts the built-in providers in it.
import "../skills"
import { createSkill } from "./skills"

/**
 * Who a skill is written for is decided by which directory it goes in, and
 * that is invisible once it's there — so it's worth a test that looks at
 * the disk rather than at what the call returned.
 */
let project: string

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), "target-"))
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

test("a shared skill is one file, linked into each agent's folder", async () => {
  const { path } = await createSkill({
    scope: "project",
    target: "shared",
    cwd: project,
    name: "house-style",
    description: "How code here is written."
  })

  // Codex reads `.agents/skills` itself, so the file lives there...
  expect(path).toBe(join(project, ".agents", "skills", "house-style", "SKILL.md"))
  // ...and Claude Code, which doesn't, gets a link rather than a copy.
  const link = join(project, ".claude", "skills", "house-style")
  expect((await lstat(link)).isSymbolicLink()).toBe(true)
})

test("a skill for one agent goes in that agent's folder and is not linked", async () => {
  const { path } = await createSkill({
    scope: "project",
    target: "claude-code",
    cwd: project,
    name: "artifacts",
    description: "Publish a report as an artifact."
  })

  expect(path).toBe(join(project, ".claude", "skills", "artifacts", "SKILL.md"))
  // Linking it into the shared store would hand it to every other agent,
  // which is the opposite of what was asked for.
  await expect(lstat(join(project, ".agents"))).rejects.toThrow()
  await expect(lstat(join(project, ".codex"))).rejects.toThrow()
})

test("each agent's own folder is its own", async () => {
  await createSkill({
    scope: "project",
    target: "codex",
    cwd: project,
    name: "sandbox",
    description: "Run inside the Codex sandbox."
  })

  await expect(
    lstat(join(project, ".codex", "skills", "sandbox", "SKILL.md"))
  ).resolves.toBeDefined()
  await expect(lstat(join(project, ".claude"))).rejects.toThrow()
})

test("the frontmatter every agent reads is written for it", async () => {
  const { path } = await createSkill({
    scope: "project",
    target: "shared",
    cwd: project,
    name: "house-style",
    description: "How code here is written."
  })

  const raw = await readFile(path, "utf8")
  expect(raw.startsWith("---\nname: house-style\n")).toBe(true)
  expect(raw).toContain("description: How code here is written.")
})

test("refuses an agent it has never heard of", async () => {
  await expect(
    createSkill({
      scope: "project",
      target: "not-an-agent",
      cwd: project,
      name: "x",
      description: "y"
    })
  ).rejects.toThrow(/No agent called/)
})

test("refuses a second skill by the same name", async () => {
  const twice = () =>
    createSkill({
      scope: "project",
      target: "shared",
      cwd: project,
      name: "house-style",
      description: "How code here is written."
    })

  await twice()
  await expect(twice()).rejects.toThrow(/already a skill called/)
})
