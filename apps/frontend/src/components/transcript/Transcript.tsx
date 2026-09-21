import type { UISession } from "../../lib/transcript"
import { AssistantTurn } from "./AssistantTurn"
import { useTranscriptScroll } from "./useTranscriptScroll"
import { UserTurn } from "./UserTurn"

export function Transcript({
  session,
  workspacePath
}: {
  session: UISession
  workspacePath?: string
}) {
  const { scrollRef, bottomRef, onScroll } = useTranscriptScroll(session)

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
