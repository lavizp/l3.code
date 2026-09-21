import type { AssistantBlock, TextBlock, ToolBlock } from "commons/types"

/**
 * The assistant turn as it is being assembled: an ordered list of prose and
 * tool blocks, plus the indexes needed to grow them as events arrive. This is
 * what eventually gets persisted for the turn.
 */
export class TurnBlocks {
  readonly blocks: AssistantBlock[] = []
  private readonly texts = new Map<string, TextBlock>()
  private readonly tools = new Map<string, ToolBlock>()

  openText(id: string, text: string): void {
    const block: TextBlock = { kind: "text", id, text }
    this.texts.set(id, block)
    this.blocks.push(block)
  }

  /** Grow an open prose block. Unknown ids are ignored. */
  appendText(id: string, text: string): void {
    const block = this.texts.get(id)
    if (block) {
      block.text += text
    }
  }

  openTool(id: string, toolUseId: string, name: string, input: unknown): void {
    const block: ToolBlock = {
      kind: "tool",
      id,
      toolUseId,
      name,
      input,
      status: "running"
    }
    this.tools.set(toolUseId, block)
    this.blocks.push(block)
  }

  closeTool(toolUseId: string, result: string, isError: boolean): void {
    const block = this.tools.get(toolUseId)
    if (block) {
      block.result = result
      block.status = isError ? "error" : "done"
    }
  }

  /** Tools that never reported back, so the UI isn't left spinning on them. */
  abandonRunningTools(): ToolBlock[] {
    const abandoned: ToolBlock[] = []
    for (const tool of this.tools.values()) {
      if (tool.status === "running") {
        tool.status = "error"
        tool.result = tool.result ?? "No result returned."
        abandoned.push(tool)
      }
    }
    return abandoned
  }

  get isEmpty(): boolean {
    return this.blocks.length === 0
  }
}
