// Fake routing "engine". Fully deterministic so tests and the demo never flake:
// the same origin/destination/vehicle always produces the same numbers.

export const VEHICLE_TYPES = ['van', 'box_truck', 'semi'];
export const SERVICE_LEVELS = ['standard', 'expedited', 'refrigerated'];

// Heavier vehicles are slower over the same distance.
const VEHICLE_DURATION_MULTIPLIER = {
  van: 1.0,
  box_truck: 1.08,
  semi: 1.15,
};

// Service level changes the operational commitment, not the deterministic road
// time. Keeping those concepts separate lets the UI expose a realistic dispatch
// choice without making the core route estimate surprising or non-repeatable.
// `rateMultiplier` scales the base per-mile rate below.
const SERVICE_LEVEL_POLICY = {
  standard: { label: 'Standard', dispatchBufferMinutes: 180, rateMultiplier: 1.0 },
  expedited: { label: 'Expedited', dispatchBufferMinutes: 45, rateMultiplier: 1.35 },
  refrigerated: { label: 'Refrigerated', dispatchBufferMinutes: 90, rateMultiplier: 1.2 },
};

// Not every vehicle can carry every service level — refrigerated freight needs
// cold-chain capacity a cargo van doesn't have. This is the one place vehicle
// and service level constrain each other rather than being independent picks.
const ELIGIBLE_VEHICLES_FOR_SERVICE = {
  standard: ['van', 'box_truck', 'semi'],
  expedited: ['van', 'box_truck', 'semi'],
  refrigerated: ['box_truck', 'semi'],
};

// Illustrative dollar-per-mile rate by vehicle, before the service-level
// multiplier. Larger vehicles cost more to run per mile.
const BASE_RATE_PER_MILE_USD = {
  van: 2.1,
  box_truck: 2.75,
  semi: 3.4,
};

// A shipment already in transit is "at risk" once it's used up this fraction
// of its SLA window, and "breached" once it exceeds it entirely.
const SLA_AT_RISK_THRESHOLD = 0.85;

// Hand-seeded lanes so the demo shows plausible numbers for real city pairs.
// Denver -> Salt Lake City is the canonical demo lane (312 mi / 338 min on a van).
const KNOWN_LANES = {
  'denver|salt lake city': { distance: 312, duration: 338 },
  'salt lake city|denver': { distance: 312, duration: 338 },
  'los angeles|phoenix': { distance: 372, duration: 355 },
  'chicago|detroit': { distance: 283, duration: 269 },
  'dallas|houston': { distance: 239, duration: 224 },
  'seattle|portland': { distance: 174, duration: 173 },
};

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Deterministic 32-bit string hash (FNV-1a), used for lanes not in the table.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function baseLane(origin, destination) {
  const key = `${normalize(origin)}|${normalize(destination)}`;
  if (KNOWN_LANES[key]) return KNOWN_LANES[key];

  // Unknown lane: derive stable pseudo-values in a believable range.
  const seed = hash(key);
  const distance = 45 + (seed % 1150); // 45-1194 miles
  const avgMph = 52 + ((seed >>> 8) % 9); // 52-60 mph
  return { distance, duration: Math.round((distance / avgMph) * 60) };
}

/**
 * Status reflects how "good" the computed lane is. Deterministic, but varied
 * enough that the UI does not always show the same badge.
 */
function statusFor(distance) {
  if (distance > 900) return 'requires_relay';
  if (distance > 600) return 'suboptimal';
  return 'optimized';
}

function dispatchRiskFor(status, serviceLevel) {
  if (status === 'requires_relay') return 'attention';
  if (status === 'suboptimal' || serviceLevel === 'expedited') return 'monitor';
  return 'on_track';
}

/**
 * A shipment's progress against its own SLA quote. `elapsedMinutes` is
 * supplied by the caller (this app has no live tracking of its own), so the
 * result stays a pure function of its inputs rather than depending on the
 * wall clock.
 */
function slaStatusFor(elapsedMinutes, slaMinutes) {
  if (elapsedMinutes === null) return 'not_tracked';
  if (elapsedMinutes > slaMinutes) return 'breached';
  if (elapsedMinutes >= slaMinutes * SLA_AT_RISK_THRESHOLD) return 'at_risk';
  return 'on_time';
}

// The partner relay network: every dock a second driver can legally take a
// trailer over at. Generated from the same deterministic hash as the lane
// table, so a given lane always plans the same handoff. `corridorMile` is
// where the dock sits along the freight corridor; lat/lon is its physical
// position, which is what a relief driver actually has to deadhead across.
const RELAY_NETWORK_SIZE = 6000;

// A relief driver will not be dispatched further than this to reach a handoff.
const MAX_DEADHEAD_MILES = 250;

const EARTH_RADIUS_MILES = 3958.8;

function buildRelayNetwork(size) {
  const facilities = [];
  for (let i = 0; i < size; i += 1) {
    const seed = hash(`relay-facility-${i}`);
    facilities.push({
      id: `RF-${String(i).padStart(5, '0')}`,
      corridorMile: 25 + (seed % 1200),
      lat: 25 + ((seed % 24000) / 1000), // 25.0-49.0 N
      lon: -125 + (((seed >>> 7) % 58000) / 1000), // 125.0-67.0 W
      dockCapacity: 2 + ((seed >>> 8) % 12),
      reliefDrivers: 1 + ((seed >>> 16) % 6),
    });
  }
  return facilities;
}

