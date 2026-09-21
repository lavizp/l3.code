/** Which folder the open session is working in, and what's running it. */
export function SessionHeader({
  name,
  path,
  agent
}: {
  name: string
  path: string
  agent: string
}) {
  return (
    <header className="flex items-baseline gap-3 border-b border-rule px-6 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="font-mono text-[13px] text-ink">{name}</h1>
        <p className="truncate-path max-w-md font-mono text-[11px] text-dim">{path}</p>
      </div>
      <span
        className="shrink-0 rounded-sm border border-rule px-2 py-0.5 font-mono text-[11px] text-dim"
        title="Chosen when this session was created, and fixed for its lifetime"
      >
        {agent}
      </span>
    </header>
  )
}
