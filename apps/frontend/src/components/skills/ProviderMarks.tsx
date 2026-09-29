import type { ProviderSummary, Skill } from "commons/types"

/**
 * Which agents can see a skill, as one small badge each.
 *
 * This is the column the pane exists for. A skill sitting in the right
 * folder for one agent and invisible to another looks identical on disk, so
 * the answer belongs next to the skill rather than three clicks away.
 *
 * The badge reads the agent's short code rather than its initial, because
 * "Claude Code" and "Codex" share one, and a badge that reads the same for
 * both answers the question it exists to answer with a coin toss.
 */
export function ProviderMarks({
  skill,
  providers
}: {
  skill: Skill
  providers: ProviderSummary[]
}) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {providers.map(provider => {
        const sighting = skill.seenBy.find(s => s.providerId === provider.id)
        return (
          <span
            key={provider.id}
            title={
              sighting
                ? `${provider.label} reads it from ${sighting.path}`
                : `${provider.label} can't see this one`
            }
            className={`flex h-4 items-center rounded-sm px-1 font-mono text-[9px] tracking-tight ${
              sighting ? "bg-signal/20 text-signal" : "bg-rule/50 text-dim opacity-50"
            }`}
          >
            {provider.short}
          </span>
        )
      })}
    </span>
  )
}

/**
 * How far a skill reaches, as a word.
 *
 * `shared` is the interesting case and the one worth naming: it means one
 * file that every agent reads, which is the arrangement this app exists to
 * make easy and the one that is hardest to verify by looking at the disk.
 */
export function reachOf(
  skill: Skill,
  providers: ProviderSummary[]
): { key: string; label: string } {
  const seen = providers.filter(p => skill.seenBy.some(s => s.providerId === p.id))

  if (seen.length === 0) {
    // Listed by an agent that has since been removed from the registry.
    return { key: "none", label: "no agent" }
  }
  if (seen.length > 1) {
    return { key: "shared", label: "shared" }
  }
  return { key: seen[0]!.id, label: `${seen[0]!.label} only` }
}
