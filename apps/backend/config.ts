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

  /** Which registered agent provider runs a turn when nothing else says. */
  defaultAgentId: process.env.AGENT ?? "claude-code",

  /**
   * How long an agent may go without saying anything before the turn is
   * given up on. An agent may work for as long as it likes — tool calls and
   * tokens both count as saying something — but a stream that has gone
   * entirely quiet is indistinguishable from one that will never speak
   * again, and waiting on it forever leaves the UI spinning with no way out.
   */
  agentIdleTimeoutMs: duration("AGENT_IDLE_TIMEOUT_MS", 120_000),

  /**
   * How long to wait for the database before deciding it isn't there. The
   * driver's own default is 30s, which is long enough that a request looks
   * hung rather than failed.
   */
  dbTimeoutMs: duration("DB_TIMEOUT_MS", 5_000),

  /**
   * Tools an agent may use, for providers that take a per-tool allowlist.
   * Codex has no such list — its sandbox is what bounds it — so this only
   * reaches Claude Code.
   */
  allowedTools: ["Read", "Edit", "Glob"] as const
}
