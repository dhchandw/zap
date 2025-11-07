#!/usr/bin/env node

/**
 * Script to inject Windows metadata into pkg-generated executables
 */

const ResEdit = require('resedit')
const fs = require('fs')
const path = require('path')

const config = {
  name: 'zap',
  displayName: 'ZAP Tool',
  description: 'Zigbee Cluster Configurator',
  version: '1.0.0', // TODO: Replace with actual version
  companyName: 'Silicon Labs',
  copyright: `© ${new Date().getFullYear()} Silicon Labs`,
  lang: 1033, // en-US
  codepage: 1200 // Unicode
}

/**
 * Injects Windows metadata into an executable file
 * @param {string} exePath - Path to the executable file
 */
function injectMetadata(exePath) {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Executable not found: ${exePath}`)
  }

  console.log(`Injecting metadata into: ${path.basename(exePath)}`)

  const exeData = fs.readFileSync(exePath)
  const exe = ResEdit.NtExecutable.from(exeData)
  const res = ResEdit.NtExecutableResource.from(exe)

  let viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
  const vi =
    viList.length > 0 ? viList[0] : ResEdit.Resource.VersionInfo.createEmpty()

  const versionParts = config.version.split('.').map(Number)
  const [major = 0, minor = 0, patch = 0] = versionParts

  vi.setFileVersion(major, minor, patch, 0, config.lang)
  vi.setProductVersion(major, minor, patch, 0, config.lang)

  vi.setStringValues(
    { lang: config.lang, codepage: config.codepage },
    {
      FileDescription: config.description,
      ProductName: config.displayName,
      CompanyName: config.companyName,
      ProductVersion: config.version,
      FileVersion: config.version,
      OriginalFilename: path.basename(exePath),
      LegalCopyright: config.copyright,
      InternalName: config.name
    }
  )

  vi.outputToResourceEntries(res.entries)
  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))

  console.log(`✓ Successfully injected metadata into ${path.basename(exePath)}`)
}

/**
 * Main entry point - processes command line arguments and injects metadata into executables
 */
function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Error: At least one executable path is required')
    console.error(
      'Usage: node src-script/windows-inject-metadata.js <executable-path> [<executable-path> ...]'
    )
    console.error('Examples:')
    console.error(
      '  node src-script/windows-inject-metadata.js dist/zap-cli.exe'
    )
    console.error(
      '  node src-script/windows-inject-metadata.js dist/zap-win-x64.exe dist/zap-win-arm64.exe'
    )
    process.exit(1)
  }

  let hasErrors = false

  for (const arg of args) {
    let executablePath = path.resolve(arg)

    // If the path doesn't have .exe extension and the .exe version exists, use that
    if (
      !executablePath.endsWith('.exe') &&
      fs.existsSync(executablePath + '.exe')
    ) {
      executablePath = executablePath + '.exe'
    }

    try {
      injectMetadata(executablePath)
    } catch (error) {
      console.error(`Failed to inject metadata into ${arg}:`, error.message)
      hasErrors = true
    }
  }

  if (hasErrors) {
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
