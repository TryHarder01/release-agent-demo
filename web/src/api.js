/**
 * Calls the routing API and validates the response contract.
 *
 * The validation is deliberate: if the API stops returning `duration_minutes`
 * the UI must fail loudly rather than silently rendering a blank field. That is
 * what makes a schema regression visible to the end-to-end test.
 */
export async function calculateRoute({ origin, destination, vehicleType, serviceLevel }) {
  const res = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, vehicle_type: vehicleType, service_level: serviceLevel }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Route request failed (${res.status})`);
  }

  const data = await res.json();

  const missing = ['distance_miles', 'duration_minutes', 'status'].filter(
    (key) => data[key] === undefined || data[key] === null,
  );
  if (missing.length > 0) {
    throw new Error(`Malformed route response: missing ${missing.join(', ')}`);
  }

  return data;
}

export async function fetchHealth() {
  const res = await fetch('/health');
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
