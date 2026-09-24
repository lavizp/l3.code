import { describe, failure, type Failure } from "commons/types"
import mongoose from "mongoose"

/**
 * Database trouble, told apart from a request that was simply wrong.
 *
 * Mongo answers a malformed id and an unreachable server with the same kind
 * of thrown object, and they are nothing alike: one is a client asking for
 * something that can't exist, the other is the server being down. Retrying
 * helps with exactly one of them.
 */
export function databaseFailure(cause: unknown, subject: string): Failure {
  const detail = describe(cause)

  if (cause instanceof mongoose.Error.CastError) {
    return failure("not-found", `No such ${subject}.`, { detail })
  }
  if (cause instanceof mongoose.Error.ValidationError) {
    return failure("bad-request", `That ${subject} isn't valid.`, { detail })
  }

  return failure(
    "database",
    "The server couldn't reach its database. Try again shortly.",
    {
      detail
    }
  )
}

/** Whether the connection is currently usable, for a fail-fast answer. */
export function databaseReady(): boolean {
  return mongoose.connection.readyState === 1
}

/** The failure to answer with when the database isn't connected at all. */
export function databaseDown(): Failure {
  return failure(
    "database",
    "The server isn't connected to its database yet. It keeps trying — this should clear on its own."
  )
}
