/**
 * Block-level markdown parsing.
 *
 * Deliberately tolerant of half-finished syntax — text arrives a token at a
 * time, so an unclosed fence is a normal intermediate state, not an error.
 */

export type Block =
  | { type: "p"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" }

const FENCE = /^\s*```(.*)$/
const CLOSING_FENCE = /^\s*```\s*$/
const HEADING = /^(#{1,6})\s+(.*)$/
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBER = /^\s*\d+\.\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    BULLET.test(line) ||
    NUMBER.test(line) ||
    QUOTE.test(line) ||
    !line.trim()
  )
}

export function parseBlocks(source: string): Block[] {
  const lines = source.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    const fence = FENCE.exec(line)
    if (fence) {
      const lang = fence[1]!.trim()
      const body: string[] = []
      i++
      while (i < lines.length && !CLOSING_FENCE.test(lines[i]!)) {
        body.push(lines[i]!)
        i++
      }
      // Skip the closing fence when there is one; an unclosed fence still
      // renders, which is what a stream mid-code-block looks like.
      if (i < lines.length) {
        i++
      }
      blocks.push({ type: "code", lang, text: body.join("\n") })
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" })
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]! })
      i++
      continue
    }

    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length) {
        const quoted = QUOTE.exec(lines[i]!)
        if (!quoted) break
        body.push(quoted[1]!)
        i++
      }
      blocks.push({ type: "quote", text: body.join("\n") })
      continue
    }

    const ordered = NUMBER.test(line)
    if (ordered || BULLET.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const match = ordered ? NUMBER.exec(lines[i]!) : BULLET.exec(lines[i]!)
        if (!match) break
        items.push(match[1]!)
        i++
      }
      blocks.push({ type: "list", ordered, items })
      continue
    }

    const paragraph: string[] = [line]
    i++
    while (i < lines.length && !startsBlock(lines[i]!)) {
      paragraph.push(lines[i]!)
      i++
    }
    blocks.push({ type: "p", text: paragraph.join("\n") })
  }

  return blocks
}
