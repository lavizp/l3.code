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

  /** Tools an agent may use. Everything else is refused by the provider. */
  allowedTools: ["Read", "Edit", "Glob"] as const
}
