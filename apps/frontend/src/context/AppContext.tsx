import type { Workspace } from "commons/types";
import { createContext } from "react";

export const AppContext = createContext<{
  workspaces: Workspace[]
  socket: WebSocket | null
  setWorkspace: any
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
}>({
  workspaces: [],
  socket: null,
  setWorkspace: null,
  activeSessionId: null,
  setActiveSessionId: () => {}
})
