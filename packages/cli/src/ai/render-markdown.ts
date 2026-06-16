const RESET = '\x1B[0m'
const BOLD = '\x1B[1m'
const GREEN = '\x1B[32m'
const YELLOW = '\x1B[33m'
const CYAN = '\x1B[36m'
const DIM = '\x1B[2m'
const GRAY = '\x1B[90m'

export interface MarkdownLineRenderer {
  renderLine(line: string): string | null
}

export function createMarkdownLineRenderer(): MarkdownLineRenderer {
  let inFence = false

  return {
    renderLine(line: string) {
      if (line.trim().startsWith('```')) {
        inFence = !inFence
        return null
      }

      if (inFence)
        return `${GRAY}| ${RESET}${line}`

      const header = line.match(/^\s{0,3}#{1,6}\s+(.+)$/)
      if (header)
        return `${BOLD}${GREEN}${styleInline(header[1] ?? '')}${RESET}`

      const numbered = line.match(/^(\d+\.)\s+(.*)$/)
      if (numbered)
        return `${YELLOW}${numbered[1]}${RESET} ${styleInline(numbered[2] ?? '')}`

      const bullet = line.match(/^[-*]\s+(.*)$/)
      if (bullet)
        return `${YELLOW}*${RESET} ${styleInline(bullet[1] ?? '')}`

      return styleInline(line)
    },
  }
}

export function renderMarkdown(markdown: string, isTTY: boolean): string {
  if (!isTTY)
    return markdown

  const renderer = createMarkdownLineRenderer()
  return markdown.split('\n').map(line => renderer.renderLine(line)).filter((line): line is string => line !== null).join('\n')
}

function styleInline(line: string) {
  return line
    .replace(/`([^`]+)`/g, `${CYAN}${DIM}$1${RESET}`)
    .replace(/\*\*([^*]+)\*\*/g, `${BOLD}$1${RESET}`)
}
