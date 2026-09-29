import { useEffect, useMemo, useState } from "react"
import {
  FRONTMATTER_SUPPORT,
  type ProviderSummary,
  type Skill,
  type SkillSource
} from "commons/types"

/**
 * One `SKILL.md`, edited as the file it is.
 *
 * A form over the known frontmatter keys was the other option, and it would
 * have been wrong: the keys are not the same from agent to agent, a file may
 * already carry keys from an agent this app hasn't been taught about, and a
 * form that can only represent what it knows quietly deletes the rest on
 * save. So the text is the editor, and what this adds beside it is the one
 * thing the text can't say — which agents will act on each key.
 */
export function SkillEditor({
  skill,
  source,
  providers,
  saving,
  onSave,
  onDelete
}: {
  skill: Skill | undefined
  source: SkillSource
  providers: ProviderSummary[]
  saving: boolean
  onSave: (raw: string) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(source.raw)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Settle onto whatever the server last wrote. It normalises what it is
  // given, so the saved file and the text that was sent are not always the
  // same string, and the editor should hold the one that is on disk.
  useEffect(() => {
    setDraft(source.raw)
    setConfirmingDelete(false)
  }, [source.path, source.raw])

  const dirty = draft !== source.raw
  const editable = skill?.editable ?? true

  const keys = useMemo(() => Object.keys(source.frontmatter), [source.frontmatter])

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex items-start gap-4 border-b border-rule px-6 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-mono text-[14px] text-ink">
            {skill?.name ?? source.path.split("/").at(-2)}
          </h1>
          <p className="truncate-path mt-0.5 font-mono text-[11px] text-dim">
            {source.path}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!editable && (
            <span className="font-mono text-[11px] text-dim">
              Read-only — the agent owns this one
            </span>
          )}
          {editable && (
            <>
              <button
                onClick={() => onSave(draft)}
                disabled={!dirty || saving}
                className="rounded bg-signal px-3 py-1 font-mono text-[12px] text-void disabled:opacity-30"
              >
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
              <button
                onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
                onBlur={() => setConfirmingDelete(false)}
                className="font-mono text-[12px] text-dim hover:text-alarm"
              >
                {confirmingDelete ? "Really delete?" : "Delete"}
              </button>
            </>
          )}
        </div>
      </header>

      {skill && <Reach skill={skill} providers={providers} />}

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        readOnly={!editable}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-void px-6 py-4 font-mono text-[13px] leading-relaxed text-ink focus:outline-none read-only:text-dim"
      />

      <Honoured keys={keys} providers={providers} />
    </div>
  )
}

/** Where this skill is read from, per agent. */
function Reach({ skill, providers }: { skill: Skill; providers: ProviderSummary[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-rule px-6 py-2">
      {providers.map(provider => {
        const sighting = skill.seenBy.find(s => s.providerId === provider.id)
        return (
          <span key={provider.id} className="font-mono text-[11px]">
            <span className={sighting ? "text-signal" : "text-dim"}>
              {provider.label}
            </span>
            <span className="ml-1.5 text-dim">
              {sighting ? (
                <span className="truncate-path inline-block max-w-100 align-bottom">
                  {sighting.path}
                </span>
              ) : provider.available ? (
                "can't see this one"
              ) : (
                "not installed here"
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * Which agent acts on each frontmatter key that's present.
 *
 * Every agent ignores keys it doesn't know, in silence — which is what lets
 * one file serve all of them, and also what makes `allowed-tools` look like
 * it works everywhere when it works in exactly one place.
 */
function Honoured({
  keys,
  providers
}: {
  keys: string[]
  providers: ProviderSummary[]
}) {
  if (keys.length === 0) {
    return null
  }
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-6 py-2">
      {keys.map(key => {
        const honours = FRONTMATTER_SUPPORT[key]
        return (
          <span key={key} className="font-mono text-[11px]">
            <span className="text-dim">{key}</span>
            <span className="ml-1.5 text-ink/70">
              {honours === undefined
                ? "unknown to this app"
                : honours.length === providers.length
                  ? "all agents"
                  : (honours
                      .map(id => providers.find(p => p.id === id)?.label ?? id)
                      .join(", ") || "no agent here")}
            </span>
          </span>
        )
      })}
    </footer>
  )
}
