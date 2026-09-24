import { useCountdown } from "../../hooks/useCountdown"
import { formatWait } from "../../lib/failure"
import type { ConnectionStatus as Status } from "../../hooks/useSocket"

const DOT: Record<Status, string> = {
  connecting: "bg-dim pulse",
  open: "bg-signal",
  closed: "bg-alarm"
}

/**
 * Whether the server is there, and when we'll next find out.
 *
 * "Disconnected — retrying" says nothing about whether the retry is a second
 * away or ten, and after a few of them a person can't tell a backoff from a
 * hang. The countdown makes the wait legible, and the button makes it
 * skippable.
 */
export function ConnectionStatus({
  status,
  attempts,
  retryAt,
  everConnected,
  onReconnect
}: {
  status: Status
  attempts: number
  retryAt: number | null
  /** A first attempt that fails means the server isn't up, not that it left. */
  everConnected: boolean
  onReconnect: () => void
}) {
  const remaining = useCountdown(status === "closed" ? retryAt : null)

  return (
    <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status]}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-dim">
        {copy(status, everConnected, remaining, attempts)}
      </span>
      {status === "closed" && (
        <button
          className="shrink-0 font-mono text-[11px] text-dim hover:text-ink"
          onClick={onReconnect}
        >
          Retry
        </button>
      )}
    </div>
  )
}

function copy(
  status: Status,
  everConnected: boolean,
  remaining: number | null,
  attempts: number
): string {
  if (status === "open") {
    return "Connected"
  }
  if (status === "connecting") {
    return everConnected ? "Reconnecting" : "Connecting to the agent"
  }

  const what = everConnected ? "Disconnected" : "No server at that address"
  const when =
    remaining !== null && remaining > 0
      ? `retrying in ${formatWait(remaining)}`
      : "retrying"
  // The attempt count is what tells a slow reconnect from a dead one.
  return attempts > 1 ? `${what} — ${when} (${attempts} tries)` : `${what} — ${when}`
}
