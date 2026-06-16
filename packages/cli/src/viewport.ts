import { sanitizeBuildLogLines } from './build/log'

export type DiffLine = { kind: 'add' | 'remove' | 'context', text: string }

export function truncateToWidth(value: string, cols: number) {
  const width = Math.max(1, cols)
  if (value.length <= width)
    return value
  return `${value.slice(0, Math.max(0, width - 1))}…`
}

export function buildOutputViewport(lines: string[], terminalRows: number, terminalCols: number) {
  const visibleRows = Math.max(1, terminalRows)
  return lines.slice(-visibleRows).map(line => truncateToWidth(line, terminalCols))
}

export function sanitizedBuildOutputViewport(input: string, terminalRows: number, terminalCols: number) {
  return buildOutputViewport(sanitizeBuildLogLines(input), terminalRows, terminalCols)
}

export function diffViewport(lines: DiffLine[], terminalRows: number, terminalCols: number, chromeRows = 7) {
  const visibleRows = Math.max(1, terminalRows - chromeRows)
  return lines.slice(0, visibleRows).map((line, index) => {
    const prefix = `${String(index + 1).padStart(4, ' ')} ${line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '} `
    return truncateToWidth(`${prefix}${line.text}`, terminalCols)
  })
}
