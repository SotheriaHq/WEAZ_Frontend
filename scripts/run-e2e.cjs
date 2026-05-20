const { closeSync, existsSync, mkdirSync, openSync } = require('fs');
const http = require('http');
const net = require('net');
const { resolve } = require('path');
const { spawn, spawnSync } = require('child_process');

const repoRoot = resolve(__dirname, '..', '..');
const webRoot = resolve(__dirname, '..');
const backendRoot = resolve(repoRoot, 'bthreadly');
const backendPort = process.env.THREADLY_E2E_BACKEND_PORT || '3040';
const webPort = process.env.THREADLY_E2E_WEB_PORT || '5173';
const redisPort = process.env.THREADLY_E2E_REDIS_PORT || process.env.REDIS_PORT || '6379';
const serverLogDir = resolve(webRoot, 'test-results', 'e2e-server-logs');

process.env.THREADLY_E2E_SERIAL = '1';
process.env.PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.VITE_E2E_BASE_URL ||
  `http://127.0.0.1:${webPort}`;
process.env.THREADLY_E2E_AUTH_STATE =
  process.env.THREADLY_E2E_AUTH_STATE ||
  resolve(webRoot, 'test-results', 'e2e-auth', 'brand.json');

const spawned = [];
let cleaningUp = false;
let redisContainerStarted = false;

const npmCommand = 'npm';
const npxCommand = 'npx';

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

const runChecked = (name, executable, args, options) => {
  const result = spawnSync(executable, args, {
    ...options,
    stdio: options.stdio || 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status ?? 'unknown'}`);
  }
};

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
  if (redisContainerStarted) {
    spawnSync('docker', ['rm', '-f', 'threadly-e2e-redis'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
      windowsHide: true,
    });
  }
};

const startRedisIfNeeded = async () => {
  try {
    await waitForTcp(redisPort, 1500);
    return;
  } catch {
    // Start a disposable Redis only when the local port is not already available.
  }

  const dockerCheck = spawnSync('docker', ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  if (dockerCheck.status !== 0) {
    throw new Error(`Redis is not reachable on 127.0.0.1:${redisPort}, and Docker is not available to start it.`);
  }

  spawnSync('docker', ['rm', '-f', 'threadly-e2e-redis'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    windowsHide: true,
  });

  runChecked('redis e2e container', 'docker', [
    'run',
    '--name',
    'threadly-e2e-redis',
    '-p',
    `${redisPort}:6379`,
    '-d',
    'redis:7-alpine',
  ], { cwd: repoRoot });
  redisContainerStarted = true;
  await waitForTcp(redisPort, 30000);
};

const runPlaywright = () =>
  new Promise((resolveRun) => {
    const forwardedArgs = process.argv.slice(2);
    const child = spawn(npxCommand, ['playwright', 'test', ...forwardedArgs], {
      cwd: webRoot,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    });

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

  mkdirSync(serverLogDir, { recursive: true });

  if (!useExistingServers) {
    await startRedisIfNeeded();

    if (!existsSync(resolve(backendRoot, 'dist', 'main.js'))) {
      runChecked('backend build', npmCommand, ['run', 'build'], { cwd: backendRoot });
    }

    runChecked('brand e2e seed', npxCommand, [
      'ts-node',
      '-r',
      'tsconfig-paths/register',
      'prisma/seed_brand.ts',
    ], { cwd: backendRoot });

    const backendLog = openSync(resolve(serverLogDir, 'backend.log'), 'w');
    const backend = runChild('backend e2e server', npmCommand, ['run', 'start:prod'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        APP_PORT: backendPort,
        WEB_APP_URL: `http://127.0.0.1:${webPort}`,
        CORS_ALLOWED_ORIGINS: `http://127.0.0.1:${webPort},http://localhost:${webPort},http://localhost:3000`,
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: redisPort,
      },
      stdio: ['ignore', backendLog, backendLog],
    });
    closeSync(backendLog);
    await waitForTcp(backendPort, 90000);

    const webLog = openSync(resolve(serverLogDir, 'web.log'), 'w');
    const web = runChild('web e2e server', npmCommand, [
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      webPort,
      '--mode',
      'test',
    ], {
      cwd: webRoot,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}`,
        VITE_API_WITH_CREDENTIALS: 'true',
        VITE_DEV_HOST: '127.0.0.1',
      },
      stdio: ['ignore', webLog, webLog],
    });
    closeSync(webLog);
    await waitForHttp(`http://127.0.0.1:${webPort}`, 90000);

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
