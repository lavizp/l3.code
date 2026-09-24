import { query } from "@anthropic-ai/claude-agent-sdk"
import type {
  SDKAssistantMessageError,
  SDKRateLimitInfo
} from "@anthropic-ai/claude-agent-sdk"
import type { Failure, FailureKind, Notice } from "commons/types"
import { agentFailure, classifyText, classifyThrown, resetToMillis } from "./failures"
import { stringifyToolResult } from "./tool-result"
import type { AgentEvent, AgentProvider, AgentRunOptions } from "./types"

/**
 * Claude Code, driven through `@anthropic-ai/claude-agent-sdk`.
 *
 * This file is the only place that knows the SDK's event shapes; its job is
 * to translate them into `AgentEvent`s.
 */
export const claudeCode: AgentProvider = {
  id: "claude-code",
  label: "Claude Code",
  run
}

const LABEL = "Claude Code"

/** The SDK's error enum, in our terms. */
const ERRORS: Record<SDKAssistantMessageError, FailureKind> = {
  authentication_failed: "auth",
  oauth_org_not_allowed: "auth",
  verification_required: "auth",
  cloud_credential_error: "auth",
  account_on_hold: "billing",
  billing_error: "billing",
  rate_limit: "rate-limit",
  overloaded: "overloaded",
  server_error: "connection",
  invalid_request: "agent",
  model_not_found: "agent",
  max_output_tokens: "agent",
  unknown: "agent"
}

async function* run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
  // The SDK cancels on a controller of its own rather than a bare signal, so
  // forward ours onto one. Already-aborted is the case where the client hung
  // up between choosing a turn and starting it.
  const controller = new AbortController()
  const abort = () => controller.abort(options.signal.reason)
  if (options.signal.aborted) {
    abort()
  }
  options.signal.addEventListener("abort", abort, { once: true })

  const stream = query({
    prompt: options.prompt,
    options: {
      cwd: options.cwd,
      allowedTools: [...options.allowedTools],
      resume: options.resumeSessionId,
      permissionMode: "bypassPermissions",
      abortController: controller,
      // Emit Messages API stream events so text arrives token by token
      // instead of only as a finished block.
      includePartialMessages: true
    }
  })

  // Stream events number their blocks per message, so pair a message counter
  // with the block index for an id unique across the turn.
  let messageSeq = 0
  // How many blocks we've opened, used to name blocks that arrive whole.
  let blockCount = 0
  let sawTextDelta = false
  // Set when the plan's allowance runs out. The API reports that as a plain
  // rate limit, so this is what tells the two apart afterwards.
  let spentAllowance: Failure | undefined
  // Whether the turn already explained itself, so the `result` frame doesn't
  // say the same thing again in vaguer words.
  let reported = false

  try {
    for await (const event of stream) {
      // Keep the transcript to the main agent; subagent frames carry a parent
      // tool id and would interleave confusingly.
      if ("parent_tool_use_id" in event && event.parent_tool_use_id) {
        continue
      }

      if (event.type === "stream_event") {
        const raw = event.event

        if (raw.type === "message_start") {
          messageSeq++
          continue
        }

        if (raw.type === "content_block_start" && raw.content_block.type === "text") {
          blockCount++
          yield {
            type: "text-start",
            blockId: `${messageSeq}:${raw.index}`,
            text: raw.content_block.text ?? ""
          }
          continue
        }

        if (raw.type === "content_block_delta" && raw.delta.type === "text_delta") {
          sawTextDelta = true
          yield {
            type: "text-delta",
            blockId: `${messageSeq}:${raw.index}`,
            text: raw.delta.text
          }
        }
        continue
      }

      // The plan's own accounting, which is the only thing that can tell a
      // spent weekly allowance from a burst of requests being throttled.
      if (event.type === "rate_limit_event") {
        const limit = readLimit(event.rate_limit_info)
        if (limit.failure) {
          spentAllowance = limit.failure
        }
        if (limit.notice) {
          yield { type: "notice", notice: limit.notice }
        }
        continue
      }

      if (event.type === "system") {
        // A request failed and is being retried. Say so rather than letting
        // the UI sit on a silent caret for the length of the backoff.
        if (event.subtype === "api_retry") {
          yield {
            type: "notice",
            notice: {
              kind: "retrying",
              message: retryMessage(event.attempt, event.max_retries, event.error),
              until: Date.now() + event.retry_delay_ms
            }
          }
        }
        continue
      }

      if (event.type === "assistant") {
        // An API error arrives as an assistant message carrying an error
        // code and, usually, an apology as its text. The code is the part
        // worth acting on.
        if (event.error) {
          reported = true
          yield {
            type: "failed",
            error: fromErrorCode(event.error, spentAllowance)
          }
          continue
        }

        // Tool calls come from the completed message so the input is whole JSON
        // rather than reassembled partial deltas.
        for (const block of event.message.content) {
          if (block.type === "tool_use") {
            blockCount++
            yield {
              type: "tool-start",
              blockId: `tool:${block.id}`,
              toolUseId: block.id,
              name: block.name,
              input: block.input
            }
          } else if (block.type === "text" && !sawTextDelta) {
            // Fallback for a run that produced no deltas, so text is never
            // silently dropped.
            yield {
              type: "text-start",
              blockId: `whole:${blockCount}`,
              text: block.text
            }
            blockCount++
          }
        }
        continue
      }

      if (event.type === "user") {
        const content = event.message.content
        if (!Array.isArray(content)) {
          continue
        }
        for (const block of content) {
          if (block.type !== "tool_result") {
            continue
          }
          yield {
            type: "tool-end",
            toolUseId: block.tool_use_id,
            result: stringifyToolResult(block.content),
            isError: block.is_error === true
          }
        }
        continue
      }

      if (event.type === "result") {
        if (event.session_id) {
          yield { type: "session", sessionId: event.session_id }
        }
        const error = fromResult(event, spentAllowance)
        if (error && !reported) {
          reported = true
          yield { type: "failed", error }
        }
      }
    }
  } catch (cause) {
    yield { type: "failed", error: classifyThrown(cause, LABEL) }
  } finally {
    options.signal.removeEventListener("abort", abort)
  }
}

