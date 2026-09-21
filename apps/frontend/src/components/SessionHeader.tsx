/** Which folder the open session is working in. */
export function SessionHeader({ name, path }: { name: string; path: string }) {
  return (
    <header className="border-b border-rule px-6 py-3">
      <h1 className="font-mono text-[13px] text-ink">{name}</h1>
      <p className="truncate-path max-w-md font-mono text-[11px] text-dim">{path}</p>
    </header>
  )
}
