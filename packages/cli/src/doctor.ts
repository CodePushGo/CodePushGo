export function computeDoctorAnalyticsTags(installed: Record<string, string>, latest: Record<string, string>) {
  const dependencyCount = Object.keys(installed).length
  const outdatedCount = Object.entries(installed).filter(([name, version]) => latest[name] !== undefined && latest[name] !== version).length
  return {
    is_outdated: outdatedCount > 0,
    dependency_count: dependencyCount,
    outdated_count: outdatedCount,
  }
}
