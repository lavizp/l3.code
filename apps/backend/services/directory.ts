import { readdir, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import type { DirectoryEntry, DirectoryListing } from "commons/types"

/**
 * Filesystem walking for the folder picker.
 *
 * A workspace is an absolute path, and a browser will not hand one over: a
 * folder input exposes only names relative to whatever was chosen, and the
 * file-system-access API gives a handle with a name and no path at all. So
 * the picker walks the filesystem here instead — the same machine the agent
 * will run on, which is the only place the answer is meaningful.
 */
export async function listDirectory(requested?: string): Promise<DirectoryListing> {
  const path = resolveStart(requested)

  const info = await describeError(path, () => stat(path))
  if (!info.isDirectory()) {
    throw new Error(`Not a folder: ${path}`)
  }

  const entries = await describeError(path, () =>
    readdir(path, { withFileTypes: true })
  )
  const folders = await Promise.all(
    entries
      // Folders only, and not the dot-directories that would bury a home
      // directory under caches and config. Those are still reachable by
      // typing the path into the picker.
      .filter(e => !e.name.startsWith(".") && (e.isDirectory() || e.isSymbolicLink()))
      .map(e => describe(path, e.name, e.isDirectory()))
  )

  const parent = dirname(path)
  return {
    path,
    // At the root, dirname is the path itself: nowhere left to go up to.
    parent: parent === path ? null : parent,
    entries: folders
      .filter((e): e is DirectoryEntry => e !== null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }
}

/**
 * A listable entry, or null if it isn't one. Symlinks are followed because a
 * project linked into place is still a project; a dangling one is dropped
 * rather than offered as a folder that can't be opened.
 */
async function describe(
  parent: string,
  name: string,
  isDirectory: boolean
): Promise<DirectoryEntry | null> {
  const path = join(parent, name)
  if (isDirectory) {
    return { name, path }
  }
  try {
    return (await stat(path)).isDirectory() ? { name, path } : null
  } catch {
    return null
  }
}

/**
 * Filesystem errors reach the picker verbatim, and a raw `ENOENT: ... stat
 * '/x'` is noise to someone who just mistyped a folder. Translate the cases
 * a person actually hits and leave anything unexpected alone.
 */
async function describeError<T>(path: string, read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === "ENOENT") {
      throw new Error(`No such folder: ${path}`)
    }
    if (code === "EACCES" || code === "EPERM") {
      throw new Error(`Not allowed to read ${path}`)
    }
    if (code === "ENOTDIR") {
      throw new Error(`Not a folder: ${path}`)
    }
    throw e
  }
}

/** Where to start: what was asked for, or the home directory. */
function resolveStart(requested?: string): string {
  const trimmed = requested?.trim()
  if (!trimmed) {
    return homedir()
  }
  // "~" is a shell convenience that means nothing to the filesystem, but it
  // is what someone types. Only the home form — "~user" isn't ours to guess.
  const expanded =
    trimmed === "~" || trimmed.startsWith("~/")
      ? join(homedir(), trimmed.slice(1))
      : trimmed
  return resolve(expanded)
}
