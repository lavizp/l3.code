import { expect, test } from "bun:test"
import { summarize } from "./pick"

const files = (...paths: string[]) => paths.map(webkitRelativePath => ({ webkitRelativePath }))

test("takes the folder's name from the first segment", () => {
  expect(summarize(files("repo/README.md")).name).toBe("repo")
})

test("a file one level down is the folder's own", () => {
  expect(summarize(files("repo/README.md")).entries).toEqual([
    { name: "README.md", kind: "file" }
  ])
})

test("anything deeper means the first level is a folder", () => {
  expect(summarize(files("repo/src/app.ts")).entries).toEqual([
    { name: "src", kind: "directory" }
  ])
})

test("reports each top-level entry once, however many files it holds", () => {
  const picked = summarize(
    files("repo/src/a.ts", "repo/src/b.ts", "repo/src/deep/c.ts", "repo/LICENSE")
  )
  expect(picked.entries).toEqual([
    { name: "src", kind: "directory" },
    { name: "LICENSE", kind: "file" }
  ])
})

test("a folder wins over a file of the same name", () => {
  // "dist" appearing as both can only mean the deeper path is the truth.
  expect(summarize(files("repo/dist", "repo/dist/out.js")).entries).toEqual([
    { name: "dist", kind: "directory" }
  ])
})
