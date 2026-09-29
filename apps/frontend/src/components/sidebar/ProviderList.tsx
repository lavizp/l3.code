import type { ProviderSummary } from "commons/types"

/**
 * Which agents this server can actually ask.
 *
 * An agent that isn't installed is the difference between "you have no
 * skills" and "one of the two places they live can't be read right now",
 * and a list that doesn't say which is which is a list nobody can trust.
 */
export function ProviderList({ providers }: { providers: ProviderSummary[] }) {
  if (providers.length === 0) {
    return null
  }
  return (
    <div className="border-t border-rule px-3 py-2">
      <div className="pb-1 font-mono text-[10px] uppercase tracking-wider text-dim">
        Agents
      </div>
      {providers.map(provider => (
        <div
          key={provider.id}
          className="flex items-center gap-2 py-0.5"
          title={provider.detail}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              provider.available ? "bg-signal" : "bg-rule"
            }`}
          />
          <span
            className={`font-mono text-[11px] ${
              provider.available ? "text-ink" : "text-dim"
            }`}
          >
            {provider.label}
          </span>
          {!provider.available && (
            <span className="font-mono text-[10px] text-dim">not installed</span>
          )}
        </div>
      ))}
    </div>
  )
}
