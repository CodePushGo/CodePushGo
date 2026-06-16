#!/usr/bin/env node
import { Command } from 'commander'
import {
  handleAppsCreate,
  handleAppsList,
  handleBundle,
  handleBundlesList,
  handleInit,
  handleKeyCreate,
  handleRelease,
  handleUpload,
} from './commands'

const program = new Command()

function addCommonOptions(command: Command) {
  return command
    .option('--app-id <appId>', 'React Native bundle id, for example com.example.app')
    .option('--endpoint <url>', 'CodePushGo Worker endpoint')
    .option('--token <token>', 'CodePushGo API token')
    .option('--channel <channel>', 'Release channel', 'production')
}

function addBundleOptions(command: Command) {
  return command
    .requiredOption('--platform <platform>', 'React Native platform: ios or android')
    .option('--entry-file <file>', 'React Native entry file', 'index.js')
    .option('--out-dir <dir>', 'Bundle output directory')
    .option('--dev', 'Create a development bundle', false)
    .option('--sourcemap', 'Emit a Metro source map', false)
}

function addUploadOptions(command: Command) {
  return command
    .requiredOption('--platform <platform>', 'React Native platform: ios or android')
    .requiredOption('--version <version>', 'Release version')
    .requiredOption('--bundle-dir <dir>', 'Directory to zip and upload')
    .option('--mandatory', 'Mark release mandatory', false)
    .option('--rollout <percent>', 'Rollout percentage', '100')
    .option('--notes <notes>', 'Release notes')
    .option('--encrypt', 'Encrypt the uploaded bundle with CodePushGo RSA keys', false)
    .option('--key <file>', 'Private RSA key file for encrypted uploads')
    .option('--public-key <file>', 'Public RSA key file for encrypted uploads')
}

function addReleaseOptions(command: Command) {
  return addCommonOptions(addBundleOptions(command))
    .requiredOption('--version <version>', 'Release version')
    .option('--mandatory', 'Mark release mandatory', false)
    .option('--rollout <percent>', 'Rollout percentage', '100')
    .option('--notes <notes>', 'Release notes')
    .option('--encrypt', 'Encrypt the uploaded bundle with CodePushGo RSA keys', false)
    .option('--key <file>', 'Private RSA key file for encrypted uploads')
    .option('--public-key <file>', 'Public RSA key file for encrypted uploads')
}

program
  .name('codepushgo')
  .description('React Native live update CLI for CodePushGo')
  .version('0.1.0')

addCommonOptions(program.command('init'))
  .description('Create codepushgo.config.json from the detected React Native bundle id and sync it when authenticated')
  .option('--name <name>', 'App display name')
  .option('--platform <platform>', 'Prefer the bundle id for ios or android')
  .option('--no-connect', 'Skip backend app sync during init')
  .action(handleInit)

const app = program.command('app').description('Manage apps')
addCommonOptions(app.command('add [appId]'))
  .description('Create or update an app. Defaults to the detected React Native bundle id.')
  .option('--name <name>', 'App display name')
  .action((appId, options) => handleAppsCreate(options, appId))
addCommonOptions(app.command('list'))
  .description('List apps')
  .action(handleAppsList)

const apps = program.command('apps').description('Manage apps')
addCommonOptions(apps.command('create [appId]'))
  .description('Create or update an app. Alias for app add.')
  .option('--name <name>', 'App display name')
  .action((appId, options) => handleAppsCreate(options, appId))
addCommonOptions(apps.command('list'))
  .description('List apps')
  .action(handleAppsList)

const key = program.command('key').description('Manage bundle encryption keys')
key.command('create')
  .description('Create CodePushGo bundle encryption keys')
  .option('--force', 'Overwrite existing key files', false)
  .action(handleKeyCreate)

const bundle = program.command('bundle').description('Manage React Native bundles')
addUploadOptions(addCommonOptions(bundle.command('upload [appId]')))
  .description('Zip and upload an existing React Native bundle directory. Defaults app id to the RN bundle id.')
  .action((appId, options) => handleUpload(options, appId))
addCommonOptions(bundle.command('list [appId]'))
  .description('List app bundles. Defaults app id to the RN bundle id.')
  .action((appId, options) => handleBundlesList(options, appId))
addBundleOptions(bundle.command('build'))
  .description('Run react-native bundle with CodePushGo defaults')
  .action(handleBundle)

const bundles = program.command('bundles').description('Manage bundles')
addCommonOptions(bundles.command('list [appId]'))
  .description('List app bundles')
  .action((appId, options) => handleBundlesList(options, appId))

addBundleOptions(program.command('bundle-build'))
  .description('Run react-native bundle with CodePushGo defaults')
  .action(handleBundle)

addUploadOptions(addCommonOptions(program.command('upload [appId]')))
  .description('Zip and upload an existing React Native bundle directory')
  .action((appId, options) => handleUpload(options, appId))

addReleaseOptions(program.command('release [appId]'))
  .description('Bundle, zip, and upload a React Native release. Defaults app id to the RN bundle id.')
  .action((appId, options) => handleRelease(options, appId))

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
