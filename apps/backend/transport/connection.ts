import type { OutgoingMessageType } from "commons/types"
import type WebSocket from "ws"

/** One connected client, and the only way anything writes to its socket. */
export class Connection {
  constructor(
    readonly id: string,
    private readonly socket: WebSocket
  ) {}

  send(payload: OutgoingMessageType): void {
    if (this.socket.readyState !== this.socket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify(payload))
  }
}
