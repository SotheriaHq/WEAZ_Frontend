#!/usr/bin/env node

/**
 * WIEZ Automated User Generator (Frontend Script Bridge)
 * Forwards arguments to bthreadly/scripts/create-sit-users.ts or executes directly.
 */

const { spawn } = require('child_process');
const { resolve } = require('path');
const { existsSync } = require('fs');

const backendDir = resolve(__dirname, '..', '..', 'bthreadly');
const scriptPath = resolve(backendDir, 'scripts', 'create-sit-users.ts');

if (!existsSync(scriptPath)) {
  console.error(`❌ User creation script not found at: ${scriptPath}`);
  process.exit(1);
}

const args = process.argv.slice(2);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['ts-node', '-T', '-r', 'tsconfig-paths/register', scriptPath, ...args],
  {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
    windowsHide: true,
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
