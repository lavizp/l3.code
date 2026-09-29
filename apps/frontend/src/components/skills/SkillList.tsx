import { useMemo, useState } from "react"
import type { ProviderSummary, Skill, SkillScope } from "commons/types"
import { ProviderMarks } from "./ProviderMarks"

/**
 * Every skill in view, grouped by how far it reaches.
 *
 * The grouping is the point of the pane. A person looking for "why did the
 * agent do that" needs to know whether the skill came from this repo, from
 * their own home directory, or from the agent itself — those are three
 * different conversations, and a flat list makes them one.
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

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = needle
      ? skills.filter(
          s =>
            s.name.toLowerCase().includes(needle) ||
            s.description.toLowerCase().includes(needle)
        )
      : skills

    return SCOPES.map(scope => ({
      scope,
      skills: matching.filter(s => s.scope === scope)
    })).filter(g => g.skills.length > 0)
  }, [skills, query])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-rule p-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter skills"
          className="w-full rounded bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink placeholder:text-dim focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-[13px] leading-relaxed text-dim">
            {skills.length === 0
              ? hasProject
                ? "No skills here yet. Write one and every agent on this machine will see it."
                : "No personal skills yet. Choose a project to see its skills too."
              : "Nothing matches that."}
          </p>
        ) : (
          groups.map(group => (
            <section key={group.scope} className="mb-3">
              <h2 className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-dim">
                {SCOPE_LABEL[group.scope]}
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
        {!skill.editable && (
          <span
            className="shrink-0 font-mono text-[10px] text-dim"
            title="Owned by the agent — the next update would overwrite an edit"
          >
            read-only
          </span>
        )}
        <ProviderMarks skill={skill} providers={providers} />
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-dim">
        {skill.description}
      </span>
    </button>
  )
}

const SCOPES: SkillScope[] = ["project", "user", "system"]

const SCOPE_LABEL: Record<SkillScope, string> = {
  project: "This project",
  user: "Personal",
  system: "Built in"
}
