export type DiffLine = { kind: 'eq' | 'add' | 'del', text: string }

function splitPreservingTrailingNewline(value: string) {
  return value === '' ? [] : value.split('\n')
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitPreservingTrailingNewline(before)
  const b = splitPreservingTrailingNewline(after)
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--)
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  }

  const result: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ kind: 'eq', text: a[i]! })
      i++
      j++
    }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      result.push({ kind: 'del', text: a[i]! })
      i++
    }
    else {
      result.push({ kind: 'add', text: b[j]! })
      j++
    }
  }
  while (i < a.length)
    result.push({ kind: 'del', text: a[i++]! })
  while (j < b.length)
    result.push({ kind: 'add', text: b[j++]! })
  return result
}
