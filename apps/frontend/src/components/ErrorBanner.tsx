import { useState } from "react"
import type { Failure } from "commons/types"
import { useCountdown } from "../hooks/useCountdown"
import { formatClock, formatWait, present, TONE_CLASS } from "../lib/failure"

/**
 * The one place a failure is explained and acted on.
 *
 * Three things beyond the sentence itself, because a sentence on its own
 * leaves a person with nothing to do: how long until it fixes itself, the
 * provider's own wording for when ours isn't specific enough, and the button
 * that gets back to where they were.
 */
export function ErrorBanner({
  error,
  canRetry,
  connected,
  onRetry,
  onReconnect,
  onDismiss
}: {
  error: Failure
  /** There is a message worth sending again. */
  canRetry: boolean
  connected: boolean
  onRetry: () => void
  onReconnect: () => void
  onDismiss: () => void
}) {
  const [showDetail, setShowDetail] = useState(false)
  const { title, tone } = present(error)
  const colour = TONE_CLASS[tone]

  const remaining = useCountdown(error.retryAt)
  const waiting = remaining !== null && remaining > 0

  // A limit that hasn't lifted yet can't be retried into submission, and a
  // socket that's down can't carry the message anywhere.
  const retryable = error.retryable && canRetry && !waiting && connected

  return (
    <div className={`border-b px-6 py-2.5 ${colour.border} ${colour.bg}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-mono text-[12px] ${colour.text}`}>
            <span className="font-medium">{title}</span>
            <span className="opacity-80"> — {error.message}</span>
          </p>

          {waiting && (
            <p className={`mt-0.5 font-mono text-[11px] opacity-70 ${colour.text}`}>
              Sending is back in {formatWait(remaining)}
              {error.retryAt && ` (at ${formatClock(error.retryAt)})`}.
            </p>
          )}

          {showDetail && error.detail && (
            <pre
              className={`mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] opacity-70 ${colour.text}`}
            >
              {error.detail}
            </pre>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {error.detail && (
            <BannerAction tone={colour.text} onClick={() => setShowDetail(d => !d)}>
              {showDetail ? "Hide details" : "Details"}
            </BannerAction>
          )}
          {!connected && (
            <BannerAction tone={colour.text} onClick={onReconnect}>
              Reconnect
            </BannerAction>
          )}
          {retryable && (
            <BannerAction tone={colour.text} onClick={onRetry}>
              Send again
            </BannerAction>
          )}
          <BannerAction tone={colour.text} onClick={onDismiss}>
            Dismiss
          </BannerAction>
        </div>
      </div>
    </div>
  )
}

function BannerAction({
  tone,
  onClick,
  children
}: {
  tone: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={`font-mono text-[12px] opacity-70 hover:opacity-100 ${tone}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
