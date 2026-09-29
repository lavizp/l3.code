import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { config } from "../config"

/**
 * A long-lived `codex app-server`, spoken to over JSON-RPC on its stdio.
 *
 * The Codex SDK has no skills API at all — it starts threads and streams
 * turns, and that is the whole surface. The CLI's app-server does: it lists
 * every skill Codex can see for a given directory, with the path, the scope
 * and the owning plugin already worked out, and it watches the files and
 * says when they change. That is exactly the pane's data, from the one
 * program entitled to be authoritative about it, so this is the channel.
 *
 * One process serves every request. Starting it costs a second or so and
 * the answer is wanted on a keystroke, so it is started once and kept.
 */

type Pending = {
  resolve: (value: unknown) => void
  reject: (cause: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

export type SkillsListEntry = {
  cwd: string
  skills: {
    name: string
    description: string
    path: string
    scope: "user" | "repo" | "system" | "admin"
    enabled: boolean
    pluginId: string | null
  }[]
  errors: { path: string; message: string }[]
}

class AppServer {
  private child: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<void> | null = null
  private readonly pending = new Map<number, Pending>()
  private buffer = ""
  private nextId = 1
  private readonly watchers = new Set<() => void>()

  /** Called whenever Codex reports that a watched skill file changed. */
  onChange(listener: () => void): () => void {
    this.watchers.add(listener)
    return () => this.watchers.delete(listener)
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    await this.start()
    return this.send<T>(method, params)
  }

  /** Stop the child, e.g. because the server is shutting down. */
  stop(): void {
    this.child?.kill()
    this.child = null
    this.ready = null
  }

  private start(): Promise<void> {
    // One start, shared by every caller that arrives while it's happening.
    // Without this, a page load that asks three things at once starts three
    // app-servers and keeps the last.
    this.ready ??= this.spawn()
    return this.ready
  }

  private async spawn(): Promise<void> {
    const child = spawn(config.codexCommand, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"]
    })
    this.child = child

    child.stdout.setEncoding("utf8")
    child.stdout.on("data", chunk => this.receive(chunk))

    // Codex logs to stderr. It's noise on a good day and the only
    // explanation on a bad one, so it goes to the log, not to the client.
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", chunk => {
      if (config.debug) {
        console.error("[codex app-server]", String(chunk).trimEnd())
      }
    })

    const gone = (cause: unknown) => {
      // Everything waiting on this process will now wait forever.
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer)
        entry.reject(cause)
        this.pending.delete(id)
      }
      if (this.child === child) {
        this.child = null
        this.ready = null
      }
    }

    child.on("error", cause => gone(cause))
    child.on("exit", code =>
      gone(new Error(`codex app-server exited${code === null ? "" : ` with ${code}`}`))
    )

    await this.send("initialize", {
      clientInfo: { name: "l3.code", title: "l3.code skill pane", version: "0.1.0" }
    })
  }

  private send<T>(method: string, params: unknown): Promise<T> {
    const child = this.child
    if (!child) {
      return Promise.reject(new Error("codex app-server isn't running"))
    }

    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`codex app-server didn't answer "${method}" in time`))
      }, config.codexTimeoutMs)

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      })
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
    })
  }

  /** Line-delimited JSON, reassembled across chunk boundaries. */
  private receive(chunk: string): void {
    this.buffer += chunk
    let cut: number
    while ((cut = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, cut).trim()
      this.buffer = this.buffer.slice(cut + 1)
      if (!line) {
        continue
      }
      try {
        this.dispatch(JSON.parse(line))
      } catch {
        // A line we can't parse is a line from a newer protocol than this
        // knows, not a reason to tear down a working connection.
        if (config.debug) {
          console.error("[codex app-server] unparseable line:", line)
        }
      }
    }
  }

  private dispatch(message: {
    id?: number
    method?: string
    result?: unknown
    error?: { message?: string }
  }): void {
    if (message.method === "skills/changed") {
      for (const watcher of this.watchers) {
        watcher()
      }
      return
    }

    if (typeof message.id !== "number") {
      return
    }
    const entry = this.pending.get(message.id)
    if (!entry) {
      return
    }
    this.pending.delete(message.id)
    clearTimeout(entry.timer)

    if (message.error) {
      entry.reject(new Error(message.error.message ?? "codex app-server refused that"))
      return
    }
    entry.resolve(message.result)
  }
}

export const codexAppServer = new AppServer()

/**
 * Every skill Codex can see from the given directories. `forceReload` skips
 * its cache, which is what a listing taken right after a write needs.
 */
export async function listCodexSkills(
  cwds: string[]
): Promise<{ data: SkillsListEntry[] }> {
  return codexAppServer.request("skills/list", { cwds, forceReload: true })
}
