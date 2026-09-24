/**
 * The seam between this server and whatever coding agent actually does the
 * work. Everything upstream of this file — persistence, the websocket
 * protocol, the UI — is written against these types only, so a new agent
 * (Codex, Gemini, a local model) is a new file implementing `AgentProvider`
 * plus one `registerAgent` call. Nothing else has to change.
 */

import type { Failure, Notice } from "commons/types"

export type AgentRunOptions = {
  /** What the user asked for on this turn. */
  prompt: string
  /** Directory the agent is allowed to work in. */
  cwd: string
  /**
   * Aborted when the turn should stop early — the client went away, or the
   * agent went quiet for too long. A provider is expected to pass this down
   * to whatever it spawns: without it the work carries on unwatched, still
   * spending the plan's allowance on a reply nobody will read.
   */
  signal: AbortSignal
  /**
   * The provider's own conversation id from an earlier turn in this session,
   * when there is one. Providers that can't resume may ignore it.
   */
  resumeSessionId?: string
  /**
   * Tools the agent may call, where the provider has a per-tool allowlist.
   * Providers that bound the agent some other way — a sandbox, say — may
   * have nothing to map this onto and are free to ignore it.
   */
  allowedTools: readonly string[]
}

/**
 * One thing that happened during a turn, in provider-neutral form.
 *
 * `blockId` identifies a renderable piece of the turn and must be stable for
 * the whole turn: deltas are matched back to the block they extend. Providers
 * are free to mint ids however they like as long as they're unique per turn.
 */
export type AgentEvent =
  /** A new piece of prose opened. */
  | { type: "text-start"; blockId: string; text: string }
  /** More text for an already-open prose block. */
  | { type: "text-delta"; blockId: string; text: string }
  /** The agent invoked a tool. Emitted before the result exists. */
  | { type: "tool-start"; blockId: string; toolUseId: string; name: string; input: unknown }
  /** A tool returned. Resolves the matching `tool-start`. */
  | { type: "tool-end"; toolUseId: string; result: string; isError: boolean }
  /** The provider's conversation id, stored so the next turn can resume. */
  | { type: "session"; sessionId: string }
  /**
   * Something the person should know that doesn't end the turn: the provider
   * is retrying after a hiccup, the plan's allowance is nearly spent. A turn
   * carries on after one of these.
   */
  | { type: "notice"; notice: Notice }
  /** The turn failed. The stream is expected to end shortly after. */
  | { type: "failed"; error: Failure }

export interface AgentProvider {
  /** Stable key used by config, the registry and the wire, e.g. "claude-code". */
  readonly id: string
  /** What to call it in the UI, e.g. "Claude Code". */
  readonly label: string
  /** Run one turn, streaming events as they happen. */
  run(options: AgentRunOptions): AsyncIterable<AgentEvent>
}
