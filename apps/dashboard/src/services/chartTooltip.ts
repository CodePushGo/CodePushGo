interface ChartLike {
  ctx?: CanvasRenderingContext2D | null | Record<string, unknown>
  canvas?: { isConnected?: boolean } | null
  tooltip?: { getActiveElements?: () => Array<{ element?: { x?: number } }> }
  scales?: {
    x?: { getPixelForValue?: (value: unknown) => number }
    y?: { top?: number, bottom?: number }
  }
  chartArea?: { top?: number, bottom?: number }
}

function hasDrawableCanvas(chart: ChartLike) {
  return !!chart.ctx && chart.canvas?.isConnected !== false
}

function callIfFunction<T extends object, K extends keyof T>(target: T, key: K, ...args: unknown[]) {
  const fn = target[key]
  if (typeof fn !== 'function')
    return
  const callable = fn as (...args: unknown[]) => unknown
  callable(...args)
}

export const verticalLinePlugin = {
  id: 'verticalLine',
  afterDatasetsDraw(chart: ChartLike) {
    if (!hasDrawableCanvas(chart))
      return

    const active = chart.tooltip?.getActiveElements?.() ?? []
    const x = active[0]?.element?.x
    if (typeof x !== 'number')
      return

    const ctx = chart.ctx as Record<string, unknown>
    const top = chart.scales?.y?.top ?? chart.chartArea?.top
    const bottom = chart.scales?.y?.bottom ?? chart.chartArea?.bottom
    if (typeof top !== 'number' || typeof bottom !== 'number')
      return

    callIfFunction(ctx, 'save')
    callIfFunction(ctx, 'beginPath')
    callIfFunction(ctx, 'moveTo', x, top)
    callIfFunction(ctx, 'lineTo', x, bottom)
    callIfFunction(ctx, 'stroke')
    callIfFunction(ctx, 'restore')
  },
}

export const todayLinePlugin = {
  id: 'todayLine',
  afterDatasetsDraw(chart: ChartLike, _args: unknown, options: { enabled?: boolean, xIndex?: number, label?: string } = {}) {
    if (!options.enabled || !hasDrawableCanvas(chart))
      return

    const x = chart.scales?.x?.getPixelForValue?.(options.xIndex ?? 0)
    if (typeof x !== 'number')
      return

    const ctx = chart.ctx as Record<string, unknown>
    const top = chart.chartArea?.top ?? chart.scales?.y?.top
    const bottom = chart.chartArea?.bottom ?? chart.scales?.y?.bottom
    if (typeof top !== 'number' || typeof bottom !== 'number')
      return

    callIfFunction(ctx, 'save')
    callIfFunction(ctx, 'beginPath')
    callIfFunction(ctx, 'moveTo', x, top)
    callIfFunction(ctx, 'lineTo', x, bottom)
    callIfFunction(ctx, 'stroke')
    if (options.label)
      callIfFunction(ctx, 'fillText', options.label, x + 4, top + 12)
    callIfFunction(ctx, 'restore')
  },
}
