/**
 * The seam between this server and whatever coding agent actually does the
 * work. Everything upstream of this file — persistence, the websocket
 * protocol, the UI — is written against these types only, so a new agent
 * (Codex, Gemini, a local model) is a new file implementing `AgentProvider`
 * plus one `registerAgent` call. Nothing else has to change.
 */

export type AgentRunOptions = {
  /** What the user asked for on this turn. */
  prompt: string
  /** Directory the agent is allowed to work in. */
  cwd: string
  /**
   * The provider's own conversation id from an earlier turn in this session,
   * when there is one. Providers that can't resume may ignore it.
   */
  resumeSessionId?: string
  /** Tools the agent may call. Anything else should be refused. */
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
  /** The turn failed. The stream is expected to end shortly after. */
  | { type: "failed"; message: string }

export interface AgentProvider {
  /** Stable key used by config and the registry, e.g. "claude-code". */
  readonly id: string
  /** Run one turn, streaming events as they happen. */
  run(options: AgentRunOptions): AsyncIterable<AgentEvent>
}
