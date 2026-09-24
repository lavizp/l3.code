import { useEffect, useRef, useState } from "react"

export function Composer({
  onSend,
  busy,
  disabled,
  blockedReason
}: {
  onSend: (message: string) => void
  busy: boolean
  disabled: boolean
  /**
   * Why sending is off, when it's off for a reason the person can't see from
   * the state of the socket — a plan limit that hasn't reset yet. A disabled
   * box with no explanation reads as a broken app.
   */
  blockedReason?: string
}) {
  const [value, setValue] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the message instead of scrolling a one-line box.
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const blocked = busy || disabled || Boolean(blockedReason)

  function send() {
    const trimmed = value.trim()
    if (!trimmed || blocked) {
      return
    }
    onSend(trimmed)
    setValue("")
  }

  return (
    <div className="border-t border-rule bg-panel px-6 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-sm border border-rule bg-void px-3 py-2 focus-within:border-dim">
          <textarea
            ref={ref}
            rows={1}
            className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent text-[15px] text-ink placeholder:text-dim/60 focus:outline-none"
            placeholder={
              blockedReason
                ? blockedReason
                : disabled
                  ? "Reconnecting…"
                  : busy
                    ? "The agent is working…"
                    : "Ask for a change"
            }
            value={value}
            disabled={blocked}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button
            className="shrink-0 rounded-sm bg-paper px-3 py-1.5 font-mono text-[12px] font-medium text-void hover:bg-white disabled:opacity-30"
            onClick={send}
            disabled={blocked || !value.trim()}
          >
            Send
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-dim">
          {blockedReason ??
            "Enter sends, Shift+Enter adds a line. The agent can read and edit files here."}
        </p>
      </div>
    </div>
  )
}
