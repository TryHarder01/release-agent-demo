import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

let app;

beforeEach(() => {
  // Fresh app per test so metrics counters start clean.
  app = createApp({ staticDir: '/nonexistent-so-static-is-skipped' });
});

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('version');
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
});
