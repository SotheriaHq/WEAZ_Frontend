const { closeSync, existsSync, mkdirSync, openSync, readFileSync } = require('fs');
const http = require('http');
const net = require('net');
const { resolve } = require('path');
const { spawn } = require('child_process');

const envPath = resolve(__dirname, '..', '.env.e2e.bagging');
const repoRoot = resolve(__dirname, '..', '..');
const webRoot = resolve(__dirname, '..');
const backendRoot = resolve(repoRoot, 'bthreadly');
const backendPort = process.env.THREADLY_E2E_BACKEND_PORT || '3040';
const webPort = process.env.THREADLY_E2E_WEB_PORT || '5173';
const serverLogDir = resolve(webRoot, 'test-results', 'bagging-server-logs');

if (!existsSync(envPath)) {
  console.error(`Missing seeded bagging env file: ${envPath}`);
  console.error('Run npm run seed:e2e:bagging from the backend repo first.');
  process.exit(1);
}

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
};

for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const parsed = parseEnvLine(line);
  if (!parsed) continue;
  const [key, value] = parsed;
  process.env[key] = value;
}

process.env.THREADLY_E2E_SERIAL = '1';
process.env.PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.VITE_E2E_BASE_URL ||
  `http://localhost:${webPort}`;

const command = 'npx';

const npmCommand = 'npm';
const spawned = [];
let cleaningUp = false;

const waitForTcp = (port, timeoutMs = 60000) =>
  new Promise((resolveReady, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const socket = net.createConnection({ port: Number(port), host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.end();
        resolveReady();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for TCP port ${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });

const waitForHttp = (url, timeoutMs = 60000) =>
  new Promise((resolveReady, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolveReady();
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}; last status ${response.statusCode}`));
          return;
        }
        setTimeout(attempt, 500);
      });
      request.once('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 500);
      });
      request.setTimeout(5000, () => {
        request.destroy();
      });
    };
    attempt();
  });

const runChild = (name, executable, args, options) => {
  const child = spawn(executable, args, {
    ...options,
    stdio: options.stdio || 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  spawned.push({ name, child });
  child.once('exit', (code, signal) => {
    if (cleaningUp) return;
    if (code !== null && code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
    if (signal) {
      console.error(`${name} exited from signal ${signal}`);
    }
  });
  return child;
};

const killChild = ({ child }) =>
  new Promise((resolveKill) => {
    if (!child.pid || child.killed) {
      resolveKill();
      return;
    }

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('exit', () => resolveKill());
      return;
    }

    child.once('exit', () => resolveKill());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      resolveKill();
    }, 3000).unref();
  });

const cleanup = async () => {
  cleaningUp = true;
  await Promise.allSettled([...spawned].reverse().map(killChild));
};

const runPlaywright = () =>
  new Promise((resolveRun) => {
    const child = spawn(
      command,
      ['playwright', 'test', 'tests/e2e/bagging', '--project=chromium'],
      {
        cwd: webRoot,
        env: process.env,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        windowsHide: true,
      },
    );

    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`Playwright terminated by signal ${signal}`);
        resolveRun(1);
        return;
      }
      resolveRun(code ?? 1);
    });
  });

const main = async () => {
  const useExistingServers =
    String(process.env.THREADLY_E2E_USE_EXISTING_SERVERS || '').toLowerCase() === 'true';

  if (!useExistingServers) {
    mkdirSync(serverLogDir, { recursive: true });
    const backendLog = openSync(resolve(serverLogDir, 'backend.log'), 'w');
    const backend = runChild('backend e2e server', npmCommand, ['run', 'start:prod'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        APP_PORT: backendPort,
        WEB_APP_URL: `http://localhost:${webPort}`,
        CORS_ALLOWED_ORIGINS: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
      },
      stdio: ['ignore', backendLog, backendLog],
    });
    closeSync(backendLog);
    await waitForTcp(backendPort);

    const webLog = openSync(resolve(serverLogDir, 'web.log'), 'w');
    const web = runChild('web e2e server', npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', webPort], {
      cwd: webRoot,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://localhost:${backendPort}`,
        VITE_API_WITH_CREDENTIALS: 'true',
        VITE_DEV_HOST: '127.0.0.1',
      },
      stdio: ['ignore', webLog, webLog],
    });
    closeSync(webLog);
    await waitForHttp(`http://127.0.0.1:${webPort}`);

    backend.once('exit', (code) => {
      if (!cleaningUp && code !== 0) {
        console.error(`Backend server log: ${resolve(serverLogDir, 'backend.log')}`);
      }
    });
    web.once('exit', (code) => {
      if (!cleaningUp && code !== 0) {
        console.error(`Web server log: ${resolve(serverLogDir, 'web.log')}`);
      }
    });
  }

  const code = await runPlaywright();
  await cleanup();
  process.exit(code);
};

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(143);
});

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
