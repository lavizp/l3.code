import type { Workspace } from "commons/types";
import { createContext } from "react";

export const AppContext = createContext<{
  workspaces: Workspace[]
  socket: WebSocket | null
  setWorkspace: any
}>({
  workspaces: [],
  socket: null,
  setWorkspace: null
})
