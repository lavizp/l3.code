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

export const config = {
  dbUrl: required("DB_URL"),
  port: Number(process.env.PORT ?? 8080),

  /** Which registered agent provider runs a turn when nothing else says. */
  defaultAgentId: process.env.AGENT ?? "claude-code",

  /**
   * Tools an agent may use, for providers that take a per-tool allowlist.
   * Codex has no such list — its sandbox is what bounds it — so this only
   * reaches Claude Code.
   */
  allowedTools: ["Read", "Edit", "Glob"] as const
}
