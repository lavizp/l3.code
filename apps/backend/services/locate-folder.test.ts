import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { locateFolder } from "./locate-folder"

/**
 * Two folders called `repo` that differ only in their contents, one of them
 * buried, plus a decoy behind a folder the search is supposed to prune.
 */
let root: string

async function project(path: string, children: string[]) {
  await mkdir(path, { recursive: true })
  for (const child of children) {
    if (child.includes(".")) {
      await writeFile(join(path, child), "")
    } else {
      await mkdir(join(path, child), { recursive: true })
    }
  }
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "locate-"))
  await project(join(root, "work", "repo"), ["src", "README.md", ".git"])
  await project(join(root, "archive", "old", "repo"), ["docs", "LICENSE"])
  await project(join(root, "node_modules", "buried", "repo"), ["src", "README.md"])
  await project(join(root, "twin-a", "repo"), ["src", "README.md"])
  await project(join(root, "twin-b", "repo"), ["src", "README.md"])
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

const picked = (name: string, entries: string[]) => ({
  name,
  entries: entries.map(e => ({
    name: e,
    kind: (e.includes(".") ? "file" : "directory") as "file" | "directory"
  }))
})

test("finds the folder whose contents match", async () => {
  const { candidates } = await locateFolder(picked("repo", ["docs", "LICENSE"]), root)
  expect(candidates).toEqual([join(root, "archive", "old", "repo")])
})

test("rules out folders missing anything the browser saw", async () => {
  const { candidates } = await locateFolder(picked("repo", ["src", "nope"]), root)
  expect(candidates).toEqual([])
})

test("ignores hidden entries, which only one side can see", async () => {
  // The real folder has .git; a webkitdirectory input would never report it.
  const { candidates } = await locateFolder(picked("repo", ["src", "README.md"]), root)
  expect(candidates).toContain(join(root, "work", "repo"))
})

test("never descends into node_modules", async () => {
  const { candidates } = await locateFolder(picked("repo", ["src", "README.md"]), root)
  expect(candidates.some(c => c.includes("node_modules"))).toBe(false)
})

test("returns every equally good match, shallowest first", async () => {
  const { candidates } = await locateFolder(picked("repo", ["src", "README.md"]), root)
  expect(candidates).toEqual([
    join(root, "twin-a", "repo"),
    join(root, "twin-b", "repo"),
    join(root, "work", "repo")
  ])
})

test("prefers the tightest fit over a folder with extras", async () => {
  const { candidates } = await locateFolder(picked("repo", ["src"]), root)
  // twin-a/b hold src + README.md; work/repo holds those plus .git, which is
  // hidden and so uncounted. All three carry one extra, so depth decides.
  expect(candidates[0]).toBe(join(root, "twin-a", "repo"))
})

test("an empty pick matches by name alone", async () => {
  const { candidates } = await locateFolder(picked("repo", []), root)
  expect(candidates.length).toBe(4)
})

test("reports the name it was looking for", async () => {
  const located = await locateFolder(picked("nothing-here", []), root)
  expect(located).toEqual({ name: "nothing-here", candidates: [], truncated: false })
})

test("says so rather than listing every match forever", async () => {
  const many = join(root, "many")
  for (let i = 0; i < 30; i++) {
    await project(join(many, `holder-${i}`, "same"), ["src"])
  }
  const located = await locateFolder(picked("same", ["src"]), many)
  expect(located.candidates.length).toBe(25)
  expect(located.truncated).toBe(true)
})
