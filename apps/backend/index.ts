import mongoose from "mongoose"
// Registers the built-in agent providers. Must run before any turn does.
import "./agents"
import { config } from "./config"
import { startServer } from "./transport/server"

mongoose
  .connect(config.dbUrl)
  .then(() => {
    startServer(config.port)
    console.log(`started on :${config.port}`)
  })
  .catch(e => {
    console.log(e)
  })
