import type { Failure, OutgoingMessageType } from "commons/types"
import type WebSocket from "ws"

/** One connected client, and the only way anything writes to its socket. */
export class Connection {
  /**
   * Aborted when the client goes away, so work started on its behalf — a
   * filesystem walk across several agents' skill roots — stops rather than
   * finishing into a socket nobody is reading.
   */
  private readonly gone = new AbortController()

  constructor(
    readonly id: string,
    private readonly socket: WebSocket
  ) {}

  get signal(): AbortSignal {
    return this.gone.signal
  }

  get open(): boolean {
    return this.socket.readyState === this.socket.OPEN
  }

  send(payload: OutgoingMessageType): void {
    if (!this.open) {
      return
    }
    try {
      this.socket.send(JSON.stringify(payload))
    } catch (cause) {
      // A socket that fails mid-write is a socket that is closing; the close
      // handler will clean up. Nothing here can be reported to the client.
      console.error("Couldn't write to a client:", cause)
    }
  }

  /** Report a failure to this client. */
  fail(error: Failure): void {
    this.send({ type: "error", payload: { error } })
  }

  /** The client is gone: stop anything still running on its behalf. */
  close(): void {
    this.gone.abort(new Error("The client disconnected."))
  }
}
