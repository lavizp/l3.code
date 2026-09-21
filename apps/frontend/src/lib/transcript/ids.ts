/** Id of the in-flight assistant turn, swapped for the real one when it ends. */
export const liveId = (sessionId: string) => `live:${sessionId}`

/** Marks a message drawn locally that the server hasn't confirmed yet. */
const LOCAL_PREFIX = "local:"

export const localId = () =>
  `${LOCAL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const isLocalId = (id: string) => id.startsWith(LOCAL_PREFIX)
