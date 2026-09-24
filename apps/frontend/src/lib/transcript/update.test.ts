import { expect, test } from "bun:test"
import { endLiveTurns } from "./update"
import { liveId } from "./ids"
import type { UIWorkspace } from "./types"

/**
 * A live turn is only ever closed by the server's `turn-ended`. When the
 * socket dies mid-reply that event never comes, so the client has to close
 * the turn itself — otherwise the caret blinks forever and, because a
 * session has exactly one live id, the next turn can never open either.
 */
function tree(messages: UIWorkspace["sessions"][number]["messages"]): UIWorkspace[] {
  return [
    {
      id: "w1",
      name: "repo",
      path: "/repo",
      sessions: [{ id: "s1", agentId: "claude-code", messages }]
    }
  ]
}

test("closes a turn that was still streaming", () => {
  const before = tree([
    { id: "m1", role: "user", text: "hello" },
    {
      id: liveId("s1"),
      role: "assistant",
      blocks: [{ kind: "text", id: "0", text: "half a th" }],
      running: true
    }
  ])

  const turn = endLiveTurns(before, 1234)[0]!.sessions[0]!.messages[1]!
  if (turn.role !== "assistant") {
    throw new Error("expected the assistant turn")
  }

  expect(turn.running).toBe(false)
  expect(turn.error?.kind).toBe("interrupted")
  // What did arrive is kept: it was really written, and it was really saved.
  expect(turn.blocks).toHaveLength(1)
})

test("frees the live id so the next turn can open", () => {
  const before = tree([
    { id: liveId("s1"), role: "assistant", blocks: [], running: true }
  ])

  const turn = endLiveTurns(before, 1234)[0]!.sessions[0]!.messages[0]!
  expect(turn.id).not.toBe(liveId("s1"))
})

test("drops a notice that is no longer true", () => {
  const before = tree([
    {
      id: liveId("s1"),
      role: "assistant",
      blocks: [],
      running: true,
      notice: { kind: "retrying", message: "Retrying — attempt 1 of 3." }
    }
  ])

  const turn = endLiveTurns(before, 1234)[0]!.sessions[0]!.messages[0]!
  if (turn.role !== "assistant") {
    throw new Error("expected the assistant turn")
  }
  expect(turn.notice).toBeUndefined()
})

test("leaves a settled transcript exactly as it was", () => {
  const before = tree([
    { id: "m1", role: "user", text: "hello" },
    { id: "m2", role: "assistant", blocks: [], running: false }
  ])

  // Same reference, not just equal: an idle reconnect shouldn't re-render
  // every transcript in the app.
  expect(endLiveTurns(before, 1234)).toBe(before)
})
