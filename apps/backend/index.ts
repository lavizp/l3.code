import { WebSocketServer } from "ws";
import mongoose from "mongoose"
import { WorkspaceModel } from "db/client";
mongoose.connect(process.env.DB_URL!)

const server = new WebSocketServer({ port: 8080 })
console.log('started')
server.on("connection", (ws) => {
  ws.on("message", (msg) => {
    console.log(msg)
    WorkspaceModel.create({
      path: '123',
      name: '1234'
    })
  })
})
