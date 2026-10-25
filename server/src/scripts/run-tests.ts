/**
 * Runs every src/scripts/test-phase*.ts suite against an ISOLATED test database.
 *
 *   npm test                 # all suites
 *   npm test -- 2 3 54       # only phases 2, 3 and 54
 *
 * Each run: drops the test database (default mongodb://localhost:27017/kpriet-fms-test,
 * override with TEST_MONGODB_URI), seeds it with the base + full sample data, starts a
 * private API server on TEST_API_PORT (default 5099) connected to it, runs the suites, and
 * stops the server. Your development database is never touched.
 */
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const SCRIPTS_DIR = path.resolve(process.cwd(), 'src', 'scripts');
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms-test';
const TEST_API_PORT = Number(process.env.TEST_API_PORT || 5099);
const TEST_API_URL = `http://localhost:${TEST_API_PORT}/api`;
const SUITE_TIMEOUT_MS = 180_000;

// Suites report results in a few different formats; any of these means a failure
const FAILURE_PATTERNS = [
  /✗ FAIL/,
  /\[FAIL\]/,
  /execution failed/i,
  /\b[1-9]\d* FAILED\b/,
  /Total Failed:\s*[1-9]/i,
  /FAILED:\s*[1-9]/,
];

// Every child process gets the test database; the API URL points at the private test server
const testEnv: NodeJS.ProcessEnv = {
  ...process.env,
  MONGODB_URI: TEST_DB_URI,
  TEST_API_URL,
  PORT: String(TEST_API_PORT),
  NODE_ENV: 'development',
  // Emails go to a separate outbox folder that phase 60 reads
  MAIL_OUTBOX_DIR: 'mail-outbox-test',
  SMTP_HOST: '',
};

interface SuiteResult {
  name: string;
  ok: boolean;
  reason?: string;
  durationMs: number;
}

const phaseNumber = (file: string) => Number(/test-phase(\d+)/.exec(file)?.[1] ?? 0);

function discoverSuites(filter: string[]): string[] {
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => /^test-phase[\w-]+\.ts$/.test(f))
    .filter((f) => filter.length === 0 || filter.includes(String(phaseNumber(f))))
    .sort((a, b) => phaseNumber(a) - phaseNumber(b) || a.localeCompare(b));
}

function runTsx(script: string, timeoutMs = SUITE_TIMEOUT_MS): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', script], { cwd: process.cwd(), shell: process.platform === 'win32', env: testEnv });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

async function prepareDatabase() {
  if (!/test/i.test(new URL(TEST_DB_URI.replace(/^mongodb(\+srv)?:\/\//, 'http://')).pathname)) {
    throw new Error(`Refusing to reset "${TEST_DB_URI}": the test database name must contain "test".`);
  }
  await mongoose.connect(TEST_DB_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  for (const script of ['src/scripts/seed.ts', 'src/scripts/seed-sample.ts']) {
    const { code, output } = await runTsx(script, 300_000);
    if (code !== 0) throw new Error(`${script} failed:\n${output.slice(-2000)}`);
  }
}

const API_LOG = path.resolve(process.cwd(), 'test-api.log');
let apiExited: string | null = null;

async function startTestApi(): Promise<ChildProcess> {
  const child = spawn('npx', ['tsx', 'src/server.ts'], { cwd: process.cwd(), shell: process.platform === 'win32', env: testEnv });
  let log = '';
  const logFile = fs.createWriteStream(API_LOG);
  child.stdout?.on('data', (d) => { log += d; logFile.write(d); });
  child.stderr?.on('data', (d) => { log += d; logFile.write(d); });
  child.on('exit', (code) => {
    apiExited = `Test API exited unexpectedly (code ${code}). Last log lines:\n${log.split('\n').slice(-15).join('\n')}`;
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${TEST_API_URL}/health`);
      const body = (await res.json()) as { message?: string };
      if (body.message?.includes('KPRIET')) return child;
      throw new Error(`Port ${TEST_API_PORT} is used by another application (set TEST_API_PORT).`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Port')) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  child.kill();
  throw new Error(`Test API did not start on port ${TEST_API_PORT}:\n${log.slice(-1500)}`);
}

function stopProcessTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: true });
  else child.kill('SIGTERM');
}

async function main() {
  const filter = process.argv.slice(2);
  const suites = discoverSuites(filter);
  if (suites.length === 0) {
    console.error('No matching test suites found.');
    process.exit(1);
  }

  console.log(`Preparing isolated test database ${TEST_DB_URI} ...`);
  await prepareDatabase();
  console.log(`Starting test API on port ${TEST_API_PORT} ...\n`);
  const api = await startTestApi();

  const results: SuiteResult[] = [];
  try {
    for (const suite of suites) {
      process.stdout.write(`▶ ${suite.padEnd(24)} `);
      const started = Date.now();
      const { code, output } = await runTsx(path.join('src', 'scripts', suite));
      const durationMs = Date.now() - started;
      const failedLine = output.split('\n').find((line) => FAILURE_PATTERNS.some((p) => p.test(line)));
      const ok = code === 0 && !failedLine;
      results.push({ name: suite, ok, reason: failedLine?.trim() || (ok ? undefined : `exit code ${code}`), durationMs });
      const secs = (durationMs / 1000).toFixed(1);
      console.log(ok ? `✓ passed (${secs}s)` : `✗ FAILED (${secs}s)\n    ${results[results.length - 1].reason}`);
      if (apiExited) {
        console.log(`\n${apiExited}\n(full log: ${API_LOG})`);
        break;
      }
    }
  } finally {
    apiExited = apiExited ?? 'stopped';
    stopProcessTree(api);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} suites passed (test database: ${TEST_DB_URI}).`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map((r) => r.name).join(', ')}`);
    console.log(`Re-run one with: MONGODB_URI=${TEST_DB_URI} TEST_API_URL=${TEST_API_URL} npx tsx src/scripts/<suite>`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
