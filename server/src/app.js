import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMetrics } from './metrics.js';
import { calculateRoute, ValidationError } from './routeEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DIR = path.resolve(__dirname, '../../web/dist');

const RELEASE_VERSION = process.env.RELEASE_VERSION || 'dev';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logJson(fields) {
  // Structured single-line JSON so Cloud Logging parses it into fields for free.
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...fields })}\n`);
}

export function createApp({ staticDir = DEFAULT_STATIC_DIR } = {}) {
  const app = express();
  const metrics = createMetrics();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(metrics.middleware);

  // --- Health -------------------------------------------------------------
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: RELEASE_VERSION, uptime_seconds: Math.round(process.uptime()) });
  });

  // --- Telemetry ----------------------------------------------------------
  app.get('/metrics', (req, res) => {
    res.json({ version: RELEASE_VERSION, ...metrics.snapshot() });
  });

  // Lets the verifier zero the counters before a measurement run so p95 reflects
  // this candidate's traffic and not warm-up noise.
  app.post('/metrics/reset', (req, res) => {
    metrics.reset();
    res.json({ status: 'reset' });
  });

  // --- Route API ----------------------------------------------------------
  app.post('/api/route', async (req, res) => {
    // Simulates latency from the upstream routing provider. 0 in normal operation.
    const delayMs = Number(process.env.ROUTE_DELAY_MS || 0);
    if (delayMs > 0) await sleep(delayMs);

    try {
      const result = calculateRoute(req.body);
      logJson({ severity: 'INFO', event: 'route_calculated', lane: result.lane, status: result.status });
      res.json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        logJson({ severity: 'WARNING', event: 'route_rejected', reason: err.message });
        res.status(400).json({ error: err.message });
        return;
      }
      logJson({ severity: 'ERROR', event: 'route_failed', reason: err.message });
      res.status(500).json({ error: 'internal error' });
    }
  });

  // --- Static SPA ---------------------------------------------------------
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // Anything not matched above is client-side routing; hand back index.html.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  app.locals.metrics = metrics;
  return app;
}
