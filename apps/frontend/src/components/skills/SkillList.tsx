import { useMemo, useState } from "react"
import type { ProviderSummary, Skill } from "commons/types"
import { ProviderMarks, reachOf } from "./ProviderMarks"

/**
 * Every skill in view, grouped by who put it there.
 *
 * The grouping is the point of the pane. "Why did the agent do that" is a
 * different conversation depending on whether the skill came from this repo,
 * from the person's home directory, from a plugin, or from the agent itself
 * — and a list that mixes the four makes them one. Only the first two are
 * anybody's to change, and they come first.
 *
 * The filter above it answers the other question: of these, which are shared
 * between the agents and which belong to one? That can't be seen from the
 * disk, and it is the thing people get wrong.
 */
export function SkillList({
  skills,
  providers,
  selectedPath,
  onSelect,
  hasProject
}: {
  skills: Skill[]
  providers: ProviderSummary[]
  selectedPath: string | null
  onSelect: (path: string) => void
  hasProject: boolean
}) {
  const [query, setQuery] = useState("")
  const [reach, setReach] = useState("all")

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const matching = skills.filter(skill => {
      if (reach === "shared" && skill.seenBy.length < 2) {
        return false
      }
      // A provider filter means "this agent can read it", shared ones
      // included — those are still skills that agent will act on.
      if (reach !== "all" && reach !== "shared") {
        if (!skill.seenBy.some(s => s.providerId === reach)) {
          return false
        }
      }
      if (!needle) {
        return true
      }
      return (
        skill.name.toLowerCase().includes(needle) ||
        skill.description.toLowerCase().includes(needle)
      )
    })

    return BUCKETS.map(bucket => ({
      ...bucket,
      skills: matching.filter(s => bucket.holds(s))
    })).filter(g => g.skills.length > 0)
  }, [skills, query, reach])

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1.5 border-b border-rule p-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter skills"
          className="w-full rounded bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink placeholder:text-dim focus:outline-none"
        />
        <div className="flex gap-1">
          <Chip label="All" active={reach === "all"} onClick={() => setReach("all")} />
          <Chip
            label="Shared"
            title="Skills more than one agent reads"
            active={reach === "shared"}
            onClick={() => setReach("shared")}
          />
          {providers.map(provider => (
            <Chip
              key={provider.id}
              label={provider.short}
              title={`Skills ${provider.label} reads`}
              active={reach === provider.id}
              onClick={() => setReach(provider.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-[13px] leading-relaxed text-dim">
            {skills.length === 0
              ? hasProject
                ? "No skills here yet. Write one and choose who reads it."
                : "No personal skills yet. Choose a project to see its skills too."
              : "Nothing matches that."}
          </p>
        ) : (
          groups.map(group => (
            <section key={group.key} className="mb-3">
              <h2
                className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-dim"
                title={group.hint}
              >
                {group.label}
                <span className="ml-1.5 opacity-60">{group.skills.length}</span>
              </h2>
              {group.skills.map(skill => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  providers={providers}
                  active={skill.id === selectedPath}
                  onSelect={() => onSelect(skill.id)}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  )
}

function SkillRow({
  skill,
  providers,
  active,
  onSelect
}: {
  skill: Skill
  providers: ProviderSummary[]
  active: boolean
  onSelect: () => void
}) {
  const reach = reachOf(skill, providers)

  return (
    <button
      onClick={onSelect}
      className={`block w-full rounded px-2 py-1.5 text-left transition-colors ${
        active ? "bg-raised" : "hover:bg-raised/60"
      }`}
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">
          {skill.name}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-dim">{reach.label}</span>
        <ProviderMarks skill={skill} providers={providers} />
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-dim">
        {skill.description}
      </span>
    </button>
  )
}

function Chip({
  label,
  title,
  active,
  onClick
}: {
  label: string
  title?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
        active ? "bg-signal/20 text-signal" : "bg-raised text-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  )
}

/**
 * The groups, in the order they matter.
 *
 * Scope splits the person's own skills because a repo skill and a personal
 * one are different commitments; the agent's own are not split by scope,
 * because where a plugin happened to install itself is nobody's decision.
 */
const BUCKETS: {
  key: string
  label: string
  hint: string
  holds: (skill: Skill) => boolean
}[] = [
  {
    key: "project",
    label: "This project",
    hint: "Yours, in the repo — travels with it",
    holds: s => s.origin === "yours" && s.scope === "project"
  },
  {
    key: "personal",
    label: "Personal",
    hint: "Yours, in your home directory — follows you everywhere",
    holds: s => s.origin === "yours" && s.scope === "user"
  },
  {
    key: "plugin",
    label: "From plugins",
    hint: "Provided by an installed plugin; replaced when it updates",
    holds: s => s.origin === "plugin"
  },
  {
    key: "synced",
    label: "Synced from your account",
    hint: "Downloaded from your account and re-downloaded on a timer",
    holds: s => s.origin === "synced"
  },
  {
    key: "bundled",
    label: "The agent's own",
    hint: "Shipped with the agent itself",
    holds: s => s.origin === "bundled"
  }
]
