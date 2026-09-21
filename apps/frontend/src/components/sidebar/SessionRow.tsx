import { isRunning, sessionTitle, type UISession } from "../../lib/transcript"

export function SessionRow({
  session,
  active,
  onSelect
}: {
  session: UISession
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] ${
        active ? "bg-raised text-ink" : "text-dim hover:bg-panel hover:text-ink"
      }`}
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1 truncate">{sessionTitle(session)}</span>
      {isRunning(session) && (
        <span className="pulse shrink-0 text-[10px] text-signal" aria-label="Running">
          ◆
        </span>
      )}
    </button>
  )
}
