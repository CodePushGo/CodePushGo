const ISO_COUNTRY_CODE_REGEX = /^[A-Z]{2}$/

export function normalizeStripeCountryCode(country: string | null | undefined) {
  if (!country)
    return null
  const normalized = country.trim().toUpperCase()
  return normalized && ISO_COUNTRY_CODE_REGEX.test(normalized) ? normalized : null
}

export function getCustomerProfileCountry(customer: { deleted?: boolean, address?: { country?: string | null } } | null | undefined) {
  if (!customer || customer.deleted)
    return null
  return normalizeStripeCountryCode(customer.address?.country ?? null)
}

export function shouldUpdateCustomerCountry(currentCountry: string | null | undefined, nextCountry: string | null, refreshExisting: boolean) {
  const normalizedCurrentCountry = normalizeStripeCountryCode(currentCountry)
  if (refreshExisting)
    return normalizedCurrentCountry !== nextCountry
  return normalizedCurrentCountry === null && nextCountry !== null
}
