import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { listDirectory } from "./directory"

/**
 * A folder with one of everything the picker has to make a decision about.
 */
let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "picker-"))
  await mkdir(join(root, "beta"))
  await mkdir(join(root, "Alpha"))
  await mkdir(join(root, "target"))
  await mkdir(join(root, ".hidden"))
  await writeFile(join(root, "plain.txt"), "")
  await symlink(join(root, "target"), join(root, "linked-dir"))
  await symlink(join(root, "plain.txt"), join(root, "linked-file"))
  await symlink(join(root, "gone"), join(root, "dangling"))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

test("offers folders, including symlinked ones", async () => {
  const { entries } = await listDirectory(root)
  expect(entries.map(e => e.name)).toEqual(["Alpha", "beta", "linked-dir", "target"])
})

test("leaves out files, dangling links and dot-folders", async () => {
  const { entries } = await listDirectory(root)
  const names = entries.map(e => e.name)
  expect(names).not.toContain("plain.txt")
  expect(names).not.toContain("linked-file")
  expect(names).not.toContain("dangling")
  expect(names).not.toContain(".hidden")
})

test("sorts case-insensitively, so Alpha isn't stranded above beta", async () => {
  const { entries } = await listDirectory(root)
  expect(entries.map(e => e.name).slice(0, 2)).toEqual(["Alpha", "beta"])
})

test("every entry carries a path that can be listed in turn", async () => {
  const { entries } = await listDirectory(root)
  for (const entry of entries) {
    expect(entry.path).toBe(join(root, entry.name))
    expect((await listDirectory(entry.path)).path).toBe(entry.path)
  }
})

test("reports the parent, and nothing above the root", async () => {
  expect((await listDirectory(root)).parent).toBe(tmpdir())
  expect((await listDirectory("/")).parent).toBeNull()
})

test("starts at home when asked for nothing, and expands ~", async () => {
  expect((await listDirectory()).path).toBe(homedir())
  expect((await listDirectory("~")).path).toBe(homedir())
  expect((await listDirectory("  ")).path).toBe(homedir())
})

test("tidies up the path it was given", async () => {
  expect((await listDirectory(`${root}/target/..`)).path).toBe(root)
  expect((await listDirectory(`  ${root}  `)).path).toBe(root)
})

test("explains itself when a folder can't be read", async () => {
  expect(listDirectory(join(root, "gone"))).rejects.toThrow(`No such folder: ${join(root, "gone")}`)
  expect(listDirectory(join(root, "plain.txt"))).rejects.toThrow("Not a folder")
})
