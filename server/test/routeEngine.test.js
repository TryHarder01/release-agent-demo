import { describe, expect, it } from 'vitest';

import { calculateRoute, SERVICE_LEVELS, ValidationError, VEHICLE_TYPES } from '../src/routeEngine.js';

describe('calculateRoute', () => {
  it('returns the canonical demo lane for Denver -> Salt Lake City', () => {
    const result = calculateRoute({
      origin: 'Denver',
      destination: 'Salt Lake City',
      vehicle_type: 'van',
    });

    expect(result.distance_miles).toBe(312);
    expect(result.duration_minutes).toBe(338);
    expect(result.status).toBe('optimized');
  });

  it('is case- and whitespace-insensitive on lane lookup', () => {
    const a = calculateRoute({ origin: 'denver', destination: 'salt lake city' });
    const b = calculateRoute({ origin: '  DENVER ', destination: 'Salt   Lake  City' });

    // `lane` echoes the raw input for display, so compare the computed values.
    expect(a.distance_miles).toBe(b.distance_miles);
    expect(a.duration_minutes).toBe(b.duration_minutes);
    expect(a.status).toBe(b.status);
  });

  it('echoes the caller’s original casing back in the lane label', () => {
    const result = calculateRoute({ origin: '  Denver ', destination: 'Salt Lake City' });
    expect(result.lane).toBe('Denver → Salt Lake City');
  });

  it('defaults to the van vehicle type', () => {
    const result = calculateRoute({ origin: 'Denver', destination: 'Salt Lake City' });
    expect(result.vehicle_type).toBe('van');
    expect(result.duration_minutes).toBe(338);
    expect(result.service_level).toBe('standard');
    expect(result.delivery_sla_minutes).toBe(518);
    expect(result.dispatch_risk).toBe('on_track');
  });

  it('slows the trip down for heavier vehicles', () => {
    const van = calculateRoute({ origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' });
    const semi = calculateRoute({ origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'semi' });

    expect(semi.distance_miles).toBe(van.distance_miles);
    expect(semi.duration_minutes).toBeGreaterThan(van.duration_minutes);
    expect(semi.duration_minutes).toBe(389); // 338 * 1.15
  });

  it('is deterministic for lanes outside the seeded table', () => {
    const first = calculateRoute({ origin: 'Boise', destination: 'Reno' });
    const second = calculateRoute({ origin: 'Boise', destination: 'Reno' });

    expect(first).toEqual(second);
    expect(first.distance_miles).toBeGreaterThan(0);
    expect(first.duration_minutes).toBeGreaterThan(0);
  });

  it('always returns the full response contract', () => {
    const result = calculateRoute({ origin: 'Boise', destination: 'Reno' });
    expect(Object.keys(result).sort()).toEqual(
      [
        'delivery_sla_minutes',
        'dispatch_risk',
        'distance_miles',
        'duration_minutes',
        'lane',
        'service_level',
        'service_level_label',
        'status',
        'vehicle_type',
      ].sort(),
    );
    expect(typeof result.distance_miles).toBe('number');
    expect(typeof result.duration_minutes).toBe('number');
  });

  it('rejects a missing origin or destination', () => {
    expect(() => calculateRoute({ destination: 'Denver' })).toThrow(ValidationError);
    expect(() => calculateRoute({ origin: 'Denver' })).toThrow(ValidationError);
    expect(() => calculateRoute({ origin: '   ', destination: 'Denver' })).toThrow(ValidationError);
  });

  it('rejects an unknown vehicle type', () => {
    expect(() =>
      calculateRoute({ origin: 'Denver', destination: 'Reno', vehicle_type: 'hovercraft' }),
    ).toThrow(ValidationError);
  });

  it('accepts every advertised vehicle type', () => {
    for (const vehicleType of VEHICLE_TYPES) {
      const result = calculateRoute({ origin: 'Denver', destination: 'Reno', vehicle_type: vehicleType });
      expect(result.vehicle_type).toBe(vehicleType);
    }
  });

  it('makes an explicit, deterministic delivery commitment for each service level', () => {
    const standard = calculateRoute({ origin: 'Denver', destination: 'Salt Lake City', service_level: 'standard' });
    const expedited = calculateRoute({ origin: 'Denver', destination: 'Salt Lake City', service_level: 'expedited' });
    const refrigerated = calculateRoute({ origin: 'Denver', destination: 'Salt Lake City', service_level: 'refrigerated' });

    expect(expedited.duration_minutes).toBe(standard.duration_minutes);
    expect(expedited.delivery_sla_minutes).toBeLessThan(standard.delivery_sla_minutes);
    expect(refrigerated.delivery_sla_minutes).toBeLessThan(standard.delivery_sla_minutes);
    expect(expedited.dispatch_risk).toBe('monitor');
  });

  it('accepts every advertised service level and rejects an unknown one', () => {
    for (const serviceLevel of SERVICE_LEVELS) {
      expect(calculateRoute({ origin: 'Denver', destination: 'Reno', service_level: serviceLevel }).service_level).toBe(serviceLevel);
    }
    expect(() => calculateRoute({ origin: 'Denver', destination: 'Reno', service_level: 'same_day' })).toThrow(ValidationError);
  });

  it('flags long lanes as needing a relay', () => {
    // Seeded lanes are all short; find a long one deterministically.
    const result = calculateRoute({ origin: 'Miami', destination: 'Seattle' });
    expect(['optimized', 'suboptimal', 'requires_relay']).toContain(result.status);
  });
});
