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

function promLabel(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function promLabels(labels) {
  return `{${Object.entries(labels).map(([key, value]) => `${key}="${promLabel(value)}"`).join(',')}}`;
}

export function createMetrics() {
  let startedAt = Date.now();
  let requestsTotal = 0;
  let errorsTotal = 0;
  /** @type {Map<string, {count: number, errors: number, latencies: number[]}>} */
  let byRoute = new Map();
  /** @type {Map<string, number>} */
  let routeProfiles = new Map();

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
    routeProfiles = new Map();
  }

  // Route dimensions are intentionally low-cardinality. Never use a lane or a
  // customer identifier as a Prometheus label.
  function recordRouteProfile(route) {
    const classification = route.distance_miles > 900
      ? { distanceBand: 'long_haul', trafficBand: 'heavy' }
      : route.distance_miles > 600
        ? { distanceBand: 'regional', trafficBand: 'moderate' }
        : { distanceBand: 'local', trafficBand: 'light' };
    const labels = {
      vehicle_type: route.vehicle_type,
      service_level: route.service_level,
      distance_band: classification.distanceBand,
      traffic_band: classification.trafficBand,
      status: route.status,
      dispatch_risk: route.dispatch_risk,
    };
    const key = JSON.stringify(labels);
    const profile = routeProfiles.get(key) || { labels, count: 0, distanceMiles: 0, durationMinutes: 0 };
    profile.count += 1;
    profile.distanceMiles += route.distance_miles;
    profile.durationMinutes += route.duration_minutes;
    routeProfiles.set(key, profile);
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
    const dispatch_profiles = Object.fromEntries(
      [...routeProfiles.values()].map(({ labels, count, distanceMiles, durationMinutes }) => [
        Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(','),
        {
          calculations: count,
          planned_miles: distanceMiles,
          planned_duration_minutes: durationMinutes,
        },
      ]),
    );

    return {
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      requests_total: requestsTotal,
      errors_total: errorsTotal,
      // Rounded to 4dp so a 0.5% rate reads as 0.005, not 0.004999999.
      error_rate: requestsTotal ? Math.round((errorsTotal / requestsTotal) * 10000) / 10000 : 0,
      // Hoisted to the top level because the release policy keys off this one number.
      route_latency_ms: summarize(routeBucket ? routeBucket.latencies : []),
      // Rich context for an agent or a local dashboard. This does not affect
      // the release-policy fields above.
      dispatch_profiles,
      routes,
    };
  }

  // A separate Prometheus endpoint keeps the verifier's compact JSON contract
  // stable while making richer app-level dimensions available to Grafana/GMP.
  function prometheus() {
    const lines = [
      '# HELP fleetnet_route_calculations_total Total successful route calculations by bounded dispatch profile.',
      '# TYPE fleetnet_route_calculations_total counter',
      '# HELP fleetnet_route_distance_miles_total Total planned miles by bounded dispatch profile.',
      '# TYPE fleetnet_route_distance_miles_total counter',
      '# HELP fleetnet_route_duration_minutes_total Total planned driving minutes by bounded dispatch profile.',
      '# TYPE fleetnet_route_duration_minutes_total counter',
    ];

    for (const { labels, count, distanceMiles, durationMinutes } of routeProfiles.values()) {
      const rendered = promLabels(labels);
      lines.push(`fleetnet_route_calculations_total${rendered} ${count}`);
      lines.push(`fleetnet_route_distance_miles_total${rendered} ${distanceMiles}`);
      lines.push(`fleetnet_route_duration_minutes_total${rendered} ${durationMinutes}`);
    }

    const routeLatency = snapshot().route_latency_ms;
    lines.push('# HELP fleetnet_route_latency_seconds Observed POST /api/route latency percentiles from the local rolling window.');
    lines.push('# TYPE fleetnet_route_latency_seconds gauge');
    for (const [quantile, value] of [['0.5', routeLatency.p50], ['0.95', routeLatency.p95], ['0.99', routeLatency.p99]]) {
      lines.push(`fleetnet_route_latency_seconds${promLabels({ quantile })} ${value / 1000}`);
    }
    lines.push('# HELP fleetnet_route_delay_configured_seconds Configured simulated upstream delay for the current revision.');
    lines.push('# TYPE fleetnet_route_delay_configured_seconds gauge');
    lines.push(`fleetnet_route_delay_configured_seconds ${Number(process.env.ROUTE_DELAY_MS || 0) / 1000}`);
    return `${lines.join('\n')}\n`;
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

  return { middleware, record, recordRouteProfile, reset, snapshot, prometheus };
}
