import { afterEach, beforeEach, expect, test } from "bun:test"
import { lstat, mkdir, mkdtemp, readlink, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { link, unlink } from "./links"

/**
 * These run against a real temporary tree because the thing being tested is
 * what happens on a filesystem that already has something on it — which is
 * the situation in everybody's `~/.claude/skills`.
 */
let root: string
let target: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "links-"))
  target = join(root, "store", "my-skill")
  await mkdir(target, { recursive: true })
  await writeFile(join(target, "SKILL.md"), "---\nname: my-skill\n---\n")
  await mkdir(join(root, "agent"), { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

test("links relatively, so a moved or cloned repo keeps working", async () => {
  const at = join(root, "agent", "my-skill")
  await link(target, at)

  const pointer = await readlink(at)
  expect(pointer.startsWith("/")).toBe(false)
  expect(resolve(join(root, "agent"), pointer)).toBe(target)
})

test("linking twice is free", async () => {
  const at = join(root, "agent", "my-skill")
  await link(target, at)
  await link(target, at)
  expect((await lstat(at)).isSymbolicLink()).toBe(true)
})

test("repoints a link of ours that goes somewhere else", async () => {
  const at = join(root, "agent", "my-skill")
  const elsewhere = join(root, "store", "old")
  await mkdir(elsewhere, { recursive: true })
  await link(elsewhere, at)
  await link(target, at)
  expect(resolve(join(root, "agent"), await readlink(at))).toBe(target)
})

test("refuses to replace a real directory with a link", async () => {
  // Somebody's actual skill, written by hand. Replacing it with a pointer
  // somewhere else would delete their work to make a listing tidier.
  const at = join(root, "agent", "my-skill")
  await mkdir(at, { recursive: true })
  await writeFile(join(at, "SKILL.md"), "---\nname: theirs\n---\n")

  await expect(link(target, at)).rejects.toThrow(/already a real skill/)
  expect((await lstat(at)).isDirectory()).toBe(true)
})

test("removes a link that points at the skill being deleted", async () => {
  const at = join(root, "agent", "my-skill")
  await link(target, at)
  await unlink(at, target)
  await expect(lstat(at)).rejects.toThrow()
})

test("leaves a link that points somewhere else", async () => {
  // Deleting a skill means guessing where its links were put, and that
  // guess can land on an unrelated skill with the same name.
  const at = join(root, "agent", "my-skill")
  const other = join(root, "store", "someone-elses")
  await mkdir(other, { recursive: true })
  await link(other, at)

  await unlink(at, target)
  expect((await lstat(at)).isSymbolicLink()).toBe(true)
})

test("leaves a real directory alone", async () => {
  const at = join(root, "agent", "my-skill")
  await mkdir(at, { recursive: true })
  await unlink(at, target)
  expect((await lstat(at)).isDirectory()).toBe(true)
})

test("a missing link is the outcome that was asked for", async () => {
  await unlink(join(root, "agent", "nothing-here"), target)
})
