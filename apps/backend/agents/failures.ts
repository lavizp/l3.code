import { describe, failure, type Failure, type FailureKind } from "commons/types"

/**
 * Turning whatever an agent said went wrong into a `Failure`.
 *
 * Providers report trouble in whatever shape suits them — an enum here, a
 * thrown `Error` there, a sentence of English somewhere else. Each adapter
 * maps what it gets structurally where it can and falls back to
 * `classifyText` where it can't, so the rest of the server only ever sees
 * one shape and the UI only ever branches on `kind`.
 */

/** How the person should be told, per kind. `{agent}` is the provider's label. */
const COPY: Record<FailureKind, string> = {
  "usage-limit": "{agent} has used up the plan's allowance.",
  "rate-limit": "{agent} is being rate limited — too many requests in a row.",
  auth: "{agent} isn't signed in on this machine.",
  billing: "{agent} can't bill this request.",
  connection: "Couldn't reach {agent}'s API.",
  overloaded: "{agent}'s API is overloaded right now.",
  timeout: "{agent} stopped responding.",
  "no-response": "{agent} finished without saying anything.",
  interrupted: "The turn was cut short.",
  agent: "{agent} couldn't finish the turn.",
  "agent-unavailable": "{agent} isn't installed, or wouldn't start.",
  database: "The server couldn't reach its database.",
  "not-found": "That doesn't exist any more.",
  "bad-request": "The server didn't understand that request.",
  internal: "Something went wrong on the server."
}

/** What to try next, per kind. Appended to the sentence when there is one. */
const ADVICE: Partial<Record<FailureKind, string>> = {
  "usage-limit": "It comes back when the allowance resets.",
  "rate-limit": "Try again in a moment.",
  auth: "Sign in from a terminal, then send the message again.",
  billing: "Check the account's credits or payment method.",
  connection: "Check the machine's network, then try again.",
  overloaded: "Try again in a moment.",
  timeout: "Nothing came back for a while, so the turn was stopped.",
  "agent-unavailable": "Install it, or pick a different agent for a new session."
}

/** Build a failure with this project's phrasing for the kind. */
export function agentFailure(
  kind: FailureKind,
  agentLabel: string,
  extra?: { detail?: string; retryAt?: number }
): Failure {
  const advice = ADVICE[kind]
  const sentence = COPY[kind].replaceAll("{agent}", agentLabel)
  return failure(kind, advice ? `${sentence} ${advice}` : sentence, extra)
}

/**
 * Patterns for the providers that only hand us a sentence. Ordered: the
 * first match wins, so the specific ones come before the general ones.
 */
const PATTERNS: ReadonlyArray<[RegExp, FailureKind]> = [
  [
    /\b(enoent|not found in \$?path|command not found|is not installed)\b/,
    "agent-unavailable"
  ],
  [
    /\b(usage limit|plan limit|weekly limit|monthly limit|quota exceeded|quota exhausted|insufficient_quota|out of credits|credits? required)\b/,
    "usage-limit"
  ],
  [
    /\b(credit balance|payment required|billing|card (was )?declined|account on hold)\b/,
    "billing"
  ],
  [/\b(rate ?limit|too many requests|429|slow down)\b/, "rate-limit"],
  [
    /\b(401|403|unauthorized|forbidden|authentication|invalid api key|missing api key|not logged in|log ?in required|please run .*login|oauth)\b/,
    "auth"
  ],
  [/\b(overloaded|529|at capacity|server is busy)\b/, "overloaded"],
  [
    /\b(econnrefused|econnreset|enotfound|etimedout|eai_again|epipe|socket hang ?up|fetch failed|network (error|unreachable)|dns)\b/,
    "connection"
  ],
  [/\b(timed? ?out|deadline exceeded)\b/, "timeout"],
  [/\b(aborted|cancell?ed|interrupted)\b/, "interrupted"],
  [/\b(5\d\d|internal server error|bad gateway|service unavailable)\b/, "connection"]
]

/**
 * Read a provider's own sentence and guess what class of trouble it is. Only
 * for providers that give us nothing better; anything with a real error code
 * should be mapped structurally in its own adapter.
 */
export function classifyText(text: string): FailureKind {
  const haystack = text.toLowerCase()
  for (const [pattern, kind] of PATTERNS) {
    if (pattern.test(haystack)) {
      return kind
    }
  }
  return "agent"
}

/** Whatever was thrown while a turn was running, as a failure. */
export function classifyThrown(cause: unknown, agentLabel: string): Failure {
  const detail = describe(cause)

  // An abort is our own doing — a disconnect or a stall we gave up on — and
  // the caller has already said why in its own words.
  if (cause instanceof Error && cause.name === "AbortError") {
    return agentFailure("interrupted", agentLabel, { detail })
  }

  // Node puts the useful part of a syscall failure in `code`, not the message.
  const code = (cause as { code?: unknown } | null)?.code
  if (typeof code === "string") {
    return agentFailure(classifyText(`${code} ${detail}`), agentLabel, {
      detail
    })
  }

  return agentFailure(classifyText(detail), agentLabel, { detail })
}

/**
 * Epoch milliseconds from a reset stamp that might be in either unit.
 * Providers are inconsistent about this, and a timestamp in seconds read as
 * milliseconds lands in 1970 — a countdown that has already expired, which
 * is worse than no countdown at all.
 */
export function resetToMillis(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  // Anything below this is too early to be a real reset time in millis.
  return value < 1e12 ? value * 1000 : value
}
