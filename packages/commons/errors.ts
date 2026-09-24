/**
 * What went wrong, in terms both ends of the wire understand.
 *
 * A bare string is enough to print and nothing else: the UI can't tell a
 * plan limit that lifts at four o'clock from a typo in a folder path, so it
 * shows both as the same red line and offers the same nothing. Everything
 * that fails here answers with a `Failure` instead — a kind the UI can
 * branch on, a sentence for the person, and the provider's own words kept
 * aside for when they want them.
 */

export type FailureKind =
  /** The plan's usage allowance is spent. Waiting is the only fix. */
  | "usage-limit"
  /** Throttled for the moment. The same request will work shortly. */
  | "rate-limit"
  /** Not signed in, or the credentials were rejected. */
  | "auth"
  /** Billing: no credits, card declined, account on hold. */
  | "billing"
  /** The agent couldn't reach its API at all. */
  | "connection"
  /** The provider is up but overloaded. */
  | "overloaded"
  /** The agent went quiet for longer than we're willing to wait. */
  | "timeout"
  /** The turn ended without the agent saying anything. */
  | "no-response"
  /** The turn was cut short — the client went away, or asked to stop. */
  | "interrupted"
  /** The agent itself reported a failure we can't classify further. */
  | "agent"
  /** The agent's own binary is missing or wouldn't start. */
  | "agent-unavailable"
  /** The database is unreachable or refused the write. */
  | "database"
  /** The request named something that doesn't exist. */
  | "not-found"
  /** The request was malformed. */
  | "bad-request"
  /** Our bug. */
  | "internal"

export type Failure = {
  kind: FailureKind
  /** One sentence, addressed to the person who is looking at the screen. */
  message: string
  /** The provider's own wording, for a "details" disclosure. */
  detail?: string
  /** Whether sending the same thing again stands a chance. */
  retryable: boolean
  /**
   * Epoch milliseconds at which a limit lifts, when the provider said so.
   * The UI counts down to it and re-enables sending on its own.
   */
  retryAt?: number
}

/**
 * Something worth saying mid-turn that isn't a failure: a retry in progress,
 * an allowance running low. Transient — shown while the turn runs and never
 * persisted, because by the time a transcript is read back it is no longer
 * true.
 */
export type Notice = {
  kind: "retrying" | "usage-warning"
  message: string
  /** Epoch milliseconds the notice refers to, e.g. when an allowance resets. */
  until?: number
}

/** Kinds where sending the same message again is worth offering. */
const RETRYABLE: ReadonlySet<FailureKind> = new Set<FailureKind>([
  "usage-limit",
  "rate-limit",
  "connection",
  "overloaded",
  "timeout",
  "no-response",
  "interrupted",
  "database"
])

export function failure(
  kind: FailureKind,
  message: string,
  extra?: { detail?: string; retryAt?: number; retryable?: boolean }
): Failure {
  return {
    kind,
    message,
    detail: extra?.detail,
    retryAt: extra?.retryAt,
    retryable: extra?.retryable ?? RETRYABLE.has(kind)
  }
}

/**
 * A failure from something that was thrown rather than reported. Used at the
 * outer edges, where all we know is that a promise rejected.
 */
export function unexpectedFailure(cause: unknown, message: string): Failure {
  return failure("internal", message, { detail: describe(cause) })
}

/** The most useful string we can get out of an unknown thrown value. */
export function describe(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message || cause.name
  }
  if (typeof cause === "string") {
    return cause
  }
  try {
    return JSON.stringify(cause)
  } catch {
    return String(cause)
  }
}
