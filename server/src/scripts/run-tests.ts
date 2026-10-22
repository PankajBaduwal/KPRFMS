/**
 * Runs every src/scripts/test-phase*.ts suite in sequence and prints one summary.
 *
 *   npm test                 # all suites
 *   npm test -- 2 3 54       # only phases 2, 3 and 54
 *
 * Suites run against the local MongoDB from .env; a few also call the live API,
 * so start the dev server (npm run dev) first.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCRIPTS_DIR = path.resolve(process.cwd(), 'src', 'scripts');
const API_HEALTH_URL = 'http://localhost:5000/api/health';
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

interface SuiteResult {
  name: string;
  ok: boolean;
  reason?: string;
  durationMs: number;
}

function phaseNumber(file: string): number {
  return Number(/test-phase(\d+)/.exec(file)?.[1] ?? 0);
}

function discoverSuites(filter: string[]): string[] {
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => /^test-phase[\w-]+\.ts$/.test(f))
    .filter((f) => filter.length === 0 || filter.includes(String(phaseNumber(f))))
    .sort((a, b) => phaseNumber(a) - phaseNumber(b) || a.localeCompare(b));
}

function runSuite(file: string): Promise<SuiteResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', path.join('src', 'scripts', file)], {
      cwd: process.cwd(),
      shell: process.platform === 'win32',
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));

    const timer = setTimeout(() => child.kill(), SUITE_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      const failedLine = output.split('\n').find((line) => FAILURE_PATTERNS.some((p) => p.test(line)));
      if (code !== 0 || failedLine) {
        resolve({ name: file, ok: false, reason: failedLine?.trim() || `exit code ${code}`, durationMs });
      } else {
        resolve({ name: file, ok: true, durationMs });
      }
    });
  });
}

async function main() {
  const filter = process.argv.slice(2);
  const suites = discoverSuites(filter);
  if (suites.length === 0) {
    console.error('No matching test suites found.');
    process.exit(1);
  }

  try {
    await fetch(API_HEALTH_URL);
  } catch {
    console.warn(`⚠ API not reachable at ${API_HEALTH_URL} — suites that call the live API will fail.`);
    console.warn('  Start it first with: npm run dev\n');
  }

  const results: SuiteResult[] = [];
  for (const suite of suites) {
    process.stdout.write(`▶ ${suite.padEnd(24)} `);
    const result = await runSuite(suite);
    results.push(result);
    const secs = (result.durationMs / 1000).toFixed(1);
    console.log(result.ok ? `✓ passed (${secs}s)` : `✗ FAILED (${secs}s)\n    ${result.reason}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} suites passed.`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map((r) => r.name).join(', ')}`);
    console.log('Re-run one with: npx tsx src/scripts/<suite> for full output.');
    process.exit(1);
  }
}

void main();
