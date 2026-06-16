export interface ReadDevicesOrder {
  key: 'device_id' | 'updated_at'
  sortable: 'asc' | 'desc'
}

export interface ReadDevicesQueryInput {
  app_id: string
  cursor?: string
  limit?: number
  order?: ReadDevicesOrder[]
}

export function formatDateCF(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function sqlString(value: string) {
  return value.replaceAll("'", "''")
}

function parseCursor(cursor: string) {
  const [date, deviceId] = cursor.split('|')
  return { date: sqlString(date), deviceId: sqlString(deviceId ?? '') }
}

export function buildReadDevicesCFQuery(input: ReadDevicesQueryInput, _includeDeleted = false) {
  const order = input.order?.[0]
  const limit = Math.max(1, input.limit ?? 100)
  const grouped = [
    'SELECT blob1 AS device_id, max(timestamp) AS updated_at',
    'FROM devices',
    `WHERE app_id = '${sqlString(input.app_id)}'`,
    'GROUP BY blob1',
  ]

  const page: string[] = []
  if (input.cursor) {
    const cursor = parseCursor(input.cursor)
    if (!order || order.key === 'device_id') {
      page.push(`WHERE device_id > '${cursor.deviceId}'`)
    }
    else {
      const operator = order.sortable === 'desc' ? '<' : '>'
      page.push(`WHERE (updated_at ${operator} toDateTime('${cursor.date}') OR (updated_at = toDateTime('${cursor.date}') AND device_id > '${cursor.deviceId}'))`)
    }
  }

  if (order?.key === 'updated_at')
    page.push(`ORDER BY updated_at ${order.sortable.toUpperCase()}, device_id ASC`)
  else
    page.push('ORDER BY device_id ASC')
  page.push(`LIMIT ${limit + 1}`)

  return `SELECT * FROM (${grouped.join('\n')}) grouped_devices\n${page.join('\n')}`
}
