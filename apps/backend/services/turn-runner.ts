import {
  describe,
  failure,
  type Failure,
  type OutgoingMessageType,
  type TurnStatus
} from "commons/types"
import { getAgent } from "../agents"
import { agentFailure, classifyThrown } from "../agents/failures"
import { config } from "../config"
import { fail, FailureError } from "../errors"
import { databaseFailure } from "../repositories/failure"
import {
  appendAssistantBlocks,
  appendUserMessage,
  saveAgentSessionId
} from "../repositories/sessions"
import { findWorkspaceById } from "../repositories/workspaces"
import { TurnBlocks } from "./turn-blocks"
import { withIdleTimeout } from "./watchdog"

export type Emit = (message: OutgoingMessageType) => void

/**
 * Persist the user's message, echo it back straight away, then stream the
 * agent's reply block by block. Nothing here waits for the turn to finish
 * before the client hears about it.
 *
 * Which agent runs is the session's own, chosen when it was created.
 *
 * Whatever happens in between, this ends with exactly one `turn-ended`. The
 * client opens a live assistant message on `turn-started` and has no other
 * way to close it: a turn that throws its way out of here without that
 * closing event leaves a caret blinking until the page is reloaded.
 */
export async function runTurn(params: {
  sessionId: string
  message: string
  emit: Emit
  /** Aborted to stop the turn early. */
  signal: AbortSignal
}): Promise<void> {
  const { sessionId, message, emit, signal } = params

  // Everything before `turn-started` is allowed to throw: the client is not
  // yet showing a live turn, so the router's error reply is the whole story.
  const appended = await appendUserMessage(sessionId, message).catch(cause => {
    throw new FailureError(databaseFailure(cause, "session"))
  })
  if (!appended) {
    fail("not-found", "That session no longer exists.")
  }

  const workspace = await findWorkspaceById(appended.session.workspaceId).catch(cause => {
    throw new FailureError(databaseFailure(cause, "workspace"))
  })
  if (!workspace) {
    fail("not-found", "This session's folder is no longer registered.")
  }

  // A session pinned to an agent that is no longer registered can't run at
  // all; say which one rather than letting the registry's own wording out.
  let agent
  try {
    agent = getAgent(appended.session.agentId)
  } catch (cause) {
    fail(
      "not-found",
      `This session's agent, "${appended.session.agentId}", isn't available on this server.`,
      { detail: describe(cause) }
    )
  }

  // Echo the user's own message before the agent runs, so it appears the
  // moment they hit send rather than after the whole reply lands.
  emit({
    type: "message-added",
    payload: { id: appended.messageId, sessionId, role: "user", message }
  })
  emit({ type: "turn-started", payload: { sessionId } })

  const turn = new TurnBlocks()
  let agentSessionId = appended.session.agentSessionId
  let error: Failure | undefined

  // The agent gets a controller of our own so a stall can stop it, chained
  // to the caller's so a disconnect still does.
  const controller = new AbortController()
  const stopOuter = () => controller.abort(signal.reason)
  signal.addEventListener("abort", stopOuter, { once: true })

  try {
    const stream = withIdleTimeout(
      agent.run({
        prompt: message,
        cwd: workspace.path,
        resumeSessionId: agentSessionId,
        allowedTools: config.allowedTools,
        signal: controller.signal
      }),
      {
        idleMs: config.agentIdleTimeoutMs,
        onStall: () => {
          error = agentFailure("timeout", agent.label, {
            detail: `Nothing for ${Math.round(config.agentIdleTimeoutMs / 1000)}s.`
          })
          controller.abort(new Error("The agent stopped responding."))
        }
      }
    )

    for await (const event of stream) {
      switch (event.type) {
        case "text-start":
          turn.openText(event.blockId, event.text)
          emit({
            type: "block-start",
            payload: { sessionId, blockId: event.blockId, text: event.text }
          })
          break

        case "text-delta":
          turn.appendText(event.blockId, event.text)
          emit({
            type: "block-delta",
            payload: { sessionId, blockId: event.blockId, text: event.text }
          })
          break

        case "tool-start":
          turn.openTool(event.blockId, event.toolUseId, event.name, event.input)
          emit({
            type: "tool-start",
            payload: {
              sessionId,
              blockId: event.blockId,
              toolUseId: event.toolUseId,
              name: event.name,
              input: event.input
            }
          })
          break

        case "tool-end":
          turn.closeTool(event.toolUseId, event.result, event.isError)
          emit({
            type: "tool-end",
            payload: {
              sessionId,
              toolUseId: event.toolUseId,
              result: event.result,
              isError: event.isError
            }
          })
          break

        case "session":
          // Only the first one matters: that's the thread we resume into.
          if (!agentSessionId) {
            agentSessionId = event.sessionId
            // Losing this costs the next turn its context, which is a worse
            // turn rather than a failed one. Not reason enough to abandon a
            // reply that is already arriving.
            await saveAgentSessionId(sessionId, agent.id, event.sessionId).catch(
              cause => {
                console.error("Couldn't store the agent's session id:", cause)
              }
            )
          }
          break

        case "notice":
          emit({
            type: "notice",
            payload: { sessionId, notice: event.notice }
          })
          break

        case "failed":
          // First failure wins: a provider that reports one and then falls
          // over on the way out would otherwise overwrite the useful reason
          // with a vaguer one.
          error ??= event.error
          break
      }
    }
  } catch (cause) {
    // A stall aborts the stream on purpose, so the abort it throws is the
    // stall we already recorded, not news.
    error ??= classifyThrown(cause, agent.label)
    console.error("Agent turn failed:", cause)
  } finally {
    signal.removeEventListener("abort", stopOuter)
    controller.abort()
  }

  // The client hung up mid-turn. Nothing can be sent, but the work that was
  // done still belongs in the transcript for when they come back.
  if (signal.aborted) {
    error ??= failure("interrupted", "The turn stopped when the connection dropped.")
  }

  for (const tool of turn.abandonRunningTools()) {
    emit({
      type: "tool-end",
      payload: {
        sessionId,
        toolUseId: tool.toolUseId,
        result: tool.result!,
        isError: true
      }
    })
  }

  // A turn that ended cleanly and said nothing at all is a failure the agent
  // didn't report: something swallowed the reply. Saying so beats an empty
  // bubble that looks like it worked.
  if (!error && turn.isEmpty) {
    error = agentFailure("no-response", agent.label)
  }

  let persistedId: string | null = null
  if (!turn.isEmpty) {
    // A transcript we couldn't save is a smaller problem than a turn that
    // never ends, so a write that fails is reported rather than thrown.
    try {
      persistedId = await appendAssistantBlocks(sessionId, turn.blocks)
    } catch (cause) {
      console.error("Couldn't save the assistant turn:", cause)
      error ??= databaseFailure(cause, "session")
    }
  }

  const status: TurnStatus = !error
    ? "done"
    : error.kind === "interrupted"
      ? "cancelled"
      : "error"

  emit({
    type: "turn-ended",
    payload: { sessionId, id: persistedId, status, error }
  })
}