const RELAY_FACILITY_NETWORK = buildRelayNetwork(RELAY_NETWORK_SIZE);

function greatCircleMiles(a, b) {
  const toRadians = Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * toRadians;
  const deltaLon = (b.lon - a.lon) * toRadians;
  const halfLat = Math.sin(deltaLat / 2);
  const halfLon = Math.sin(deltaLon / 2);
  const h = halfLat * halfLat
    + Math.cos(a.lat * toRadians) * Math.cos(b.lat * toRadians) * halfLon * halfLon;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Picks where a long lane hands off to a second driver.
 *
 * A relay needs two things at once: a dock with spare capacity near the middle
 * of the lane, and a relief driver close enough to reach it. Drivers are
 * domiciled at facilities, so every (handoff, domicile) pairing is a candidate.
 * The best one splits the lane evenly without spending too much of the saving
 * on deadhead, and prefers a domicile with drivers to spare.
 */
function planRelayHandoff(distance) {
  let best = null;

  for (const handoff of RELAY_FACILITY_NETWORK) {
    const firstLeg = handoff.corridorMile;
    const secondLeg = distance - firstLeg;
    if (secondLeg <= 0) continue;
    if (handoff.dockCapacity < 2) continue;

    const imbalance = Math.abs(firstLeg - secondLeg);

    for (const domicile of RELAY_FACILITY_NETWORK) {
      if (domicile.id === handoff.id) continue;

      const deadhead = greatCircleMiles(domicile, handoff);
      if (deadhead > MAX_DEADHEAD_MILES) continue;

      const score = imbalance + deadhead * 1.5 - domicile.reliefDrivers * 10;
      if (best === null || score < best.score) {
        best = { handoff, domicile, deadhead, firstLeg, secondLeg, score };
      }
    }
  }

  if (best === null) return null;

  return {
    facility_id: best.handoff.id,
    relief_domicile_id: best.domicile.id,
    first_leg_miles: best.firstLeg,
    second_leg_miles: best.secondLeg,
    deadhead_miles: Math.round(best.deadhead * 10) / 10,
    relief_drivers: best.domicile.reliefDrivers,
  };
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * @param {{origin: string, destination: string, vehicle_type?: string, service_level?: string, elapsed_minutes?: number}} input
 * @returns {{distance_miles: number, duration_minutes: number, status: string, vehicle_type: string, service_level: string, service_level_label: string, delivery_sla_minutes: number, dispatch_risk: string, lane: string, estimated_cost_usd: number, sla_status: string, sla_remaining_minutes: number | null, relay_handoff: object | null}}
 */
export function calculateRoute(input) {
  const origin = String(input?.origin ?? '').trim();
  const destination = String(input?.destination ?? '').trim();
  const vehicleType = String(input?.vehicle_type ?? 'van').trim() || 'van';
  const serviceLevel = String(input?.service_level ?? 'standard').trim() || 'standard';
  const elapsedMinutesRaw = input?.elapsed_minutes;
  const elapsedMinutes = elapsedMinutesRaw === undefined || elapsedMinutesRaw === null ? null : Number(elapsedMinutesRaw);

  if (!origin) throw new ValidationError('origin is required');
  if (!destination) throw new ValidationError('destination is required');
  if (!VEHICLE_TYPES.includes(vehicleType)) {
    throw new ValidationError(`vehicle_type must be one of: ${VEHICLE_TYPES.join(', ')}`);
  }
  if (!SERVICE_LEVELS.includes(serviceLevel)) {
    throw new ValidationError(`service_level must be one of: ${SERVICE_LEVELS.join(', ')}`);
  }
  if (!ELIGIBLE_VEHICLES_FOR_SERVICE[serviceLevel].includes(vehicleType)) {
    const eligible = ELIGIBLE_VEHICLES_FOR_SERVICE[serviceLevel].join(', ');
    throw new ValidationError(`${serviceLevel} service is not available on a ${vehicleType}; eligible vehicles: ${eligible}`);
  }
  if (elapsedMinutes !== null && (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0)) {
    throw new ValidationError('elapsed_minutes must be a non-negative number');
  }

  const lane = baseLane(origin, destination);
  const multiplier = VEHICLE_DURATION_MULTIPLIER[vehicleType];
  const durationMinutes = Math.round(lane.duration * multiplier);
  const status = statusFor(lane.distance);
  const relayHandoff = status === 'requires_relay' ? planRelayHandoff(lane.distance) : null;
  const servicePolicy = SERVICE_LEVEL_POLICY[serviceLevel];
  const deliverySlaMinutes = durationMinutes + servicePolicy.dispatchBufferMinutes;
  const estimatedCostUsd = Math.round(lane.distance * BASE_RATE_PER_MILE_USD[vehicleType] * servicePolicy.rateMultiplier * 100) / 100;

  return {
    distance_miles: lane.distance,
    duration_minutes: durationMinutes,
    status,
    vehicle_type: vehicleType,
    service_level: serviceLevel,
    service_level_label: servicePolicy.label,
    delivery_sla_minutes: deliverySlaMinutes,
    dispatch_risk: dispatchRiskFor(status, serviceLevel),
    lane: `${origin} → ${destination}`,
    estimated_cost_usd: estimatedCostUsd,
    sla_status: slaStatusFor(elapsedMinutes, deliverySlaMinutes),
    sla_remaining_minutes: elapsedMinutes === null ? null : deliverySlaMinutes - elapsedMinutes,
    relay_handoff: relayHandoff,
  };
}
