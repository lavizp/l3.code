import type { ReactNode } from "react"

/**
 * A small markdown renderer for assistant output.
 *
 * It builds React elements rather than HTML, so nothing the model writes can
 * inject markup, and it is deliberately tolerant of half-finished syntax —
 * text arrives a token at a time, so an unclosed fence or a lone `**` is a
 * normal intermediate state, not an error.
 *
 * Underscore emphasis (_foo_, __foo__) is intentionally unsupported: in a tool
 * that talks about code, it mangles snake_case identifiers more often than it
 * italicises anything.
 */

type Block =
  | { type: "p"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" }

const FENCE = /^\s*```(.*)$/
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

function parseBlocks(source: string): Block[] {
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
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) {
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

// Code spans come first so markers inside them stay literal.
const INLINE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*|\[[^\]\n]*\]\([^\s)]+\))/

function renderInline(text: string, key: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(part => part !== undefined && part !== "")
    .map((part, index) => {
      const k = `${key}:${index}`

      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={k}
            className="rounded-sm bg-panel px-1 py-0.5 font-mono text-[13px] text-ink"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={k} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
        return (
          <s key={k} className="text-dim">
            {part.slice(2, -2)}
          </s>
        )
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={k}>{part.slice(1, -1)}</em>
      }

      const link = /^\[([^\]]*)\]\(([^\s)]+)\)$/.exec(part)
      if (link) {
        return (
          <a
            key={k}
            href={link[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-signal"
          >
            {link[1] || link[2]}
          </a>
        )
      }

      return <span key={k}>{part}</span>
    })
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-lg font-semibold",
  2: "text-base font-semibold",
  3: "text-[15px] font-medium",
  4: "text-[15px] font-medium",
  5: "text-[14px] font-medium",
  6: "text-[14px] font-medium"
}

const Caret = () => <span className="caret" aria-hidden />

function renderBlock(block: Block, index: number, caret: boolean): ReactNode {
  const key = `b${index}`

  switch (block.type) {
    case "heading":
      return (
        <p key={key} className={`${HEADING_CLASS[block.level] ?? ""} text-ink`}>
          {renderInline(block.text, key)}
          {caret && <Caret />}
        </p>
      )

    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-sm border border-rule bg-panel p-3 font-mono text-[13px] leading-relaxed text-ink/90"
        >
          <code>{block.text}</code>
          {caret && <Caret />}
        </pre>
      )

    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag
          key={key}
          className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-dim`}
        >
          {block.items.map((item, i) => (
            <li key={`${key}:${i}`}>
              {renderInline(item, `${key}:${i}`)}
              {caret && i === block.items.length - 1 && <Caret />}
            </li>
          ))}
        </Tag>
      )
    }

    case "quote":
      return (
        <blockquote key={key} className="border-l-2 border-rule pl-3 text-dim">
          {renderInline(block.text, key)}
          {caret && <Caret />}
        </blockquote>
      )

    case "hr":
      return <hr key={key} className="border-rule" />

    default:
      return (
        <p key={key} className="whitespace-pre-wrap">
          {renderInline(block.text, key)}
          {caret && <Caret />}
        </p>
      )
  }
}

/**
 * @param caret draws the streaming cursor at the end of the last block.
 */
export function Markdown({ text, caret = false }: { text: string; caret?: boolean }) {
  const blocks = parseBlocks(text)

  if (blocks.length === 0) {
    return caret ? <Caret /> : null
  }

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink">
      {blocks.map((block, i) => renderBlock(block, i, caret && i === blocks.length - 1))}
    </div>
  )
}
