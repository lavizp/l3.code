import { readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import type { FolderLocated, LocateFolderSchemaType } from "commons/types"

/**
 * Find where a folder chosen in the browser's own dialog actually lives.
 *
 * The dialog — `showDirectoryPicker`, or a `webkitdirectory` input — gives a
 * folder's name and what's inside it, and deliberately withholds the path.
 * Both halves are enough to find it again from this side: look for folders
 * with that name, and keep the ones whose top level holds everything the
 * browser saw. Two folders matching that closely is rare enough to be worth
 * asking about; usually exactly one does, and nobody types anything.
 */

/** Trees that are enormous, uninteresting, and never somebody's workspace. */
const SKIP = new Set([
  "node_modules",
  ".git",
  ".cache",
  ".npm",
  ".bun",
  ".local",
  ".cargo",
  ".rustup",
  ".nvm",
  ".venv",
  "venv",
  "__pycache__",
  ".next",
  ".turbo",
  ".steam",
  ".var",
  ".wine",
  ".mozilla",
  ".gradle",
  ".m2",
  ".android",
  ".docker",
  "Library",
  "snap"
])

/** Deep enough for where people keep code, shallow enough to stay quick. */
const MAX_DEPTH = 8
/** A backstop, so an unusual home directory can't turn this into a crawl. */
const MAX_VISITED = 20_000
/**
 * Past this many equally good matches the fingerprint has told us nothing,
 * and a longer list is no more useful than a short one plus a way out.
 */
const MAX_CANDIDATES = 25

export async function locateFolder(
  picked: LocateFolderSchemaType,
  /** Where to search from. Anywhere else is a test, or a future setting. */
  from: string = homedir()
): Promise<FolderLocated> {
  // Compare only what both sides can see. A `webkitdirectory` input reports
  // no hidden entries and no empty sub-folders, so the browser's list is a
  // subset of the truth — never an exact copy of it.
  const wanted = new Set(
    picked.entries.filter(e => !e.name.startsWith(".")).map(e => e.name)
  )

  const matches: { path: string; extra: number; depth: number }[] = []
  let visited = 0
  let frontier = [{ path: from, depth: 0 }]

  while (frontier.length > 0 && visited < MAX_VISITED) {
    const next: typeof frontier = []

    for (const { path, depth } of frontier) {
      if (visited++ >= MAX_VISITED) {
        break
      }
      let children
      try {
        children = await readdir(path, { withFileTypes: true })
      } catch {
        // A folder we can't read can't be the one that was picked.
        continue
      }

      for (const child of children) {
        // Real directories only: following symlinks risks walking in circles.
        if (!child.isDirectory()) {
          continue
        }
        const full = join(path, child.name)

        if (child.name === picked.name) {
          const extra = await countExtra(full, wanted)
          if (extra !== null) {
            matches.push({ path: full, extra, depth })
          }
        }
        // Checked for a match before pruning, so a workspace that happens to
        // be called `dist` is still found — we just don't descend into it.
        if (depth < MAX_DEPTH && !SKIP.has(child.name)) {
          next.push({ path: full, depth: depth + 1 })
        }
      }
    }

    frontier = next
  }

  const ranked = matches
    // Tightest fit first: fewest entries the browser didn't account for,
    // then nearest to home, so the obvious answer leads.
    .sort((a, b) => a.extra - b.extra || a.depth - b.depth || a.path.localeCompare(b.path))
    .map(m => m.path)

  return {
    name: picked.name,
    candidates: ranked.slice(0, MAX_CANDIDATES),
    truncated: ranked.length > MAX_CANDIDATES
  }
}

/**
 * How many top-level entries this folder has beyond the ones the browser
 * saw, or null if it's missing any of them — which rules it out.
 */
async function countExtra(path: string, wanted: Set<string>): Promise<number | null> {
  let children: string[]
  try {
    children = await readdir(path)
  } catch {
    return null
  }
  const here = new Set(children.filter(name => !name.startsWith(".")))
  for (const name of wanted) {
    if (!here.has(name)) {
      return null
    }
  }
  return here.size - wanted.size
}
