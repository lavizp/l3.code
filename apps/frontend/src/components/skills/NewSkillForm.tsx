import { useState } from "react"
import type { SkillDestination, SkillScope } from "commons/types"

/**
 * Where a new skill goes, decided before it's written.
 *
 * The scope isn't a filing detail — it's the only thing that decides which
 * agents will ever read it, so it's the first question, and the form says
 * what each answer means in the place the answer is given.
 */
export function NewSkillForm({
  destinations,
  busy,
  onCreate,
  onCancel
}: {
  destinations: SkillDestination[]
  busy: boolean
  onCreate: (input: { scope: SkillScope; name: string; description: string }) => void
  onCancel: () => void
}) {
  const [scope, setScope] = useState<SkillScope>(destinations[0]?.scope ?? "user")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const chosen = destinations.find(d => d.scope === scope)
  // The server enforces this too; saying it here means finding out before
  // typing a description rather than after.
  const nameProblem =
    name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
      ? "Lowercase letters, digits and dashes."
      : null
  const ready = name && !nameProblem && description.trim() && !busy

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (ready) {
          onCreate({ scope, name, description: description.trim() })
        }
      }}
      className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5"
    >
      <h1 className="font-mono text-[14px] text-ink">New skill</h1>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1 font-mono text-[11px] text-dim">Where it lives</legend>
        {destinations.map(destination => (
          <label
            key={destination.scope}
            className={`flex cursor-pointer gap-2.5 rounded border px-3 py-2 ${
              scope === destination.scope
                ? "border-signal/40 bg-signal/5"
                : "border-rule hover:bg-raised/50"
            }`}
          >
            <input
              type="radio"
              name="scope"
              className="mt-1 accent-signal"
              checked={scope === destination.scope}
              onChange={() => setScope(destination.scope)}
            />
            <span className="min-w-0">
              <span className="block font-mono text-[12px] text-ink">
                {destination.scope === "project"
                  ? "This project"
                  : "Personal — every project"}
              </span>
              <span className="truncate-path mt-0.5 block font-mono text-[11px] text-dim">
                {destination.path}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-dim">Name</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="release-notes"
          autoFocus
          className="rounded bg-raised px-2.5 py-1.5 font-mono text-[13px] text-ink placeholder:text-dim focus:outline-none"
        />
        {nameProblem && (
          <span className="font-mono text-[11px] text-alarm">{nameProblem}</span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-dim">Description</span>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="What this is for, and when it applies."
          className="resize-none rounded bg-raised px-2.5 py-1.5 font-mono text-[13px] text-ink placeholder:text-dim focus:outline-none"
        />
        <span className="text-[11px] leading-snug text-dim">
          This is the only part an agent reads when deciding whether to use the
          skill. Everything else it reads afterwards.
        </span>
      </label>

      {chosen && (
        <p className="text-[12px] leading-snug text-dim">
          Written once to{" "}
          <span className="font-mono text-ink/70">.agents/skills</span> and linked
          into place for {chosen.reaches.length} agent
          {chosen.reaches.length === 1 ? "" : "s"}.
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!ready}
          className="rounded bg-signal px-3 py-1 font-mono text-[12px] text-void disabled:opacity-30"
        >
          {busy ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[12px] text-dim hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
