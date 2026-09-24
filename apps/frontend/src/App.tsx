import { Composer } from "./components/Composer"
import { ErrorBanner } from "./components/ErrorBanner"
import { NoSession } from "./components/NoSession"
import { SessionHeader } from "./components/SessionHeader"
import { Sidebar } from "./components/sidebar"
import { Transcript } from "./components/transcript"
import { useAgentClient } from "./hooks/useAgentClient"
import { useCountdown } from "./hooks/useCountdown"
import { formatWait } from "./lib/failure"
import { isRunning } from "./lib/transcript"
import "./index.css"

export function App() {
  const agent = useAgentClient()
  const { workspace, session } = agent

  // A limit the server told us the reset time for takes the composer out of
  // service until then, and puts itself back in when the countdown runs out.
  const limited = agent.error?.kind === "usage-limit" ? agent.error : undefined
  const waiting = useCountdown(limited?.retryAt)

  return (
    <div className="flex h-screen bg-void text-ink">
      <aside className="w-64 shrink-0 border-r border-rule">
        <Sidebar
          workspaces={agent.workspaces}
          activeSessionId={agent.activeSessionId}
          status={agent.status}
          attempts={agent.attempts}
          retryAt={agent.retryAt}
          everConnected={agent.everConnected}
          onReconnect={agent.reconnect}
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
          <ErrorBanner
            error={agent.error}
            canRetry={agent.canRetry}
            connected={agent.connected}
            onRetry={agent.retry}
            onReconnect={agent.reconnect}
            onDismiss={agent.dismissError}
          />
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
              blockedReason={
                waiting !== null && waiting > 0
                  ? `Plan limit reached — sending is back in ${formatWait(waiting)}.`
                  : undefined
              }
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
