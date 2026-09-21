import type { ReactNode } from "react"

/**
 * Inline markdown: code spans, emphasis, strikethrough and links.
 *
 * Underscore emphasis (_foo_, __foo__) is intentionally unsupported: in a tool
 * that talks about code, it mangles snake_case identifiers more often than it
 * italicises anything.
 */

// Code spans come first so markers inside them stay literal.
const INLINE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*|\[[^\]\n]*\]\([^\s)]+\))/

const LINK = /^\[([^\]]*)\]\(([^\s)]+)\)$/

const wraps = (part: string, marker: string) =>
  part.startsWith(marker) && part.endsWith(marker) && part.length > marker.length * 2

export function renderInline(text: string, key: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(part => part !== undefined && part !== "")
    .map((part, index) => {
      const k = `${key}:${index}`

      if (wraps(part, "`")) {
        return (
          <code
            key={k}
            className="rounded-sm bg-panel px-1 py-0.5 font-mono text-[13px] text-ink"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      if (wraps(part, "**")) {
        return (
          <strong key={k} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (wraps(part, "~~")) {
        return (
          <s key={k} className="text-dim">
            {part.slice(2, -2)}
          </s>
        )
      }
      if (wraps(part, "*")) {
        return <em key={k}>{part.slice(1, -1)}</em>
      }

      const link = LINK.exec(part)
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
