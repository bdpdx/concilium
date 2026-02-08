#!/usr/bin/env node

/**
 * @license MIT
 * Copyright (c) 2025 Matias Daloia
 * SPDX-License-Identifier: MIT
 *
 * CLI entry point for Concilium.
 *
 * Usage:
 *   concilium              # launch with terminal CWD
 *   concilium <path>       # launch with specified project path
 *   concilium --help       # show usage
 *   concilium --version    # show version
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');

// ── Flags ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Concilium v${pkg.version}
  Multi-LLM deliberation platform

  Usage:
    concilium              Launch with the current directory
    concilium <path>       Launch with a specific project path
    concilium --dev        Force development mode (Vite + HMR)
    concilium --help       Show this help message
    concilium --version    Show version
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

// ── Resolve project CWD ─────────────────────────────────────────────

const rawPath = args.find((a) => !a.startsWith('-')) || process.cwd();
const projectCwd = path.resolve(rawPath);

try {
  const stat = fs.statSync(projectCwd);
  if (!stat.isDirectory()) {
    console.error(`Error: "${projectCwd}" is not a directory.`);
    process.exit(1);
  }
} catch {
  console.error(`Error: "${projectCwd}" does not exist.`);
  process.exit(1);
}

// ── Detect dev vs production ────────────────────────────────────────
// Priority: packaged binary wins over dev mode.  `npm link` creates a
// symlink back to the source tree so electron-forge will always exist
// there — checking for the built binary first avoids false-positive dev
// detection after `npm run build`.

const desktopRoot = path.resolve(__dirname, '..');
const appName = pkg.productName || pkg.name;

function findPackagedBinary() {
  if (process.platform === 'darwin') {
    return path.join(
      desktopRoot,
      'out',
      `${appName}-darwin-${process.arch}`,
      `${appName}.app`,
      'Contents',
      'MacOS',
      appName,
    );
  } else if (process.platform === 'linux') {
    return path.join(
      desktopRoot,
      'out',
      `${appName}-linux-${process.arch}`,
      appName.toLowerCase(),
    );
  } else {
    return path.join(
      desktopRoot,
      'out',
      `${appName}-win32-${process.arch}`,
      `${appName}.exe`,
    );
  }
}

const execPath = findPackagedBinary();
const hasPackagedBinary = fs.existsSync(execPath);
const forgeBin = path.join(desktopRoot, 'node_modules', '.bin', 'electron-forge');
const hasForgeDev = fs.existsSync(forgeBin);

// Allow --dev flag to force dev mode even when a built binary exists
const forceDev = args.includes('--dev');

let child;

if (hasPackagedBinary && !forceDev) {
  // Production: launch the packaged binary
  child = spawn(execPath, [`--cwd=${projectCwd}`], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  console.log(`Concilium launched for ${projectCwd}`);
  process.exit(0);
} else if (hasForgeDev) {
  // Development: run via electron-forge which handles Vite + HMR
  child = spawn(forgeBin, ['start', '--', `--cwd=${projectCwd}`], {
    cwd: desktopRoot,
    stdio: 'inherit',
    detached: false,
  });
} else {
  console.error(
    `Could not find packaged binary at: ${execPath}\n` +
      'Run "npm run build" first, or use "npm start" for development.',
  );
  process.exit(1);
}

// In dev mode, forward exit code from electron-forge
child.on('exit', (code) => {
  process.exit(code ?? 0);
});
