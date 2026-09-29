import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scanRoot } from "./scan"

/**
 * A root laid out the way the real ones are: a skill directly under it, one
 * nested behind an id the way synced skills are, a symlink into a shared
 * store, and a directory that is nothing to do with skills.
 */
let root: string
let store: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "scan-"))
  store = await mkdtemp(join(tmpdir(), "store-"))

  await skillAt(join(root, "top-level"))
  await skillAt(join(root, "bucket-id", "nested"))
  await mkdir(join(root, "not-a-skill"), { recursive: true })
  await writeFile(join(root, "not-a-skill", "README.md"), "")

  await skillAt(join(store, "shared"))
  await symlink(join(store, "shared"), join(root, "linked"))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
  await rm(store, { recursive: true, force: true })
})

async function skillAt(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, "SKILL.md"), "---\nname: x\ndescription: y\n---\n")
}

test("finds skills at the depth asked for", async () => {
  const { sightings } = await scanRoot(root, { depth: 1, editable: true })
  expect(names(sightings)).toEqual(["linked", "top-level"])
})

test("goes deeper when told to, without losing the shallow ones", async () => {
  const { sightings } = await scanRoot(root, { depth: 2, editable: true })
  expect(names(sightings)).toEqual(["linked", "nested", "top-level"])
})

test("follows a symlink into a shared store", async () => {
  // This is how a skill reaches an agent that won't read the shared store
  // itself, so a scan that skipped symlinks would miss every skill this app
  // writes.
  const { sightings } = await scanRoot(root, { depth: 1, editable: true })
  expect(sightings.map(s => s.path)).toContain(join(root, "linked", "SKILL.md"))
})

test("a root that isn't there is not a problem worth reporting", async () => {
  // Most of these are absent on most machines. Saying so for each would
  // bury the ones that are genuinely broken.
  const { sightings, problems } = await scanRoot(join(root, "nowhere"), {
    depth: 2,
    editable: true
  })
  expect(sightings).toEqual([])
  expect(problems).toEqual([])
})

test("carries the plugin a skill belongs to", async () => {
  const { sightings } = await scanRoot(root, {
    depth: 1,
    editable: false,
    pluginId: () => "some-plugin@marketplace"
  })
  expect(sightings.every(s => s.pluginId === "some-plugin@marketplace")).toBe(true)
  expect(sightings.every(s => !s.editable)).toBe(true)
})

function names(sightings: { path: string }[]): string[] {
  return sightings
    .map(s => s.path.split("/").at(-2)!)
    .sort((a, b) => a.localeCompare(b))
}
