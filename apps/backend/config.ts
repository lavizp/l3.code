/**
 * Every environment-dependent knob in one place, read once at startup so the
 * rest of the codebase never reaches for `process.env`.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/** A positive number from the environment, or the default when it isn't one. */
function duration(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const config = {
  dbUrl: required("DB_URL"),
  port: Number(process.env.PORT ?? 8080),

  /**
   * The Codex CLI to run `app-server` with. Overridable because Codex is
   * often installed through a version manager, and the shell that starts
   * this server may not be the one that put it on PATH.
   */
  codexCommand: process.env.CODEX_COMMAND ?? "codex",

  /**
   * How long to wait for `codex app-server` to answer. Its first reply
   * includes starting the process and scanning the skill roots, which is
   * slow the once and instant afterwards.
   */
  codexTimeoutMs: duration("CODEX_TIMEOUT_MS", 30_000),

  /** Whether to log what the agents' own processes print. */
  debug: process.env.DEBUG === "1" || process.env.DEBUG === "true",

  /**
   * How long to wait for the database before deciding it isn't there. The
   * driver's own default is 30s, which is long enough that a request looks
   * hung rather than failed.
   */
  dbTimeoutMs: duration("DB_TIMEOUT_MS", 5_000)
}
