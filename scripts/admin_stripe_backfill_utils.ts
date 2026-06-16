export function getArgValue(args: string[], prefix: string): string | null {
  const arg = args.find(value => value.startsWith(`${prefix}=`))
  return arg ? arg.slice(prefix.length + 1) : null
}

export async function asyncPool<T>(limit: number, items: T[], iterator: (item: T) => Promise<void>) {
  const executing = new Set<Promise<void>>()
  for (const item of items) {
    const task = iterator(item).finally(() => executing.delete(task))
    executing.add(task)
    if (executing.size >= limit)
      await Promise.race(executing)
  }
  await Promise.all(executing)
}

export function parsePositiveInteger(value: string | null, label: string, fallback: number) {
  if (value === null)
    return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${label} must be a positive integer`)
  return parsed
}

export function isActionableStripeCustomerId(customerId: string | null | undefined) {
  const trimmedCustomerId = customerId?.trim()
  return !!trimmedCustomerId && !trimmedCustomerId.startsWith('pending_')
}
