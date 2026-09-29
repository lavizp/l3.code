import mongoose from "mongoose"

/**
 * A project this app knows about.
 *
 * Skills themselves are never stored here — they are files on disk, and the
 * agents read them from there, so a copy in a database would only ever be a
 * stale second opinion. What is worth keeping is the list of folders to go
 * and look in, which is nothing the filesystem can tell us on its own.
 */
export const Workspace = new mongoose.Schema({
  path: String,
  name: String
})

export const WorkspaceModel = mongoose.model("Workspace", Workspace)
