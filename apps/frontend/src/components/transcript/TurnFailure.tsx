import { useState } from "react"
import type { Failure, Notice } from "commons/types"
import { useCountdown } from "../../hooks/useCountdown"
import { formatClock, formatWait, present, TONE_CLASS } from "../../lib/failure"

/**
 * Why a turn stopped, shown where it stopped.
 *
 * The banner at the top says what to do about it; this says which reply it
 * happened to. Scrolling back through a transcript weeks later, a turn that
 * simply ends is a mystery — one that ends with "the plan's allowance ran
 * out" is a record.
 */
export function TurnFailure({ error }: { error: Failure }) {
  const [showDetail, setShowDetail] = useState(false)
  const { title, tone } = present(error)
  const colour = TONE_CLASS[tone]

  return (
    <div className={`max-w-[68ch] border-l-2 pl-3 ${colour.border.replace("/40", "")}`}>
      <p className={`font-mono text-[13px] ${colour.text}`}>
        <span className="font-medium">{title}.</span> {error.message}
      </p>

      {error.detail && (
        <>
          <button
            className={`mt-0.5 font-mono text-[11px] opacity-60 hover:opacity-100 ${colour.text}`}
            onClick={() => setShowDetail(d => !d)}
          >
            {showDetail ? "Hide what the agent said" : "What the agent said"}
          </button>
          {showDetail && (
            <pre
              className={`mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] opacity-70 ${colour.text}`}
            >
              {error.detail}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Something happening right now that isn't going to end the turn: a retry
 * after a hiccup, an allowance getting close. Amber, like everything else in
 * flight, and gone as soon as the turn ends.
 */
export function TurnNotice({ notice }: { notice: Notice }) {
  const remaining = useCountdown(notice.until)

  return (
    <p className="max-w-[68ch] font-mono text-[12px] text-signal/80">
      {notice.message}
      {remaining !== null && remaining > 0 && (
        <span className="opacity-70">
          {notice.kind === "retrying"
            ? ` Next try in ${formatWait(remaining)}.`
            : ` Resets at ${formatClock(notice.until!)}.`}
        </span>
      )}
    </p>
  )
}
