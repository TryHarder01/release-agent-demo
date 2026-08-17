#!/usr/bin/env node
/**
 * Post-deployment release verification.
 *
 * Runs the four checks in the release policy against a already-deployed
 * candidate URL, then prints a PROMOTE / STOP / NEEDS_REVIEW verdict.
 *
 *   BASE_URL=https://... node scripts/verify-release.mjs
 *
 * Exit codes: 0 = PROMOTE, 1 = STOP, 2 = NEEDS_REVIEW.
 * Writes a machine-readable summary to release-report.json.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// --- Release policy ---------------------------------------------------------
const POLICY = {
  max_error_rate: Number(process.env.POLICY_MAX_ERROR_RATE || 0.01), // < 1%
  max_p95_route_latency_ms: Number(process.env.POLICY_MAX_P95_MS || 750), // < 750 ms
  require_critical_e2e: true,
  require_health: true,
};

const LOAD_REQUESTS = Number(process.env.VERIFY_LOAD_REQUESTS || 40);
const LOAD_CONCURRENCY = Number(process.env.VERIFY_LOAD_CONCURRENCY || 4);
const REPORT_PATH = path.resolve(process.cwd(), 'release-report.json');

const LANES = [
  { origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' },
  { origin: 'Dallas', destination: 'Houston', vehicle_type: 'semi' },
  { origin: 'Chicago', destination: 'Detroit', vehicle_type: 'box_truck' },
  { origin: 'Seattle', destination: 'Portland', vehicle_type: 'van' },
];

const log = (msg) => process.stdout.write(`${msg}\n`);
const section = (title) => log(`\n\x1b[1m${title}\x1b[0m`);
const mark = (pass) => (pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m');

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

// --- Check 1: health --------------------------------------------------------
async function checkHealth() {
  try {
    const { ok, status, body } = await fetchJson(`${BASE_URL}/health`);
    return {
      pass: ok && body?.status === 'ok',
      status_code: status,
      version: body?.version ?? null,
      detail: ok ? `status=${body?.status} version=${body?.version}` : `HTTP ${status}`,
    };
  } catch (err) {
    return { pass: false, status_code: 0, version: null, detail: err.message };
  }
}

// --- Check 2: load generation ----------------------------------------------
async function generateLoad() {
  // Zero the server counters so p95 reflects this run only.
  await fetch(`${BASE_URL}/metrics/reset`, { method: 'POST' }).catch(() => {});

  const clientLatencies = [];
  let failures = 0;
  let issued = 0;

  const worker = async () => {
    while (issued < LOAD_REQUESTS) {
      const lane = LANES[issued % LANES.length];
      issued += 1;
      const start = performance.now();
      try {
        const res = await fetch(`${BASE_URL}/api/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lane),
        });
        clientLatencies.push(performance.now() - start);
        if (!res.ok) failures += 1;
      } catch {
        clientLatencies.push(performance.now() - start);
        failures += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));

  const sorted = clientLatencies.sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);

  return {
    requests: LOAD_REQUESTS,
    failures,
    client_p95_ms: sorted.length ? Math.round(sorted[idx]) : 0,
  };
}

// --- Check 3: server-reported telemetry ------------------------------------
async function readMetrics() {
  try {
    const { ok, body } = await fetchJson(`${BASE_URL}/metrics`);
    if (!ok || !body) return { pass: false, detail: 'metrics unavailable' };
    return {
      pass: true,
      requests_total: body.requests_total,
      errors_total: body.errors_total,
      error_rate: body.error_rate,
      p95_route_latency_ms: body.route_latency_ms?.p95 ?? null,
      p50_route_latency_ms: body.route_latency_ms?.p50 ?? null,
    };
  } catch (err) {
    return { pass: false, detail: err.message };
  }
}

// --- Check 4: Playwright critical flow -------------------------------------
function runPlaywright(grep = '@critical') {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright', 'test', '--grep', grep], {
      env: { ...process.env, BASE_URL, CI: '1' },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('close', (code) => {
      let passed = null;
      let failed = null;
      try {
        const report = JSON.parse(fs.readFileSync('playwright-report/results.json', 'utf8'));
        passed = report.stats?.expected ?? null;
        failed = report.stats?.unexpected ?? null;
      } catch {
        /* report is optional; exit code is authoritative */
      }
      resolve({ pass: code === 0, exit_code: code, passed, failed });
    });

    child.on('error', (err) => resolve({ pass: false, exit_code: -1, detail: err.message }));
  });
}

// --- Main -------------------------------------------------------------------
async function main() {
  log(`\x1b[1mRelease verification\x1b[0m  →  ${BASE_URL}`);

  section('1. Health check');
  const health = await checkHealth();
  log(`   ${mark(health.pass)}  ${health.detail}`);

  section(`2. Load generation (${LOAD_REQUESTS} requests, concurrency ${LOAD_CONCURRENCY})`);
  const load = await generateLoad();
  log(`   issued=${load.requests} failures=${load.failures} client p95=${load.client_p95_ms}ms`);

  section('3. Server telemetry');
  const metrics = await readMetrics();
  const errorRatePass = metrics.pass && metrics.error_rate < POLICY.max_error_rate;
  const latencyPass = metrics.pass && metrics.p95_route_latency_ms < POLICY.max_p95_route_latency_ms;
  log(
    `   ${mark(errorRatePass)}  error rate ${((metrics.error_rate ?? 1) * 100).toFixed(2)}% ` +
      `(threshold < ${(POLICY.max_error_rate * 100).toFixed(2)}%)`,
  );
  log(
    `   ${mark(latencyPass)}  p95 route latency ${metrics.p95_route_latency_ms}ms ` +
      `(threshold < ${POLICY.max_p95_route_latency_ms}ms)`,
  );

  section('4. Playwright critical flow');
  const e2e = await runPlaywright();
  log(`   ${mark(e2e.pass)}  critical specs${e2e.failed != null ? ` (${e2e.failed} failed)` : ''}`);

  // --- Verdict --------------------------------------------------------------
  const checks = {
    health: health.pass,
    critical_e2e: e2e.pass,
    error_rate: errorRatePass,
    p95_latency: latencyPass,
  };

  const failedChecks = Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([name]) => name);

  let verdict;
  let reason;
  if (failedChecks.length === 0) {
    verdict = 'PROMOTE';
    reason = 'All release policy checks passed.';
  } else if (checks.health && checks.critical_e2e) {
    // App works; only the performance/error budget is out of bounds.
    verdict = 'NEEDS_REVIEW';
    reason = `Functionality is healthy but the release budget was exceeded: ${failedChecks.join(', ')}.`;
  } else {
    verdict = 'STOP';
    reason = `Critical functionality check failed: ${failedChecks.join(', ')}.`;
  }

  const report = {
    verdict,
    reason,
    base_url: BASE_URL,
    version: health.version,
    evaluated_at: new Date().toISOString(),
    policy: POLICY,
    checks,
    details: { health, load, metrics, e2e },
  };

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const color = verdict === 'PROMOTE' ? 32 : verdict === 'NEEDS_REVIEW' ? 33 : 31;
  section('Verdict');
  log(`   \x1b[1;${color}m${verdict}\x1b[0m — ${reason}`);
  log(`   report written to ${path.relative(process.cwd(), REPORT_PATH)}\n`);

  process.exit(verdict === 'PROMOTE' ? 0 : verdict === 'NEEDS_REVIEW' ? 2 : 1);
}

main().catch((err) => {
  process.stderr.write(`verification crashed: ${err.stack}\n`);
  process.exit(1);
});
