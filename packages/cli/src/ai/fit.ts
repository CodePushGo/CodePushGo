export const AI_RESULT_CHROME_ROWS = 10
export const AI_RUNNING_CHROME_ROWS = 8

const escapeCharacter = String.fromCharCode(27)
const ansiPattern = new RegExp(`${escapeCharacter}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'g')

export type AiRoute = 'ai-analysis-result' | 'ai-analysis-result-scroll'

export interface AiRouteInput {
  current: AiRoute
  text: string | null
  viewedFull: boolean
  terminalRows: number
  terminalCols: number
}

export function stripAnsi(value: string) {
  return value.replace(ansiPattern, '')
}

export function estimateRenderedRows(text: string, terminalCols: number) {
  if (text === '')
    return 0
  const width = Math.max(1, terminalCols)
  return text.split('\n').reduce((rows, line) => {
    const visibleLength = stripAnsi(line).length
    return rows + Math.max(1, Math.ceil(visibleLength / width))
  }, 0)
}

export function isAiAnalysisTooTall(text: string, terminalRows: number, terminalCols: number) {
  if (text === '')
    return false
  const contentRows = estimateRenderedRows(text, terminalCols)
  const budget = Math.max(1, terminalRows - AI_RESULT_CHROME_ROWS)
  return contentRows > budget
}

export function pickVisibleLines(lines: string[], scrollOffset: number, viewportRows: number, terminalCols: number) {
  if (lines.length === 0 || scrollOffset >= lines.length || viewportRows <= 0)
    return []

  const visible: string[] = []
  let rowsUsed = 0
  for (const line of lines.slice(Math.max(0, scrollOffset))) {
    const lineRows = estimateRenderedRows(line, terminalCols)
    visible.push(line)
    rowsUsed += lineRows
    if (rowsUsed >= viewportRows)
      break
  }
  return visible
}

export function computeMaxScrollOffset(lines: string[], viewportRows: number, terminalCols: number) {
  if (lines.length === 0 || viewportRows <= 0)
    return 0
  let rowsUsed = 0
  let count = 0
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const rows = estimateRenderedRows(lines[index] ?? '', terminalCols)
    if (count > 0 && rowsUsed + rows > viewportRows)
      break
    rowsUsed += rows
    count += 1
    if (rowsUsed >= viewportRows)
      break
  }
  return Math.max(0, lines.length - count)
}

export function resolveAiResultRoute(input: AiRouteInput) {
  if (input.text === null || input.viewedFull)
    return null
  const tooTall = isAiAnalysisTooTall(input.text, input.terminalRows, input.terminalCols)
  if (input.current === 'ai-analysis-result' && tooTall)
    return 'ai-analysis-result-scroll'
  if (input.current === 'ai-analysis-result-scroll' && !tooTall)
    return 'ai-analysis-result'
  return null
}

export function pickAiPreviewTail(text: string, terminalRows: number, terminalCols: number) {
  const lines = text === '' ? [] : text.split('\n')
  const budget = Math.max(1, terminalRows - AI_RUNNING_CHROME_ROWS)
  const offset = computeMaxScrollOffset(lines, budget, terminalCols)
  return {
    rows: lines.slice(offset),
    hidden: offset,
  }
}
