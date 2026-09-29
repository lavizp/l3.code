import { useState } from "react"
import type { Failure } from "commons/types"
import { present, TONE_CLASS } from "../lib/failure"

/**
 * The one place a failure is explained and acted on.
 *
 * Two things beyond the sentence itself, because a sentence on its own
 * leaves a person with nothing to do: the server's own wording for when
 * ours isn't specific enough, and the button that gets back to where they
 * were.
 */
export function ErrorBanner({
  error,
  connected,
  onReconnect,
  onDismiss
}: {
  error: Failure
  connected: boolean
  onReconnect: () => void
  onDismiss: () => void
}) {
  const [showDetail, setShowDetail] = useState(false)
  const { title, tone } = present(error)
  const colour = TONE_CLASS[tone]

  return (
    <div className={`border-b px-6 py-2.5 ${colour.border} ${colour.bg}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-mono text-[12px] ${colour.text}`}>
            <span className="font-medium">{title}</span>
            <span className="opacity-80"> — {error.message}</span>
          </p>

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
