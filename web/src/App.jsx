import { useEffect, useState } from 'react';

import { calculateRoute, fetchHealth, formatDuration } from './api.js';

const VEHICLE_OPTIONS = [
  { value: 'van', label: 'Cargo Van' },
  { value: 'box_truck', label: 'Box Truck' },
  { value: 'semi', label: 'Semi Trailer' },
];

const LOCATION_OPTIONS = [
  'Denver',
  'Salt Lake City',
  'Phoenix',
  'Las Vegas',
  'Dallas',
  'Houston',
  'Chicago',
  'Kansas City',
  'Los Angeles',
  'San Francisco',
];

const STATUS_LABELS = {
  optimized: 'Optimized',
  suboptimal: 'Suboptimal',
  requires_relay: 'Requires Relay',
};

function SystemStatus() {
  const [health, setHealth] = useState({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const data = await fetchHealth();
        if (!cancelled) setHealth({ state: 'ok', version: data.version });
      } catch {
        if (!cancelled) setHealth({ state: 'down' });
      }
    };

    check();
    const timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const label =
    health.state === 'ok' ? 'All systems operational' : health.state === 'down' ? 'Degraded' : 'Checking…';

  return (
    <div className="system-status" data-testid="system-status" data-state={health.state}>
      <span className={`status-dot status-dot--${health.state}`} aria-hidden="true" />
      <span>{label}</span>
      {health.version ? (
        <span className="system-status__version" data-testid="release-version" title={`Deployed commit: ${health.version}`}>
          commit {health.version}
        </span>
      ) : null}
    </div>
  );
}

export default function App() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState('van');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await calculateRoute({ origin, destination, vehicleType });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__mark" aria-hidden="true">
            {/* Two waypoints joined by a routed path. */}
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M6 7.2v3.05A3.5 3.5 0 0 0 9.5 13.75h5A3.5 3.5 0 0 1 18 17.25" />
              <circle cx="6" cy="5" r="2" />
              <circle cx="18" cy="19.25" r="2" />
            </svg>
          </span>
          <div>
            <h1 className="header__title">FleetNet</h1>
            <p className="header__subtitle">Fleet dispatch &amp; lane optimization</p>
          </div>
        </div>
        <SystemStatus />
      </header>

      <main className="layout">
        <section className="panel">
          <h2 className="panel__title">Plan a lane</h2>
          <form onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Origin</span>
              <select
                className="field__input"
                data-testid="origin-input"
                name="origin"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              >
                <option value="" disabled>
                  Select an origin
                </option>
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Destination</span>
              <select
                className="field__input"
                data-testid="destination-input"
                name="destination"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="" disabled>
                  Select a destination
                </option>
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Vehicle type</span>
              <select
                className="field__input"
                data-testid="vehicle-select"
                name="vehicle_type"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                {VEHICLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="button" data-testid="calculate-button" type="submit" disabled={loading}>
              {loading ? 'Calculating…' : 'Calculate Route'}
            </button>
          </form>
        </section>

        <section className="panel">
          <h2 className="panel__title">Results</h2>

          {error ? (
            <div className="alert" data-testid="route-error" role="alert">
              {error}
            </div>
          ) : null}

          {!result && !error ? (
            <p className="empty" data-testid="results-empty">
              Enter an origin and destination to calculate a route.
            </p>
          ) : null}

          {result ? (
            <div className="results" data-testid="route-results">
              <p className="results__lane" data-testid="result-lane">
                {result.lane}
              </p>

              <dl className="metrics">
                <div className="metric">
                  <dt className="metric__label">Estimated distance</dt>
                  <dd className="metric__value" data-testid="result-distance">
                    {result.distance_miles} mi
                  </dd>
                </div>

                <div className="metric">
                  <dt className="metric__label">Estimated duration</dt>
                  <dd className="metric__value" data-testid="result-duration">
                    {formatDuration(result.duration_minutes)}
                  </dd>
                </div>

                <div className="metric">
                  <dt className="metric__label">Route status</dt>
                  <dd className="metric__value" data-testid="result-status">
                    <span className={`badge badge--${result.status}`}>
                      {STATUS_LABELS[result.status] || result.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
