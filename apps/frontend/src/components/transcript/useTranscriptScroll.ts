import { useEffect, useRef } from "react"
import type { UISession } from "../../lib/transcript"

/**
 * Follow the stream, but stop fighting the user if they scroll up to read.
 * The signature changes as text streams in, so each delta re-pins the view.
 */
export function useTranscriptScroll(session: UISession) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

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

  return { scrollRef, bottomRef, onScroll }
}
