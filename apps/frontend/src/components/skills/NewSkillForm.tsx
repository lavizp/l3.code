import { useState } from "react"
import type { ProviderSummary, SkillDestination, SkillScope } from "commons/types"

/**
 * Where a new skill goes, decided before it's written.
 *
 * Two questions, and neither is a filing detail. How far it travels — this
 * repo or everywhere — and who reads it once it's there. The second is the
 * one people get wrong, because a skill for every agent and a skill for one
 * differ only by which directory they sit in, and that is invisible
 * afterwards. Both are asked here, where the answer is still cheap.
 */
export function NewSkillForm({
  destinations,
  providers,
  busy,
  onCreate,
  onCancel
}: {
  destinations: SkillDestination[]
  providers: ProviderSummary[]
  busy: boolean
  onCreate: (input: {
    scope: SkillScope
    target: string
    name: string
    description: string
  }) => void
  onCancel: () => void
}) {
  const [picked, setScope] = useState<SkillScope>(destinations[0]?.scope ?? "user")
  const [target, setTarget] = useState("shared")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  // Scopes in the order the server offered them, without repeating one.
  const scopes = [...new Set(destinations.map(d => d.scope))]
  // Switching project while the form is open can take the choice away.
  const scope = scopes.includes(picked) ? picked : (scopes[0] ?? picked)
  const forScope = destinations.filter(d => d.scope === scope)
  const chosen = forScope.find(d => d.target === target) ?? forScope[0]
  // The server enforces this too; saying it here means finding out before
  // typing a description rather than after.
  const nameProblem =
    name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
      ? "Lowercase letters, digits and dashes."
      : null
  const ready = name && !nameProblem && description.trim() && !busy && chosen

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (ready && chosen) {
          onCreate({ scope, target: chosen.target, name, description: description.trim() })
        }
      }}
      className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5"
    >
      <h1 className="font-mono text-[14px] text-ink">New skill</h1>

      {/* Only worth asking when there's more than one answer — in a project,
          a new skill always goes into the repo. */}
      {scopes.length > 1 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1 font-mono text-[11px] text-dim">How far it travels</legend>
          {scopes.map(option => (
            <label
              key={option}
              className={`flex cursor-pointer gap-2.5 rounded border px-3 py-2 ${
                scope === option
                  ? "border-signal/40 bg-signal/5"
                  : "border-rule hover:bg-raised/50"
              }`}
            >
              <input
                type="radio"
                name="scope"
                className="mt-1 accent-signal"
                checked={scope === option}
                onChange={() => setScope(option)}
              />
              <span className="min-w-0">
                <span className="block font-mono text-[12px] text-ink">
                  {option === "project" ? "This project only" : "Every project"}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-dim">
                  {option === "project"
                    ? "A file in the repo, so it travels with it."
                    : "Kept in your home directory, so it follows you."}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1 font-mono text-[11px] text-dim">Who reads it</legend>
        {forScope.map(destination => (
          <label
            key={destination.target}
            className={`flex cursor-pointer gap-2.5 rounded border px-3 py-2 ${
              chosen?.target === destination.target
                ? "border-signal/40 bg-signal/5"
                : "border-rule hover:bg-raised/50"
            }`}
          >
            <input
              type="radio"
              name="target"
              className="mt-1 accent-signal"
              checked={chosen?.target === destination.target}
              onChange={() => setTarget(destination.target)}
            />
            <span className="min-w-0">
              <span className="block font-mono text-[12px] text-ink">
                {destination.label}
                {destination.reaches.some(
                  id => providers.find(p => p.id === id)?.available === false
                ) && <span className="ml-2 text-dim">not installed here</span>}
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
          {chosen.target === "shared"
            ? `Written once and linked into place for ${chosen.reaches.length} agent${
                chosen.reaches.length === 1 ? "" : "s"
              }, so there's one file to edit rather than a copy each.`
            : "Written straight into that agent's own folder. No other agent looks there."}
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
