import { describe, expect, it } from 'vitest'
import { computeDoctorAnalyticsTags } from '../src/doctor'

describe('[Capgo parity] doctor analytics tags', () => {
  it('counts dependencies and outdated packages', () => {
    expect(computeDoctorAnalyticsTags(
      { '@codepushgo/react-native-updater': '1.0.0', react: '19.0.0' },
      { '@codepushgo/react-native-updater': '1.1.0', react: '19.0.0' },
    )).toEqual({ is_outdated: true, dependency_count: 2, outdated_count: 1 })
    expect(computeDoctorAnalyticsTags({}, {})).toEqual({ is_outdated: false, dependency_count: 0, outdated_count: 0 })
  })
})