/**
 * A result frame, as a failure — or nothing when the turn really did finish.
 *
 * A turn that died on an API error still comes back as `subtype: "success"`,
 * with `is_error` set and the error text where the answer would have been.
 * Reading only the subtype means a plan limit looks exactly like a clean
 * finish with no reply.
 */
function fromResult(
  result: {
    subtype: string
    is_error?: boolean
    errors?: string[]
    result?: string
    api_error_status?: number | null
  },
  spentAllowance: Failure | undefined
): Failure | undefined {
  if (result.subtype === "error_max_turns") {
    return agentFailure("agent", LABEL, {
      detail: "The turn hit the maximum number of steps before it was finished."
    })
  }

  const detail = result.errors?.filter(Boolean).join("\n") || result.result

  if (result.subtype !== "success") {
    return withAllowance(
      agentFailure(detail ? classifyText(detail) : "agent", LABEL, { detail }),
      spentAllowance
    )
  }

  if (!result.is_error) {
    return undefined
  }

  // An HTTP status is a firmer signal than the sentence beside it.
  const kind = fromStatus(result.api_error_status) ?? classifyText(detail ?? "")
  return withAllowance(agentFailure(kind, LABEL, { detail }), spentAllowance)
}

function fromStatus(status: number | null | undefined): FailureKind | undefined {
  if (typeof status !== "number") {
    return undefined
  }
  if (status === 401 || status === 403) {
    return "auth"
  }
  if (status === 402) {
    return "billing"
  }
  if (status === 429) {
    return "rate-limit"
  }
  if (status === 529) {
    return "overloaded"
  }
  if (status >= 500) {
    return "connection"
  }
  return undefined
}

function fromErrorCode(
  code: SDKAssistantMessageError,
  spentAllowance: Failure | undefined
): Failure {
  return withAllowance(
    agentFailure(ERRORS[code] ?? "agent", LABEL, { detail: code }),
    spentAllowance
  )
}

/**
 * Prefer what the plan said over what the API said. The API reports a spent
 * allowance as an ordinary 429, which would otherwise be shown as "try again
 * in a moment" for something that won't come back for hours.
 */
function withAllowance(error: Failure, spentAllowance: Failure | undefined): Failure {
  if (!spentAllowance || error.kind !== "rate-limit") {
    return error
  }
  return { ...spentAllowance, detail: error.detail ?? spentAllowance.detail }
}

/** What the plan's own usage report means for this turn. */
function readLimit(info: SDKRateLimitInfo): {
  failure?: Failure
  notice?: Notice
} {
  const retryAt = resetToMillis(info.resetsAt)

  if (info.status === "rejected") {
    return {
      failure: agentFailure("usage-limit", LABEL, {
        retryAt,
        detail: limitDetail(info)
      })
    }
  }

  if (info.status === "allowed_warning") {
    const used =
      typeof info.utilization === "number" ? Math.round(info.utilization) : undefined
    return {
      notice: {
        kind: "usage-warning",
        message: used
          ? `${used}% of the ${windowName(info.rateLimitType)} allowance is used.`
          : `The ${windowName(info.rateLimitType)} allowance is running low.`,
        until: retryAt
      }
    }
  }

  return {}
}

function limitDetail(info: SDKRateLimitInfo): string {
  const parts = [`${windowName(info.rateLimitType)} limit`]
  if (typeof info.utilization === "number") {
    parts.push(`${Math.round(info.utilization)}% used`)
  }
  if (info.overageDisabledReason) {
    parts.push(`extra usage unavailable (${info.overageDisabledReason})`)
  }
  return parts.join(" · ")
}

/** The plan window a limit belongs to, said the way a person would say it. */
function windowName(type: SDKRateLimitInfo["rateLimitType"]): string {
  switch (type) {
    case "five_hour":
      return "5-hour"
    case "seven_day":
    case "seven_day_overage_included":
      return "weekly"
    case "seven_day_opus":
      return "weekly Opus"
    case "seven_day_sonnet":
      return "weekly Sonnet"
    case "overage":
      return "extra-usage"
    default:
      return "plan"
  }
}

function retryMessage(
  attempt: number,
  maxRetries: number,
  error: SDKAssistantMessageError
): string {
  const reason = ERRORS[error] === "overloaded" ? "the API is busy" : "a hiccup"
  return `Retrying after ${reason} — attempt ${attempt} of ${maxRetries}.`
}
