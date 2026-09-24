import type { Failure, FailureKind } from "commons/types"

/**
 * How a failure should look and what to call it.
 *
 * The sentence the server sends explains what happened; this is the part
 * that says how much it matters. Two tones only: amber for things that pass
 * on their own — a limit that resets, a socket that reconnects — and red for
 * things that stay broken until somebody does something.
 */
export type Tone = "wait" | "alarm"

const PRESENTATION: Record<FailureKind, { title: string; tone: Tone }> = {
  "usage-limit": { title: "Plan limit reached", tone: "wait" },
  "rate-limit": { title: "Rate limited", tone: "wait" },
  auth: { title: "Not signed in", tone: "alarm" },
  billing: { title: "Billing problem", tone: "alarm" },
  connection: { title: "Can't reach the agent", tone: "wait" },
  overloaded: { title: "Provider overloaded", tone: "wait" },
  timeout: { title: "No response", tone: "alarm" },
  "no-response": { title: "Nothing came back", tone: "alarm" },
  interrupted: { title: "Stopped", tone: "wait" },
  agent: { title: "The agent failed", tone: "alarm" },
  "agent-unavailable": { title: "Agent unavailable", tone: "alarm" },
  database: { title: "Database unavailable", tone: "wait" },
  "not-found": { title: "Gone", tone: "alarm" },
  "bad-request": { title: "Rejected", tone: "alarm" },
  internal: { title: "Server error", tone: "alarm" }
}

const UNKNOWN = { title: "Something went wrong", tone: "alarm" as const }

export function present(error: Failure): { title: string; tone: Tone } {
  return PRESENTATION[error.kind] ?? UNKNOWN
}

/** Tailwind colour for a tone, as the text/border/background triple. */
export const TONE_CLASS: Record<Tone, { text: string; border: string; bg: string }> = {
  wait: { text: "text-signal", border: "border-signal/40", bg: "bg-signal/10" },
  alarm: { text: "text-alarm", border: "border-alarm/40", bg: "bg-alarm/10" }
}

/**
 * A duration as the coarsest useful unit. A limit that lifts in four hours
 * doesn't need its seconds counted, and one that lifts in forty seconds
 * shouldn't round to "0m".
 */
export function formatWait(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** When the clock matters more than the countdown — a reset hours away. */
export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })
}
