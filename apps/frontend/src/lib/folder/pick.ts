import type { LocateFolderSchemaType } from "commons/types"

/**
 * Open the operating system's own folder chooser.
 *
 * Two APIs do this and neither returns a path — that is the browser drawing
 * a line, not an oversight. What they do return is the folder's name and
 * what's inside it, which is enough for the server to find it again.
 *
 * `showDirectoryPicker` is the better of the two: it reads just the top
 * level. The `webkitdirectory` input has to enumerate every file in the tree
 * to tell us about the first level of it, so it's the fallback, for Firefox
 * and Safari.
 */
export async function pickFolder(): Promise<LocateFolderSchemaType | null> {
  const show = (
    window as unknown as {
      showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<
        FileSystemDirectoryHandle
      >
    }
  ).showDirectoryPicker

  if (show) {
    try {
      return await readTopLevel(await show({ mode: "read" }))
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // Someone closed the dialog. That's an answer, not a failure.
        return null
      }
      // Anything else — an insecure context, a browser that only pretends to
      // have this — is worth falling back for rather than giving up on.
    }
  }

  return pickWithInput()
}

/** What sits directly inside the chosen folder, one cheap pass. */
async function readTopLevel(
  handle: FileSystemDirectoryHandle
): Promise<LocateFolderSchemaType> {
  const entries: LocateFolderSchemaType["entries"] = []
  for await (const [name, child] of (
    handle as unknown as {
      entries: () => AsyncIterable<[string, { kind: "file" | "directory" }]>
    }
  ).entries()) {
    entries.push({ name, kind: child.kind })
  }
  return { name: handle.name, entries }
}

/** The same OS dialog, reached through a file input. */
function pickWithInput(): Promise<LocateFolderSchemaType | null> {
  return new Promise(resolve => {
    const input = document.createElement("input")
    input.type = "file"
    input.webkitdirectory = true
    input.style.display = "none"
    document.body.append(input)

    function done(result: LocateFolderSchemaType | null) {
      input.remove()
      resolve(result)
    }

    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])]
      done(files.length === 0 ? null : summarize(files))
    })
    // Not every browser fires this; without it a cancelled dialog simply
    // leaves the promise unsettled, which the caller survives.
    input.addEventListener("cancel", () => done(null))

    input.click()
  })
}

/** Just the part of a File this needs, so the folding can be tested. */
type RelativeFile = { webkitRelativePath: string }

/**
 * Fold every file in the tree back down to the first level. A path of
 * "repo/src/app.ts" says "src" is a folder; "repo/README.md" says the file
 * is one of the folder's own. Empty sub-folders contain no files, so they
 * leave no trace here — which is why the server treats this as a floor
 * rather than the whole truth.
 */
export function summarize(files: RelativeFile[]): LocateFolderSchemaType {
  const entries = new Map<string, "file" | "directory">()
  const name = files[0]!.webkitRelativePath.split("/")[0] ?? ""

  for (const file of files) {
    const parts = file.webkitRelativePath.split("/")
    const child = parts[1]
    if (!child) {
      continue
    }
    entries.set(child, parts.length > 2 ? "directory" : "file")
  }

  return {
    name,
    entries: [...entries].map(([entryName, kind]) => ({ name: entryName, kind }))
  }
}
