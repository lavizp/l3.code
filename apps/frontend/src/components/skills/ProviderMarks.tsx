import type { ProviderSummary, Skill } from "commons/types"

/**
 * Which agents can see a skill, as one initial each.
 *
 * This is the column the pane exists for. A skill sitting in the right
 * folder for one agent and invisible to another looks identical on disk;
 * the only way to tell is to ask each of them, and the answer belongs next
 * to the skill rather than three clicks away.
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
            className={`flex h-4 w-4 items-center justify-center rounded-sm font-mono text-[9px] ${
              sighting
                ? "bg-signal/20 text-signal"
                : "bg-rule/60 text-dim line-through opacity-50"
            }`}
          >
            {provider.label[0]}
          </span>
        )
      })}
    </span>
  )
}
