// In-process telemetry. Deliberately tiny: a release agent can curl /metrics and
// get everything the release policy needs (request count, error rate, p95 latency)
// without any external observability stack.

const MAX_SAMPLES = 500;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, index)] * 100) / 100;
}

function summarize(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  return {
    count: sorted.length,
    avg: sorted.length ? Math.round((sum / sorted.length) * 100) / 100 : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? Math.round(sorted[sorted.length - 1] * 100) / 100 : 0,
  };
}

export function createMetrics() {
  let startedAt = Date.now();
  let requestsTotal = 0;
  let errorsTotal = 0;
  /** @type {Map<string, {count: number, errors: number, latencies: number[]}>} */
  let byRoute = new Map();

  function bucketFor(key) {
    if (!byRoute.has(key)) byRoute.set(key, { count: 0, errors: 0, latencies: [] });
    return byRoute.get(key);
  }

  function record(key, durationMs, statusCode) {
    const isError = statusCode >= 500;
    requestsTotal += 1;
    if (isError) errorsTotal += 1;

    const bucket = bucketFor(key);
    bucket.count += 1;
    if (isError) bucket.errors += 1;
    bucket.latencies.push(durationMs);
    if (bucket.latencies.length > MAX_SAMPLES) bucket.latencies.shift();
  }

  function reset() {
    startedAt = Date.now();
    requestsTotal = 0;
    errorsTotal = 0;
    byRoute = new Map();
  }

  function snapshot() {
    const routes = {};
    for (const [key, bucket] of byRoute.entries()) {
      routes[key] = {
        count: bucket.count,
        errors: bucket.errors,
        error_rate: bucket.count ? Math.round((bucket.errors / bucket.count) * 10000) / 10000 : 0,
        latency_ms: summarize(bucket.latencies),
      };
    }

    const routeBucket = byRoute.get('POST /api/route');

    return {
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      requests_total: requestsTotal,
      errors_total: errorsTotal,
      // Rounded to 4dp so a 0.5% rate reads as 0.005, not 0.004999999.
      error_rate: requestsTotal ? Math.round((errorsTotal / requestsTotal) * 10000) / 10000 : 0,
      // Hoisted to the top level because the release policy keys off this one number.
      route_latency_ms: summarize(routeBucket ? routeBucket.latencies : []),
      routes,
    };
  }

  // Express middleware: times every request and files it under "METHOD /path".
  function middleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      // req.route is only populated after routing; fall back to the raw path.
      const path = req.route ? req.baseUrl + req.route.path : req.path;
      record(`${req.method} ${path}`, durationMs, res.statusCode);
    });
    next();
  }

  return { middleware, record, reset, snapshot };
}
