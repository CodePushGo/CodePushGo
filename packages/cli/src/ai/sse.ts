export interface SseEvent {
  event: string
  data: string
}

export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = ''

  return (chunk: string) => {
    buffer += chunk
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      dispatchFrame(frame, onEvent)
      boundary = buffer.indexOf('\n\n')
    }
  }
}

function dispatchFrame(frame: string, onEvent: (event: SseEvent) => void) {
  let event = 'message'
  const data: string[] = []

  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':'))
      continue
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'event')
      event = value
    else if (field === 'data')
      data.push(value)
  }

  if (data.length > 0)
    onEvent({ event, data: data.join('\n') })
}
