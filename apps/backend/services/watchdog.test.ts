import { expect, test } from "bun:test"
import { withIdleTimeout } from "./watchdog"

/** A stream that yields each value after waiting the paired number of ms. */
async function* paced(steps: Array<[number, string]>): AsyncGenerator<string> {
  for (const [delay, value] of steps) {
    await Bun.sleep(delay)
    yield value
  }
}

test("passes everything through when the gaps are short enough", async () => {
  const seen: string[] = []
  let stalled = false

  for await (const value of withIdleTimeout(
    paced([
      [1, "a"],
      [1, "b"],
      [1, "c"]
    ]),
    { idleMs: 60, onStall: () => (stalled = true) }
  )) {
    seen.push(value)
  }

  expect(seen).toEqual(["a", "b", "c"])
  expect(stalled).toBe(false)
})

test("gives up on a gap longer than the limit, keeping what came before", async () => {
  const seen: string[] = []
  let stalled = false

  for await (const value of withIdleTimeout(
    paced([
      [1, "a"],
      [200, "never arrives"]
    ]),
    { idleMs: 25, onStall: () => (stalled = true) }
  )) {
    seen.push(value)
  }

  expect(seen).toEqual(["a"])
  expect(stalled).toBe(true)
})

test("a slow stream that keeps talking is never cut off", async () => {
  // Four gaps, each comfortably inside the limit, adding up to well past it:
  // total time is not what the watchdog is measuring.
  const seen: string[] = []
  let stalled = false

  for await (const value of withIdleTimeout(
    paced([
      [20, "a"],
      [20, "b"],
      [20, "c"],
      [20, "d"]
    ]),
    { idleMs: 50, onStall: () => (stalled = true) }
  )) {
    seen.push(value)
  }

  expect(seen).toEqual(["a", "b", "c", "d"])
  expect(stalled).toBe(false)
})

test("a stream that fails fast is a failure, not a stall", async () => {
  async function* broken(): AsyncGenerator<string> {
    yield "a"
    throw new Error("the agent died")
  }

  let stalled = false
  const seen: string[] = []

  const read = async () => {
    for await (const value of withIdleTimeout(broken(), {
      idleMs: 1000,
      onStall: () => (stalled = true)
    })) {
      seen.push(value)
    }
  }

  await expect(read()).rejects.toThrow("the agent died")
  expect(stalled).toBe(false)
})

test("nothing at all within the limit still ends the stream", async () => {
  let stalled = false
  const seen: string[] = []

  for await (const value of withIdleTimeout(paced([[200, "a"]]), {
    idleMs: 20,
    onStall: () => (stalled = true)
  })) {
    seen.push(value)
  }

  expect(seen).toEqual([])
  expect(stalled).toBe(true)
})
