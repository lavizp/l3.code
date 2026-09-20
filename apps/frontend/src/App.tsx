import { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "./context/AppContext";
import { useSocket } from "./hooks/useSocket";
import type { Workspace, Session } from "commons/types"
import "./index.css";

export function App() {
  const {loading, socket} = useSocket()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && socket) {
      socket.onmessage = (event) => {
        const parsedData = JSON.parse(event.data)
        if (parsedData.type === "init") {
            setWorkspaces(parsedData.workspaces)
        }
        if (parsedData.type === "workspace-created") {
          setWorkspaces(workspaces => workspaces.map(w => {
            if (w.id === null) {
              return {
                ...w,
                ...parsedData.payload
              }
            } else {
              return w
            }
          }))
        }
        if (parsedData.type === "session-created") {
          const { id, workspaceId } = parsedData.payload
          setWorkspaces(workspaces => workspaces.map(w => {
            if (w.id === workspaceId) {
              return {
                ...w,
                sessions: [...w.sessions, { id, messages: [] }]
              }
            } else {
              return w
            }
          }))
          setActiveSessionId(id)
        }
        if (parsedData.type === "message-added") {
          const { id, sessionId, role, message } = parsedData.payload
          setWorkspaces(workspaces => workspaces.map(w => ({
            ...w,
            sessions: w.sessions.map(s => {
              if (s.id === sessionId) {
                return {
                  ...s,
                  messages: [...s.messages, { id, role, payload: { message } }]
                }
              } else {
                return s
              }
            })
          })))
        }
      }
    }
  },[loading,socket])
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        connecting...
      </div>
    )
  }
  return (
    <AppContext.Provider value={{workspaces, socket, setWorkspace: setWorkspaces, activeSessionId, setActiveSessionId}}>

    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <div className="w-72 shrink-0 border-r border-zinc-800">
        <Sidebar/>
      </div>
      <div className="flex-1 min-w-0">
        <ChatWindow/>
      </div>

    </div>
    </AppContext.Provider>
  );
}

function Sidebar() {
  const { socket, workspaces, setWorkspace } = useContext(AppContext)
  const [path, setPath] = useState("")
  const [expanded, setExpanded] = useState<string[]>([])

  function toggle(id: string) {
    setExpanded(expanded => expanded.includes(id) ? expanded.filter(x => x !== id) : [...expanded, id])
  }

  function addWorkspace() {
    if (!path.trim()) {
      return
    }
    setWorkspace((w:Workspace[]) => [...w, {
      path: path,
      name: path,
      id: null,
      sessions: []
    }])
    socket?.send(JSON.stringify({
      type: 'create-workspace',
      payload: {
        path
      }
    }))
    setPath("")
  }

  return <div className="flex h-full flex-col">
    <div className="border-b border-zinc-800 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Workspaces
      </div>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="/path/to/repo"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addWorkspace() }}
        />
        <button
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
          onClick={addWorkspace}
        >
          Add
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-2">
      {workspaces.length === 0 && (
        <div className="p-3 text-sm text-zinc-600">No workspaces yet.</div>
      )}
      {workspaces.map((w, i) => (
        <WorkspaceItem
          key={w.id ?? `pending-${i}`}
          workspace={w}
          open={w.id !== null && expanded.includes(w.id)}
          onToggle={() => w.id && toggle(w.id)}
        />
      ))}
    </div>
  </div>
}

function WorkspaceItem({ workspace, open, onToggle }: {
  workspace: Workspace
  open: boolean
  onToggle: () => void
}) {
  const { socket, activeSessionId, setActiveSessionId } = useContext(AppContext)
  const pending = workspace.id === null

  return <div className="mb-1">
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-zinc-900 disabled:opacity-50"
      onClick={onToggle}
      disabled={pending}
    >
      <span className={`text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-200">{workspace.name}</span>
        <span className="block truncate text-xs text-zinc-600">{workspace.path}</span>
      </span>
      {!pending && (
        <span className="rounded-full bg-zinc-800 px-1.5 text-xs text-zinc-400">
          {workspace.sessions.length}
        </span>
      )}
    </button>

    {open && (
      <div className="ml-4 border-l border-zinc-800 pl-2">
        {workspace.sessions.map((s: Session, i: number) => (
          <button
            key={s.id}
            className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
              s.id === activeSessionId
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-900"
            }`}
            onClick={() => setActiveSessionId(s.id)}
          >
            Session {i + 1}
            <span className="ml-2 text-xs text-zinc-600">{s.messages.length} msgs</span>
          </button>
        ))}
        <button
          className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
          onClick={() => {
            socket?.send(JSON.stringify({
              type: 'create-session',
              payload: {
                workspaceId: workspace.id
              }
            }))
          }}
        >
          + New session
        </button>
      </div>
    )}
  </div>
}

function ChatWindow() {
  const { socket, workspaces, activeSessionId } = useContext(AppContext)
  const [message, setMessage] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const workspace = workspaces.find(w => w.sessions.some(s => s.id === activeSessionId))
  const session = workspace?.sessions.find(s => s.id === activeSessionId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [session?.messages.length, activeSessionId])

  if (!session) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-600">
      Pick a session, or create one from a workspace.
    </div>
  }

  function send() {
    if (!message.trim() || !session) {
      return
    }
    socket?.send(JSON.stringify({
      type: 'add-message',
      payload: {
        sessionId: session.id,
        message
      }
    }))
    setMessage("")
  }

  return <div className="flex h-full flex-col">
    <div className="border-b border-zinc-800 px-5 py-3">
      <div className="text-sm font-medium text-zinc-200">{workspace?.name}</div>
      <div className="text-xs text-zinc-600">{workspace?.path}</div>
    </div>

    <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
      {session.messages.length === 0 && (
        <div className="text-sm text-zinc-600">No messages yet.</div>
      )}
      {session.messages.map(m => (
        <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
            m.role === "user"
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-900 text-zinc-200"
          }`}>
            {m.role === "user" ? m.payload.message : JSON.stringify(m.payload)}
          </div>
        </div>
      ))}
      <div ref={bottomRef}/>
    </div>

    <div className="border-t border-zinc-800 p-3">
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          placeholder="Send a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send() }}
        />
        <button
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          onClick={send}
        >
          Send
        </button>
      </div>
    </div>
  </div>
}

export default App;
