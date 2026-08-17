// Fake routing "engine". Fully deterministic so tests and the demo never flake:
// the same origin/destination/vehicle always produces the same numbers.

export const VEHICLE_TYPES = ['van', 'box_truck', 'semi'];

// Heavier vehicles are slower over the same distance.
const VEHICLE_DURATION_MULTIPLIER = {
  van: 1.0,
  box_truck: 1.08,
  semi: 1.15,
};

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

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * @param {{origin: string, destination: string, vehicle_type?: string}} input
 * @returns {{distance_miles: number, duration_minutes: number, status: string, vehicle_type: string, lane: string}}
 */
export function calculateRoute(input) {
  const origin = String(input?.origin ?? '').trim();
  const destination = String(input?.destination ?? '').trim();
  const vehicleType = String(input?.vehicle_type ?? 'van').trim() || 'van';

  if (!origin) throw new ValidationError('origin is required');
  if (!destination) throw new ValidationError('destination is required');
  if (!VEHICLE_TYPES.includes(vehicleType)) {
    throw new ValidationError(`vehicle_type must be one of: ${VEHICLE_TYPES.join(', ')}`);
  }

  const lane = baseLane(origin, destination);
  const multiplier = VEHICLE_DURATION_MULTIPLIER[vehicleType];

  return {
    distance_miles: lane.distance,
    duration_minutes: Math.round(lane.duration * multiplier),
    status: statusFor(lane.distance),
    vehicle_type: vehicleType,
    lane: `${origin} → ${destination}`,
  };
}
