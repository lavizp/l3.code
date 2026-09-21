import mongoose from "mongoose"

export const Workspace = new mongoose.Schema({
  path: String,
  name: String
})

export const Message = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant']
  },
  payload: Object
}, { timestamps: true })

export const Session = new mongoose.Schema({
  conversation: [Message],
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  /** Claude's conversation id, from before sessions could pick an agent. */
  anthropicSessionId: String,
  /** Id of the agent provider that runs this session's turns, for its life. */
  agent: String,
  /**
   * Agent id -> that agent's own conversation id. Keyed by agent because a
   * resume id only means anything to the provider that issued it; a session
   * is pinned to one agent, so in practice there is a single entry.
   */
  agentSessions: { type: Map, of: String }
})

export const SessionModel = mongoose.model("Session", Session)
export const WorkspaceModel = mongoose.model("Workspace", Workspace)
