import { useState } from "react"
import { ErrorBanner } from "./components/ErrorBanner"
import { Sidebar } from "./components/sidebar"
import { NewSkillForm, SkillEditor, SkillList, SkillProblems } from "./components/skills"
import { useSkillPane } from "./hooks/useSkillPane"
import "./index.css"

/**
 * Three columns: which folder, which skill, and the skill itself.
 *
 * The middle column is the product. Everything a coding agent knows how to
 * do that somebody taught it lives in a `SKILL.md` somewhere on this
 * machine, scattered across a directory per agent, and until they are in one
 * list nobody can answer "what does my agent actually know" without going
 * and looking.
 */
export function App() {
  const pane = useSkillPane()
  const [creating, setCreating] = useState(false)

  function create(input: Parameters<typeof pane.createSkill>[0]) {
    setCreating(false)
    pane.createSkill(input)
  }

  return (
    <div className="flex h-screen bg-void text-ink">
      <aside className="w-64 shrink-0 border-r border-rule">
        <Sidebar
          workspaces={pane.workspaces}
          workspaceId={pane.workspaceId}
          providers={pane.providers}
          status={pane.status}
          attempts={pane.attempts}
          retryAt={pane.retryAt}
          everConnected={pane.everConnected}
          directory={pane.directory}
          directoryLoading={pane.directoryLoading}
          onSelectWorkspace={pane.selectWorkspace}
          onBrowseDirectory={pane.browseDirectory}
          onAddWorkspace={pane.addWorkspace}
          onReconnect={pane.reconnect}
        />
      </aside>

      <section className="flex w-80 shrink-0 flex-col border-r border-rule bg-panel">
        <header className="flex items-center justify-between border-b border-rule px-3 py-2">
          <h1 className="font-mono text-[12px] text-dim">
            {pane.workspace?.name ?? "Personal"}
            {pane.loading && <span className="ml-2 opacity-60">reading…</span>}
          </h1>
          <button
            onClick={() => setCreating(true)}
            className="font-mono text-[12px] text-signal hover:opacity-80"
          >
            + New
          </button>
        </header>

        <div className="min-h-0 flex-1">
          <SkillList
            skills={pane.skills}
            providers={pane.providers}
            selectedPath={pane.source?.path ?? null}
            onSelect={pane.selectSkill}
            hasProject={pane.workspaceId !== null}
          />
        </div>

        <SkillProblems problems={pane.problems} providers={pane.providers} />
      </section>

      <main className="flex min-w-0 flex-1 flex-col">
        {pane.error && (
          <ErrorBanner
            error={pane.error}
            connected={pane.connected}
            onReconnect={pane.reconnect}
            onDismiss={pane.dismissError}
          />
        )}

        {creating ? (
          <NewSkillForm
            destinations={pane.destinations}
            providers={pane.providers}
            busy={pane.saving}
            onCreate={create}
            onCancel={() => setCreating(false)}
          />
        ) : pane.source ? (
          <SkillEditor
            skill={pane.selected}
            source={pane.source}
            providers={pane.providers}
            saving={pane.saving}
            onSave={pane.saveSkill}
            onDelete={() => pane.deleteSkill(pane.source!.path)}
          />
        ) : (
          <Empty />
        )}
      </main>
    </div>
  )
}

function Empty() {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <p className="max-w-md text-center text-[13px] leading-relaxed text-dim">
        Pick a skill to read what it tells your agents, or write a new one. A skill
        written here goes into{" "}
        <span className="font-mono text-ink/70">.agents/skills</span> once and is
        linked into every agent's own folder, so there's a single file to edit
        rather than a copy per agent.
      </p>
    </div>
  )
}

export default App
