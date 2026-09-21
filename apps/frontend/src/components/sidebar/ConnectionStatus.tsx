import type { ConnectionStatus as Status } from "../../hooks/useSocket"

const COPY: Record<Status, string> = {
  connecting: "Connecting to the agent",
  open: "Connected",
  closed: "Disconnected — retrying"
}

const DOT: Record<Status, string> = {
  connecting: "bg-dim pulse",
  open: "bg-signal",
  closed: "bg-alarm"
}

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      <span className="font-mono text-[11px] text-dim">{COPY[status]}</span>
    </div>
  )
}
