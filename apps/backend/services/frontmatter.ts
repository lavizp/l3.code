import { parse, stringify } from "yaml"
import { fail } from "../errors"

/**
 * The YAML block at the top of a `SKILL.md`, and the markdown under it.
 *
 * Every agent here reads the same shape — `---`, YAML, `---`, then prose —
 * and each honours a different subset of the keys, ignoring the rest in
 * silence. That is what lets one file serve all of them, and it is also why
 * nothing in this file drops a key it doesn't recognise: an unknown key is
 * far more likely to be another agent's than a mistake.
 */

export type Frontmatter = Record<string, unknown>

export type Parsed = {
  frontmatter: Frontmatter
  body: string
}

// Leading whitespace is tolerated because editors add it; the closing fence
// has to be on a line of its own, which is what stops a `---` horizontal
// rule in the prose from ending the block early.
const FENCE = /^﻿?\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/

/**
 * Split a `SKILL.md` into its frontmatter and its body.
 *
 * A file with no frontmatter at all parses to empty rather than failing:
 * it's a file someone is part-way through writing, and refusing to open it
 * in the editor is the one response that makes it impossible to fix.
 */
export function parseSkill(raw: string): Parsed {
  const match = FENCE.exec(raw)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  let parsed: unknown
  try {
    parsed = parse(match[1] ?? "")
  } catch (cause) {
    fail("bad-request", "The frontmatter at the top of this skill isn't valid YAML.", {
      detail: cause instanceof Error ? cause.message : String(cause)
    })
  }

  // `---\n\n---` parses to null, and a YAML scalar or list is valid YAML but
  // not frontmatter. Both are "no keys" rather than an error.
  const frontmatter =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Frontmatter)
      : {}

  return { frontmatter, body: match[2] ?? "" }
}

/** The inverse: one file from a frontmatter block and a body. */
export function serialiseSkill(frontmatter: Frontmatter, body: string): string {
  const yaml = stringify(frontmatter, { lineWidth: 0 }).trimEnd()
  return `---\n${yaml}\n---\n\n${body.replace(/^\n+/, "").trimEnd()}\n`
}

/**
 * The two keys every agent reads, as strings, or a refusal naming the one
 * that's missing.
 *
 * These are not a formality. An agent decides whether a skill applies from
 * its name and description alone — the body is only read afterwards — so a
 * skill missing either is a skill that will never be chosen, and saving one
 * silently would look exactly like saving one that works.
 */
export function requireIdentity(frontmatter: Frontmatter): {
  name: string
  description: string
} {
  const name = frontmatter.name
  const description = frontmatter.description

  if (typeof name !== "string" || !name.trim()) {
    fail("bad-request", "A skill needs a `name` in its frontmatter.")
  }
  if (typeof description !== "string" || !description.trim()) {
    fail(
      "bad-request",
      "A skill needs a `description` — it's the only thing an agent reads when deciding whether the skill applies."
    )
  }
  return { name: name.trim(), description: description.trim() }
}

/** The name and description as they are, for listing a file we didn't write. */
export function identityOf(
  frontmatter: Frontmatter,
  fallbackName: string
): { name: string; description: string } {
  const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : ""
  const description =
    typeof frontmatter.description === "string" ? frontmatter.description.trim() : ""
  return {
    name: name || fallbackName,
    description: description || "No description — no agent will choose this skill."
  }
}
