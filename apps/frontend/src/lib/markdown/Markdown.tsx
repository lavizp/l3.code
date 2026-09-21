import type { ReactNode } from "react"
import { renderInline } from "./inline"
import { parseBlocks, type Block } from "./parse"

/**
 * A small markdown renderer for assistant output. It builds React elements
 * rather than HTML, so nothing the model writes can inject markup.
 */

const HEADING_CLASS: Record<number, string> = {
  1: "text-lg font-semibold",
  2: "text-base font-semibold",
  3: "text-[15px] font-medium",
  4: "text-[15px] font-medium",
  5: "text-[14px] font-medium",
  6: "text-[14px] font-medium"
}

/** The streaming cursor: proof the agent is still typing. */
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
