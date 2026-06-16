export const MIN_TERMINAL_COLS = 44
export const MIN_TERMINAL_ROWS = 11
export const PLATFORM_CARDS_MIN_COLS = 72
export const PLATFORM_CARDS_MIN_ROWS = 20

export type PlatformLayout = 'cards' | 'list'
export type PlatformKeyAction = { type: 'select', platform: 'ios' | 'android' } | { type: 'confirm' } | null

export interface ScrollState {
  scrollOffset: number
  maxScrollOffset: number
  viewportRows: number
}

export interface ScrollAction {
  scrollOffset: number
  follow: boolean
}

export function pickPlatformLayout(cols: number, rows: number): PlatformLayout {
  return cols >= PLATFORM_CARDS_MIN_COLS && rows >= PLATFORM_CARDS_MIN_ROWS ? 'cards' : 'list'
}

export function platformKeyAction(input: string, key: { leftArrow?: boolean, rightArrow?: boolean, return?: boolean }): PlatformKeyAction {
  if (key.return)
    return { type: 'confirm' }
  if (key.leftArrow || input === 'h' || input === '1')
    return { type: 'select', platform: 'ios' }
  if (key.rightArrow || input === 'l' || input === '2')
    return { type: 'select', platform: 'android' }
  return null
}

export function terminalMeetsMinimum(cols: number, rows: number) {
  return cols >= MIN_TERMINAL_COLS && rows >= MIN_TERMINAL_ROWS
}

export function resizePrompt(cols: number, rows: number) {
  if (terminalMeetsMinimum(cols, rows))
    return undefined
  const direction = cols < MIN_TERMINAL_COLS ? 'Widen' : 'Make taller'
  return `Terminal too small. ${direction} this window to at least ${MIN_TERMINAL_COLS} columns and ${MIN_TERMINAL_ROWS} rows.`
}

export function buildScrollAction(input: string, key: { upArrow?: boolean, downArrow?: boolean, pageUp?: boolean, pageDown?: boolean }, state: ScrollState): ScrollAction | null {
  if (key.upArrow || input === 'k')
    return scrollTo(state.scrollOffset - 1, state)
  if (key.downArrow || input === 'j')
    return scrollTo(state.scrollOffset + 1, state)
  if (key.pageUp)
    return scrollTo(state.scrollOffset - state.viewportRows, state)
  if (key.pageDown || input === ' ')
    return scrollTo(state.scrollOffset + state.viewportRows, state)
  if (input === 'g')
    return scrollTo(0, state)
  if (input === 'G')
    return scrollTo(state.maxScrollOffset, state)
  return null
}

export function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60)
    return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}m ${rest}s`
}

export function logBudgetRows(terminalRows: number, headerRows: number, bodyRows: number, paddingRows = 2) {
  return Math.max(0, terminalRows - headerRows - bodyRows - paddingRows - 1)
}

export function capLogRows<T>(entries: T[], maxRows: number) {
  if (maxRows <= 0)
    return { visible: [] as T[], hidden: entries.length }
  if (entries.length <= maxRows)
    return { visible: entries, hidden: 0 }
  if (maxRows === 1)
    return { visible: [] as T[], hidden: entries.length }
  const visibleCount = maxRows - 1
  return { visible: entries.slice(-visibleCount), hidden: entries.length - visibleCount }
}

export function isBuildCompleteDismissKey(input: string, key: { return?: boolean, escape?: boolean }) {
  return key.return === true || key.escape === true || input === 'q'
}

function scrollTo(nextOffset: number, state: ScrollState): ScrollAction {
  const scrollOffset = Math.max(0, Math.min(state.maxScrollOffset, nextOffset))
  return { scrollOffset, follow: scrollOffset === state.maxScrollOffset }
}
