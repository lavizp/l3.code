import { failure, unexpectedFailure, type Failure } from "commons/types"
import mongoose from "mongoose"
import { databaseFailure } from "./repositories/failure"

/**
 * An `Error` that already knows how it should be shown to a person.
 *
 * Throwing is how the layers here report trouble to their caller, but a
 * thrown `Error` carries only a sentence, and the edge of the server has to
 * guess the rest — whether it's worth retrying, whether it's the client's
 * fault or ours. Anything that knows the answer throws this instead and the
 * guessing is skipped.
 */
export class FailureError extends Error {
  constructor(readonly failure: Failure) {
    super(failure.message)
    this.name = "FailureError"
  }
}

export function fail(...args: Parameters<typeof failure>): never {
  throw new FailureError(failure(...args))
}

/**
 * Whatever was thrown, as something worth showing. Anything that classified
 * itself on the way up is taken at its word; the rest is a bug here until
 * proven otherwise, and is reported as one rather than leaked to the client
 * as a stack-shaped sentence.
 */
export function toFailure(cause: unknown): Failure {
  if (cause instanceof FailureError) {
    return cause.failure
  }
  if (cause instanceof mongoose.Error || cause instanceof mongoose.mongo.MongoError) {
    return databaseFailure(cause, "record")
  }
  return unexpectedFailure(cause, "Something went wrong on the server.")
}
