import { expect, test } from "bun:test"
import { identityOf, parseSkill, requireIdentity, serialiseSkill } from "./frontmatter"

test("splits a SKILL.md into frontmatter and body", () => {
  const { frontmatter, body } = parseSkill(
    "---\nname: pdf\ndescription: Read a PDF.\n---\n\n# pdf\n\nBody.\n"
  )
  expect(frontmatter).toEqual({ name: "pdf", description: "Read a PDF." })
  expect(body).toBe("\n# pdf\n\nBody.\n")
})

test("keeps keys it has never heard of", () => {
  // The whole reason one file can serve several agents is that each ignores
  // what it doesn't know. Dropping an unknown key on save would delete
  // another agent's configuration to tidy up ours.
  const { frontmatter } = parseSkill(
    "---\nname: x\ndescription: y\nsome-future-agent: true\n---\n\nBody\n"
  )
  expect(frontmatter["some-future-agent"]).toBe(true)
})

test("a --- inside the body doesn't end the frontmatter", () => {
  const { frontmatter, body } = parseSkill(
    "---\nname: x\ndescription: y\n---\n\nAbove\n\n---\n\nBelow\n"
  )
  expect(frontmatter.name).toBe("x")
  expect(body).toContain("Below")
})

test("a file with no frontmatter opens rather than failing", () => {
  // Somebody part-way through writing one. Refusing to open it is the one
  // response that makes it impossible to fix.
  const { frontmatter, body } = parseSkill("# just markdown\n")
  expect(frontmatter).toEqual({})
  expect(body).toBe("# just markdown\n")
})

test("an empty frontmatter block is no keys, not an error", () => {
  expect(parseSkill("---\n\n---\n\nBody\n").frontmatter).toEqual({})
})

test("refuses frontmatter that isn't YAML", () => {
  expect(() => parseSkill("---\nname: [unclosed\n---\n\nBody\n")).toThrow(
    /isn't valid YAML/
  )
})

test("requires the two fields every agent reads", () => {
  expect(() => requireIdentity({ description: "y" })).toThrow(/needs a `name`/)
  expect(() => requireIdentity({ name: "x" })).toThrow(/needs a `description`/)
  expect(() => requireIdentity({ name: "x", description: "   " })).toThrow(
    /needs a `description`/
  )
  expect(requireIdentity({ name: " x ", description: " y " })).toEqual({
    name: "x",
    description: "y"
  })
})

test("listing a file we didn't write falls back rather than refusing", () => {
  const { name, description } = identityOf({}, "on-disk-name")
  expect(name).toBe("on-disk-name")
  expect(description).toMatch(/no agent will choose/)
})

test("round-trips through serialise", () => {
  const raw = serialiseSkill({ name: "x", description: "y" }, "Body.")
  expect(raw).toBe("---\nname: x\ndescription: y\n---\n\nBody.\n")
  expect(parseSkill(raw).frontmatter).toEqual({ name: "x", description: "y" })
})

test("a long description stays on one line", () => {
  // Wrapped YAML still parses, but it makes the file unpleasant to edit by
  // hand, and these files are edited by hand.
  const description = "A ".repeat(120).trim()
  const raw = serialiseSkill({ name: "x", description }, "Body.")
  expect(raw.split("\n").filter(l => l.startsWith("description:"))).toHaveLength(1)
  expect(parseSkill(raw).frontmatter.description).toBe(description)
})
