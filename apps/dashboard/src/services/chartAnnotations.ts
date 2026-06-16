interface ChartLike {
  ctx?: CanvasRenderingContext2D | null | Record<string, unknown>
  canvas?: { isConnected?: boolean } | null
  chartArea?: { left?: number, right?: number }
  scales?: {
    x?: { getPixelForValue?: (value: unknown) => number }
    y?: { getPixelForValue?: (value: unknown) => number }
  }
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

export const inlineAnnotationPlugin = {
  id: 'inlineAnnotation',
  afterDatasetsDraw(chart: ChartLike, _args: unknown, options: Record<string, unknown> = {}) {
    if (!hasDrawableCanvas(chart))
      return

    const ctx = chart.ctx as Record<string, unknown>
    callIfFunction(ctx, 'save')

    for (const [key, annotation] of Object.entries(options)) {
      if (!annotation || typeof annotation !== 'object')
        continue
      const record = annotation as Record<string, unknown>
      if (key.startsWith('line_')) {
        const yValue = typeof record.yMin === 'number' ? record.yMin : record.yMax
        const y = chart.scales?.y?.getPixelForValue?.(yValue)
        const left = chart.chartArea?.left
        const right = chart.chartArea?.right
        if (typeof y === 'number' && typeof left === 'number' && typeof right === 'number') {
          callIfFunction(ctx, 'beginPath')
          callIfFunction(ctx, 'moveTo', left, y)
          callIfFunction(ctx, 'lineTo', right, y)
          callIfFunction(ctx, 'stroke')
        }
      }
      if (key.startsWith('label_')) {
        const content = Array.isArray(record.content) ? record.content.join(' ') : String(record.content ?? '')
        const x = chart.scales?.x?.getPixelForValue?.(record.xValue)
        const y = chart.scales?.y?.getPixelForValue?.(record.yValue)
        if (content && typeof x === 'number' && typeof y === 'number')
          callIfFunction(ctx, 'fillText', content, x, y)
      }
    }

    callIfFunction(ctx, 'restore')
  },
}
