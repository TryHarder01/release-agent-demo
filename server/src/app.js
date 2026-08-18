import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMetrics } from './metrics.js';
import { calculateRoute, ValidationError } from './routeEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DIR = path.resolve(__dirname, '../../web/dist');

const RELEASE_VERSION = process.env.RELEASE_VERSION || 'dev';
const RELEASE_ID = /^[0-9a-f]{7,40}$/i.test(RELEASE_VERSION) ? RELEASE_VERSION.slice(0, 7) : RELEASE_VERSION;
const IMAGE_TAG = process.env.IMAGE_TAG || (RELEASE_ID === 'dev' ? 'local' : `git-${RELEASE_ID}`);

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
    res.json({ status: 'ok', version: RELEASE_ID, image_tag: IMAGE_TAG, uptime_seconds: Math.round(process.uptime()) });
  });

  // --- Telemetry ----------------------------------------------------------
  app.get('/metrics', (req, res) => {
    res.json({ version: RELEASE_ID, image_tag: IMAGE_TAG, ...metrics.snapshot() });
  });

  // Prometheus exposition is intentionally separate from /metrics: the release
  // verifier consumes the JSON contract above, while GMP/Grafana can scrape
  // richer, low-cardinality app dimensions from this endpoint.
  app.get('/metrics/prometheus', (req, res) => {
    res.type('text/plain; version=0.0.4; charset=utf-8').send(metrics.prometheus());
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
      const start = performance.now();
      const result = calculateRoute(req.body);
      const durationMs = Math.round(performance.now() - start);
      metrics.recordRouteProfile(result);
      logJson({ severity: 'INFO', event: 'route_calculated', lane: result.lane, status: result.status, duration_ms: durationMs });
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

  // --- Client telemetry ---------------------------------------------------
  // Browser-side failures otherwise die silently in the tab. Same logJson
  // stream as route_calculated, correlatable by timestamp.
  app.post('/client-error', (req, res) => {
    logJson({ severity: 'ERROR', event: 'client_error', message: req.body?.message });
    res.status(204).end();
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
