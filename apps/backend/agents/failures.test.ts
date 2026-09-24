import { expect, test } from "bun:test"
import { agentFailure, classifyText, classifyThrown, resetToMillis } from "./failures"

/**
 * The sentences here are the shapes the two CLIs actually produce. They are
 * the whole input for providers that report trouble as prose, so the cost of
 * getting one wrong is a plan limit shown as "the agent failed" — with a
 * "send again" button that spends the next hour failing the same way.
 */

test("reads a spent allowance as a limit rather than a throttle", () => {
  expect(classifyText("You've reached your usage limit. Resets 4:00 PM.")).toBe(
    "usage-limit"
  )
  expect(classifyText("Weekly limit reached for Opus")).toBe("usage-limit")
  expect(classifyText("quota exceeded for this organization")).toBe("usage-limit")
})

test("tells a passing throttle from a spent allowance", () => {
  expect(classifyText("429 Too Many Requests")).toBe("rate-limit")
  expect(classifyText("rate limit exceeded, retry shortly")).toBe("rate-limit")
})

test("recognises the cases a person has to go and fix", () => {
  expect(classifyText("401 Unauthorized")).toBe("auth")
  expect(classifyText("Not logged in. Run `codex login`.")).toBe("auth")
  expect(classifyText("invalid api key provided")).toBe("auth")
  expect(classifyText("Your credit balance is too low")).toBe("billing")
})

test("recognises the machine being unable to reach anything", () => {
  expect(classifyText("connect ECONNREFUSED 127.0.0.1:443")).toBe("connection")
  expect(classifyText("getaddrinfo ENOTFOUND api.example.com")).toBe("connection")
  expect(classifyText("fetch failed")).toBe("connection")
  expect(classifyText("502 Bad Gateway")).toBe("connection")
})

test("recognises a missing binary, which no amount of retrying fixes", () => {
  expect(classifyText("spawn codex ENOENT")).toBe("agent-unavailable")
})

test("falls back to a plain agent failure rather than guessing", () => {
  expect(classifyText("the model produced something unexpected")).toBe("agent")
})

test("an abort is reported as an interruption, not a crash", () => {
  const aborted = new Error("aborted")
  aborted.name = "AbortError"
  expect(classifyThrown(aborted, "Codex").kind).toBe("interrupted")
})

test("a syscall failure is read from its code, not its wording", () => {
  const thrown = Object.assign(new Error("spawn failed"), {
    code: "ECONNREFUSED"
  })
  expect(classifyThrown(thrown, "Claude Code").kind).toBe("connection")
})

test("a failure says what to do about it, and whether to offer a retry", () => {
  const limit = agentFailure("usage-limit", "Claude Code", {
    retryAt: 1_700_000_000_000
  })
  expect(limit.message).toContain("Claude Code")
  expect(limit.message).toContain("allowance")
  expect(limit.retryable).toBe(true)
  expect(limit.retryAt).toBe(1_700_000_000_000)

  // Nothing about sending the same message again signs anybody in.
  expect(agentFailure("auth", "Codex").retryable).toBe(false)
  expect(agentFailure("agent-unavailable", "Codex").retryable).toBe(false)
})

test("a reset time in seconds is not read as one in 1970", () => {
  const seconds = 1_700_000_000
  expect(resetToMillis(seconds)).toBe(seconds * 1000)
  expect(resetToMillis(seconds * 1000)).toBe(seconds * 1000)
  expect(resetToMillis(undefined)).toBeUndefined()
  expect(resetToMillis(0)).toBeUndefined()
})
