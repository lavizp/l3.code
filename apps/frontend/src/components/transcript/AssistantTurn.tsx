import { Markdown } from "../../lib/markdown"
import type { UIAssistantMessage } from "../../lib/transcript"
import { ToolRow } from "./ToolRow"

export function AssistantTurn({
  message,
  workspacePath
}: {
  message: UIAssistantMessage
  workspacePath?: string
}) {
  const lastBlock = message.blocks[message.blocks.length - 1]

  return (
    <div className="space-y-2">
      {message.blocks.map(block => {
        if (block.kind === "tool") {
          return <ToolRow key={block.id} block={block} workspacePath={workspacePath} />
        }
        // The caret only belongs on the block still being written.
        const isTail = message.running && block.id === lastBlock?.id
        return (
          <div key={block.id} className="max-w-[68ch]">
            <Markdown text={block.text} caret={isTail} />
          </div>
        )
      })}

      {message.running && message.blocks.length === 0 && (
        <p className="font-mono text-[13px] text-dim">
          Working<span className="caret" aria-hidden />
        </p>
      )}

      {message.error && (
        <p className="max-w-[68ch] border-l-2 border-alarm pl-3 font-mono text-[13px] text-alarm">
          {message.error}
        </p>
      )}
    </div>
  )
}
