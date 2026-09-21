/**
 * Tool results reach us in whatever shape the provider's SDK hands over — a
 * string, a list of MCP content blocks, or nothing at all. The transcript
 * only renders text, so every provider flattens through here.
 */
export function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text)
        }
        return JSON.stringify(part)
      })
      .join("\n")
  }
  if (content == null) {
    return ""
  }
  return JSON.stringify(content)
}
