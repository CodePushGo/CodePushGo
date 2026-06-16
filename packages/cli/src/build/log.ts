const escapeCharacter = String.fromCharCode(27)
const ansiPattern = new RegExp(`${escapeCharacter}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'g')

function expandTabs(line: string) {
  let column = 0
  let output = ''
  for (const char of line) {
    if (char === '\t') {
      const spaces = 8 - (column % 8)
      output += ' '.repeat(spaces)
      column += spaces
      continue
    }
    output += char
    column += 1
  }
  return output
}
function stripControlBytes(line: string) {
  return Array.from(line).filter((char) => {
    const code = char.charCodeAt(0)
    return code === 9 || code >= 32 && code !== 127
  }).join('')
}

function cleanBuildLogLine(line: string) {
  return expandTabs(stripControlBytes(line.replace(ansiPattern, '')))
}

export function sanitizeBuildLogLines(input: string): string[] {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').map(cleanBuildLogLine)
  if (lines.at(-1) === '')
    lines.pop()
  return lines
}
