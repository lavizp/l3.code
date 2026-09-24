import { Composer } from "./components/Composer"
import { ErrorBanner } from "./components/ErrorBanner"
import { NoSession } from "./components/NoSession"
import { SessionHeader } from "./components/SessionHeader"
import { Sidebar } from "./components/sidebar"
import { Transcript } from "./components/transcript"
import { useAgentClient } from "./hooks/useAgentClient"
import { isRunning } from "./lib/transcript"
import "./index.css"

export function App() {
  const agent = useAgentClient()
  const { workspace, session } = agent

  return (
    <div className="flex h-screen bg-void text-ink">
      <aside className="w-64 shrink-0 border-r border-rule">
        <Sidebar
          workspaces={agent.workspaces}
          activeSessionId={agent.activeSessionId}
          status={agent.status}
          agents={agent.agents}
          directory={agent.directory}
          directoryLoading={agent.directoryLoading}
          onBrowseDirectory={agent.browseDirectory}
          onAddWorkspace={agent.addWorkspace}
          onSelectSession={agent.selectSession}
          onNewSession={agent.newSession}
          onRenameSession={agent.renameSession}
          onDeleteSession={agent.deleteSession}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {agent.error && (
          <ErrorBanner message={agent.error} onDismiss={agent.dismissError} />
        )}

        {session && workspace ? (
          <>
            <SessionHeader
              name={workspace.name}
              path={workspace.path}
              agent={
                agent.agents.find(a => a.id === session.agentId)?.label ?? session.agentId
              }
            />
            <Transcript session={session} workspacePath={workspace.path} />
            <Composer
              onSend={agent.sendMessage}
              busy={isRunning(session)}
              disabled={!agent.connected}
            />
          </>
        ) : (
          <NoSession />
        )}
      </main>
    </div>
  )
}

export default App
