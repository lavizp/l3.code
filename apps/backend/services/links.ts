import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { fail } from "../errors"

/**
 * Symlinks, the careful way.
 *
 * This is the one part of the app that writes inside somebody's `~/.claude`
 * and `~/.codex`, where everything around it was put there by an agent or by
 * them. So the rule is: create only links, and remove only links we would
 * have created. A directory sitting where a link should go is somebody's
 * actual skill, and replacing it with a pointer somewhere else would delete
 * their work to make a listing tidier.
 */

/**
 * Point `at` to `target`. Idempotent: a link already pointing there is left
 * alone, so projecting the same skill twice is free.
 */
export async function link(target: string, at: string): Promise<void> {
  const existing = await describe(at)

  if (existing === "symlink") {
    const current = await readlink(at).catch(() => null)
    const resolved = current && resolve(dirname(at), current)
    if (resolved === target) {
      return
    }
    // Ours by construction — a link at a skill path we manage — so
    // repointing it is how an edit that moves a skill takes effect.
    await rm(at, { force: true })
  } else if (existing !== "missing") {
    fail(
      "bad-request",
      `There's already a real skill at ${at}. Rename one of them — this app won't replace it with a link.`
    )
  }

  await mkdir(dirname(at), { recursive: true })
  // Relative where both sides share a parent, so a project that gets moved
  // or cloned somewhere else keeps working.
  await symlink(relative(dirname(at), target), at, "dir")
}

/**
 * Remove the link at `at`, but only if it points at `target`.
 *
 * Deleting a skill means cleaning up the links that pointed at it, and the
 * only way to find those without keeping a manifest is to look where they
 * would have been put. That guess can land on a real skill of the same name
 * that somebody wrote by hand — so the guess is never acted on directly.
 * Checking where the link goes turns a wrong guess into nothing at all.
 */
export async function unlink(at: string, target: string): Promise<void> {
  if ((await describe(at)) !== "symlink") {
    return
  }
  const current = await readlink(at).catch(() => null)
  if (current && resolve(dirname(at), current) === target) {
    await rm(at, { force: true })
  }
}

/** Whether `at` is a symlink, something else, or nothing at all. */
async function describe(at: string): Promise<"symlink" | "other" | "missing"> {
  try {
    // lstat rather than stat: the question is what is at the path, not what
    // it points to. A dangling link still has to be replaced.
    return (await lstat(at)).isSymbolicLink() ? "symlink" : "other"
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      return "missing"
    }
    throw cause
  }
}
