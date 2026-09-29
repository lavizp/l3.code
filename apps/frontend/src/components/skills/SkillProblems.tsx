import { useState } from "react"
import type { ProviderSummary, SkillProblem } from "commons/types"

/**
 * The `SKILL.md` files that wouldn't read, named rather than dropped.
 *
 * A skill with broken frontmatter doesn't announce itself: the agent simply
 * never offers it, which looks exactly like never having written it. This is
 * the only place that difference is visible.
 */
export function SkillProblems({
  problems,
  providers
}: {
  problems: SkillProblem[]
  providers: ProviderSummary[]
}) {
  const [open, setOpen] = useState(false)

  if (problems.length === 0) {
    return null
  }

  return (
    <div className="border-t border-alarm/20 bg-alarm/5 px-3 py-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="font-mono text-[11px] text-alarm opacity-80 hover:opacity-100"
      >
        {problems.length} skill{problems.length === 1 ? "" : "s"} wouldn't read
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {problems.map((problem, i) => (
            <li key={`${problem.path}-${i}`} className="font-mono text-[10px] text-dim">
              <span className="truncate-path block text-alarm/80">{problem.path}</span>
              {problem.message}
              <span className="opacity-60">
                {" "}
                ·{" "}
                {providers.find(p => p.id === problem.providerId)?.label ??
                  problem.providerId}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
