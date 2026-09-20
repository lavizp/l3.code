import { useEffect, useRef } from "react"
import type { UIMessage, UISession } from "../lib/transcript"
import { Markdown } from "../lib/markdown"
import { ToolRow } from "./ToolRow"

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[34rem] rounded-sm bg-paper px-4 py-2.5 text-[15px] whitespace-pre-wrap text-void">
        {text}
      </div>
    </div>
  )
}

function AssistantTurn({
  message,
  workspacePath
}: {
  message: Extract<UIMessage, { role: "assistant" }>
  workspacePath?: string
}) {
  const lastBlock = message.blocks[message.blocks.length - 1]

  return (
    <div className="space-y-2">
      {message.blocks.map(block => {
        if (block.kind === "tool") {
          return <ToolRow key={block.id} block={block} workspacePath={workspacePath} />
        }
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

export function Transcript({
  session,
  workspacePath
}: {
  session: UISession
  workspacePath?: string
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Follow the stream, but stop fighting the user if they scroll up to read.
  // Changes as text streams in, so each delta re-pins the view.
  const tail = session.messages[session.messages.length - 1]
  const streamSignature =
    tail && tail.role === "assistant"
      ? tail.blocks.map(b => (b.kind === "text" ? b.text.length : b.status)).join(",")
      : ""

  useEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" })
    }
  }, [session.id, session.messages.length, streamSignature])

  function onScroll() {
    const el = scrollRef.current
    if (!el) {
      return
    }
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  if (session.messages.length === 0) {
    return (
      <div
        ref={scrollRef}
        className="flex flex-1 items-center justify-center px-6 text-center"
      >
        <p className="max-w-sm text-dim">
          Ask for a change and the agent will read and edit files in this folder.
        </p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {session.messages.map(message =>
          message.role === "user" ? (
            <UserTurn key={message.id} text={message.text} />
          ) : (
            <AssistantTurn
              key={message.id}
              message={message}
              workspacePath={workspacePath}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
