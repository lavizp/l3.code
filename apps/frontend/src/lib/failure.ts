import type { Failure, FailureKind } from "commons/types"

type Tone = "warn" | "bad"

/** A failure, as a heading and a colour. */
export function present(error: Failure): { title: string; tone: Tone } {
  return { title: TITLES[error.kind] ?? "Something went wrong", tone: TONES[error.kind] ?? "bad" }
}

const TITLES: Partial<Record<FailureKind, string>> = {
  "not-found": "Not there",
  "bad-request": "Can't do that",
  database: "Database",
  connection: "Disconnected",
  auth: "Not signed in",
  "agent-unavailable": "Agent missing",
  internal: "Server error"
}

const TONES: Partial<Record<FailureKind, Tone>> = {
  "not-found": "warn",
  "bad-request": "warn",
  connection: "warn",
  database: "warn"
}

export const TONE_CLASS: Record<Tone, { border: string; bg: string; text: string }> = {
  warn: {
    border: "border-signal/30",
    bg: "bg-signal/5",
    text: "text-signal"
  },
  bad: {
    border: "border-alarm/30",
    bg: "bg-alarm/5",
    text: "text-alarm"
  }
}

/** A wait, said the way a person would: "2m 40s", "8s". */
export function formatWait(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
