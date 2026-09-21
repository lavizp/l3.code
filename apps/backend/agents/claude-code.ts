import { query } from "@anthropic-ai/claude-agent-sdk"
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

async function* run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
  const stream = query({
    prompt: options.prompt,
    options: {
      cwd: options.cwd,
      allowedTools: [...options.allowedTools],
      resume: options.resumeSessionId,
      permissionMode: "bypassPermissions",
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

    if (event.type === "assistant") {
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
          yield { type: "text-start", blockId: `whole:${blockCount}`, text: block.text }
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
      if (event.subtype !== "success") {
        yield { type: "failed", message: event.errors?.join("\n") || event.subtype }
      }
    }
  }
}
