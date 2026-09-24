import { Codex, type ThreadItem, type ThreadOptions } from "@openai/codex-sdk"
import type { Failure } from "commons/types"
import { agentFailure, classifyText, classifyThrown } from "./failures"
import { stringifyToolResult } from "./tool-result"
import type { AgentEvent, AgentProvider, AgentRunOptions } from "./types"

/**
 * Codex, driven through `@openai/codex-sdk`.
 *
 * The SDK shells out to the `codex` CLI and reports progress as thread
 * *items* rather than token deltas: an item appears, is revised in place,
 * then completes. This file is the only place that knows that shape; its job
 * is to fold it into the `AgentEvent`s the rest of the server speaks.
 *
 * Credentials come from the ambient environment — whatever `codex login`
 * wrote to `~/.codex`, or `CODEX_API_KEY` — exactly as the CLI would find
 * them, so there is nothing to configure here.
 */
export const codex: AgentProvider = {
  id: "codex",
  label: "Codex",
  run
}

const client = new Codex()

const LABEL = "Codex"

async function* run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
  // Codex reports trouble as a sentence and nothing else, so everything here
  // is read back out of the text. Where the SDK throws instead — the binary
  // missing, `codex login` never run — the throw is classified the same way.
  try {
    const thread = options.resumeSessionId
      ? client.resumeThread(options.resumeSessionId, threadOptions(options))
      : client.startThread(threadOptions(options))

    const { events } = await thread.runStreamed(options.prompt, {
      signal: options.signal
    })

    // Codex resends a message whole every time it grows, so remember what the
    // client has already been told and send only the new tail.
    const sent = new Map<string, string>()
    // Items we've already opened a tool block for, so a revision doesn't open
    // a second one and a completion can close one we somehow never started.
    const opened = new Set<string>()

    for await (const event of events) {
      switch (event.type) {
        case "thread.started":
          yield { type: "session", sessionId: event.thread_id }
          break

        case "item.started":
        case "item.updated":
        case "item.completed":
          yield* translate(event.item, event.type === "item.completed", sent, opened)
          break

        case "turn.failed":
          yield { type: "failed", error: fromMessage(event.error.message) }
          break

        case "error":
          yield { type: "failed", error: fromMessage(event.message) }
          break
      }
    }
  } catch (cause) {
    yield { type: "failed", error: classifyThrown(cause, LABEL) }
  }
}

/** Codex's own sentence, read for what kind of trouble it describes. */
function fromMessage(message: string): Failure {
  return agentFailure(classifyText(message), LABEL, { detail: message })
}

function threadOptions(options: AgentRunOptions): ThreadOptions {
  return {
    workingDirectory: options.cwd,
    // The counterpart to the Claude adapter's `bypassPermissions`: free rein
    // inside the workspace, never stopping to ask. Codex has no per-tool
    // allowlist, so `options.allowedTools` has nothing to map onto — the
    // sandbox is what bounds it instead.
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    // A workspace here is any folder the user pointed us at, git or not.
    skipGitRepoCheck: true
  }
}

/** One thread item, as the events it means for the transcript. */
function* translate(
  item: ThreadItem,
  done: boolean,
  sent: Map<string, string>,
  opened: Set<string>
): Generator<AgentEvent> {
  switch (item.type) {
    case "agent_message":
      yield* prose(item.id, item.text, sent)
      return

    case "command_execution":
      yield* openTool(item, "Bash", { command: item.command }, opened)
      if (done) {
        yield {
          type: "tool-end",
          toolUseId: item.id,
          result: item.aggregated_output,
          isError: item.status === "failed" || (item.exit_code ?? 0) !== 0
        }
      }
      return

    case "file_change":
      // `path` is what a collapsed tool row shows, so name the file when
      // there's one and say how many when the patch spans several.
      yield* openTool(
        item,
        "Edit",
        {
          path:
            item.changes.length === 1
              ? item.changes[0]!.path
              : `${item.changes.length} files`,
          changes: item.changes
        },
        opened
      )
      if (done) {
        yield {
          type: "tool-end",
          toolUseId: item.id,
          result: item.changes.map(c => `${c.kind} ${c.path}`).join("\n"),
          isError: item.status === "failed"
        }
      }
      return

    case "mcp_tool_call":
      yield* openTool(item, `${item.server}.${item.tool}`, item.arguments, opened)
      if (done) {
        yield {
          type: "tool-end",
          toolUseId: item.id,
          result: item.error?.message ?? stringifyToolResult(item.result?.content),
          isError: item.status === "failed"
        }
      }
      return

    case "web_search":
      yield* openTool(item, "WebSearch", { query: item.query }, opened)
      if (done) {
        yield { type: "tool-end", toolUseId: item.id, result: item.query, isError: false }
      }
      return

    case "error":
      // Non-fatal: the turn carries on. Show it where it happened rather
      // than failing the whole turn over it.
      yield* openTool(item, "Error", { message: item.message }, opened)
      yield { type: "tool-end", toolUseId: item.id, result: item.message, isError: true }
      return

    // Reasoning summaries and the running to-do list are the agent thinking
    // out loud; the transcript shows what it wrote and what it did.
    case "reasoning":
    case "todo_list":
      return
  }
}

/**
 * Emit only the part of an agent message the client hasn't seen. Codex sends
 * the message whole each time, and the wire protocol can only append, so a
 * message that grew becomes a delta of its tail.
 */
function* prose(
  id: string,
  text: string,
  sent: Map<string, string>
): Generator<AgentEvent> {
  const already = sent.get(id)

  if (already === undefined) {
    sent.set(id, text)
    yield { type: "text-start", blockId: id, text }
    return
  }
  if (text === already || !text.startsWith(already)) {
    // Unchanged, or rewritten rather than extended. There's no way to retract
    // text we've already sent, so leave the block as the client has it.
    return
  }

  sent.set(id, text)
  yield { type: "text-delta", blockId: id, text: text.slice(already.length) }
}

/** Open a tool block for an item the first time we see it. */
function* openTool(
  item: { id: string },
  name: string,
  input: unknown,
  opened: Set<string>
): Generator<AgentEvent> {
  if (opened.has(item.id)) {
    return
  }
  opened.add(item.id)
  yield { type: "tool-start", blockId: `tool:${item.id}`, toolUseId: item.id, name, input }
}
