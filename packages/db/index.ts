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
  anthropicSessionId: String
})

export const SessionModel = mongoose.model("Session", Session)
export const WorkspaceModel = mongoose.model("Workspace", Workspace)
