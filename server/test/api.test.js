import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

let app;

beforeEach(() => {
  // Fresh app per test so metrics counters start clean.
  app = createApp({ staticDir: '/nonexistent-so-static-is-skipped' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function captureLogLines() {
  const lines = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(JSON.parse(chunk));
    return true;
  });
  return { lines, spy };
}

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('image_tag');
    expect(res.body).toHaveProperty('uptime_seconds');
  });
});

describe('POST /api/route', () => {
  it('returns the documented response contract', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' })
      .expect(200);

    expect(res.body).toMatchObject({
      distance_miles: 312,
      duration_minutes: 338,
      status: 'optimized',
    });
  });

  it('exposes duration as duration_minutes, which is what the UI reads', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ origin: 'Chicago', destination: 'Detroit' })
      .expect(200);

    expect(res.body).toHaveProperty('duration_minutes');
    expect(typeof res.body.duration_minutes).toBe('number');
  });

  it('rejects an incomplete request with 400', async () => {
    const res = await request(app).post('/api/route').send({ origin: 'Denver' }).expect(400);
    expect(res.body.error).toMatch(/destination/);
  });

  it('rejects an unknown vehicle type with 400', async () => {
    await request(app)
      .post('/api/route')
      .send({ origin: 'Denver', destination: 'Reno', vehicle_type: 'hovercraft' })
      .expect(400);
  });

  it('rejects refrigerated service on a van with 400', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ origin: 'Denver', destination: 'Reno', vehicle_type: 'van', service_level: 'refrigerated' })
      .expect(400);
    expect(res.body.error).toMatch(/refrigerated/);
  });

  it('includes cost and SLA-tracking fields in the response', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' })
      .expect(200);

    expect(res.body.estimated_cost_usd).toBeCloseTo(655.2, 2);
    expect(res.body.sla_status).toBe('not_tracked');
  });

  it('logs duration_ms on the route_calculated line', async () => {
    const { lines } = captureLogLines();

    await request(app)
      .post('/api/route')
      .send({ origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' })
      .expect(200);

    const logLine = lines.find((line) => line.event === 'route_calculated');
    expect(logLine).toMatchObject({ lane: 'Denver → Salt Lake City', status: 'optimized' });
    expect(typeof logLine.duration_ms).toBe('number');
    expect(logLine.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('POST /client-error', () => {
  it('accepts a client error report and logs it', async () => {
    const { lines } = captureLogLines();

    await request(app)
      .post('/client-error')
      .send({ message: 'Malformed route response: missing duration_minutes' })
      .expect(204);

    const logLine = lines.find((line) => line.event === 'client_error');
    expect(logLine).toMatchObject({
      severity: 'ERROR',
      message: 'Malformed route response: missing duration_minutes',
    });
  });

  it('does not count against the error rate', async () => {
    await request(app).post('/client-error').send({ message: 'boom' }).expect(204);

    const res = await request(app).get('/metrics').expect(200);
    expect(res.body.errors_total).toBe(0);
  });
});

describe('GET /metrics', () => {
  it('counts requests and records route latency', async () => {
    await request(app).post('/api/route').send({ origin: 'Denver', destination: 'Reno' });
    await request(app).post('/api/route').send({ origin: 'Dallas', destination: 'Houston' });

    const res = await request(app).get('/metrics').expect(200);

    expect(res.body.requests_total).toBeGreaterThanOrEqual(2);
    expect(res.body.errors_total).toBe(0);
    expect(res.body.error_rate).toBe(0);
    expect(res.body.route_latency_ms.count).toBe(2);
    expect(res.body.route_latency_ms.p95).toBeGreaterThanOrEqual(0);
    expect(res.body.routes).toHaveProperty('POST /api/route');
  });

  it('does not count 4xx client errors against the error rate', async () => {
    await request(app).post('/api/route').send({ origin: 'Denver' }).expect(400);

    const res = await request(app).get('/metrics').expect(200);
    expect(res.body.errors_total).toBe(0);
  });

  it('clears counters on reset', async () => {
    await request(app).post('/api/route').send({ origin: 'Denver', destination: 'Reno' });
    await request(app).post('/metrics/reset').expect(200);

    const res = await request(app).get('/metrics').expect(200);
    expect(res.body.route_latency_ms.count).toBe(0);
  });

  it('exposes bounded dispatch dimensions in Prometheus format', async () => {
    await request(app)
      .post('/api/route')
      .send({ origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' })
      .expect(200);

    const res = await request(app).get('/metrics/prometheus').expect(200);

    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# TYPE fleetnet_route_calculations_total counter');
    expect(res.text).toContain('fleetnet_route_calculations_total{vehicle_type="van",service_level="standard",distance_band="local",traffic_band="light",status="optimized",dispatch_risk="on_track"} 1');
    expect(res.text).toContain('fleetnet_route_distance_miles_total{vehicle_type="van",service_level="standard",distance_band="local",traffic_band="light",status="optimized",dispatch_risk="on_track"} 312');
    expect(res.text).toContain('fleetnet_route_delay_configured_seconds 0');

    const json = await request(app).get('/metrics').expect(200);
    expect(json.body.dispatch_profiles).toHaveProperty(
      'vehicle_type=van,service_level=standard,distance_band=local,traffic_band=light,status=optimized,dispatch_risk=on_track',
    );
  });
});
