import { useContext, useEffect, useState } from "react";
import { AppContext } from "./context/AppContext";
import { useSocket } from "./hooks/useSocket";
import type {Workspace} from "commons/types"
import "./index.css";

export function App() {
  const {loading, socket} = useSocket()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

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
      }
    }
  },[loading,socket])
  if (loading) {
    return (
      <div>loading...</div>
    )
  }
  return (
    <AppContext.Provider value={{workspaces, socket, setWorkspace: setWorkspaces}}>

    <div className="flex">
      <div className="flex-1">
        <Sidebar/>
      </div>
      <div className="flex-6">
        chat window
      </div>

    </div>
    </AppContext.Provider>
  );
}
function Sidebar() {
  const { socket, workspaces, setWorkspace } = useContext(AppContext)
  const [path, setPath] = useState("")
  return <div>
    {JSON.stringify(workspaces)}
    <input placeholder="path" type="text" onChange={(e) => {
      setPath(e.target.value)
    }}/>
    <button onClick={() => {
      setWorkspace((w:Workspace[]) => [...w, {
        path: path,
        id: null
      }])
      socket?.send(JSON.stringify({
        type: 'create-workspace',
        payload: {
          path
        }
      }))
      setPath("")
    }}>
      Add
    </button>
  </div>
}

export default App;
