interface GlobalStatsConversionRow {
  date_id: string
  paying: number | string
  org_conversion_rate: number | string
  plan_enterprise: number | string
  plan_enterprise_conversion_rate: number | string
  plan_maker: number | string
  plan_maker_conversion_rate: number | string
  plan_solo: number | string
  plan_solo_conversion_rate: number | string
  plan_team: number | string
  plan_team_conversion_rate: number | string
  plan_total_conversion_rate: number | string
}

interface OrgCreatedRow {
  created_at: string
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateOrgConversionRate(paying: number | string, orgs: number | string) {
  const orgCount = numeric(orgs)
  if (orgCount <= 0)
    return 0
  return Number(((numeric(paying) / orgCount) * 100).toFixed(1))
}

function orgsCreatedByDate(orgRows: OrgCreatedRow[], dateId: string) {
  const end = Date.parse(`${dateId}T23:59:59.999Z`)
  return orgRows.filter(row => Date.parse(row.created_at) <= end).length
}

function planRates(row: GlobalStatsConversionRow, orgs: number) {
  return {
    enterprise: calculateOrgConversionRate(row.plan_enterprise, orgs),
    maker: calculateOrgConversionRate(row.plan_maker, orgs),
    solo: calculateOrgConversionRate(row.plan_solo, orgs),
    team: calculateOrgConversionRate(row.plan_team, orgs),
    total: calculateOrgConversionRate(row.paying, orgs),
  }
}

function currentPlanRates(row: GlobalStatsConversionRow) {
  return {
    enterprise: numeric(row.plan_enterprise_conversion_rate),
    maker: numeric(row.plan_maker_conversion_rate),
    solo: numeric(row.plan_solo_conversion_rate),
    team: numeric(row.plan_team_conversion_rate),
    total: numeric(row.plan_total_conversion_rate),
  }
}

export function buildOrgConversionRateBackfillRows(rows: GlobalStatsConversionRow[], orgRows: OrgCreatedRow[]) {
  return rows.map((row) => {
    const orgs = orgsCreatedByDate(orgRows, row.date_id)
    const current_rate = numeric(row.org_conversion_rate)
    const next_rate = calculateOrgConversionRate(row.paying, orgs)
    const current_plan_rates = currentPlanRates(row)
    const next_plan_rates = planRates(row, orgs)
    return {
      date_id: row.date_id,
      orgs,
      paying: numeric(row.paying),
      current_plan_rates,
      current_rate,
      next_plan_rates,
      next_rate,
      changed: current_rate !== next_rate || JSON.stringify(current_plan_rates) !== JSON.stringify(next_plan_rates),
    }
  })
}
