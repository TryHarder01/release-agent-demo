import { createApp } from './app.js';

const port = Number(process.env.PORT || 8080);
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(
    `${JSON.stringify({
      ts: new Date().toISOString(),
      severity: 'INFO',
      event: 'server_started',
      port,
      release_id: (process.env.RELEASE_VERSION || 'dev').slice(0, 7),
      image_tag: process.env.IMAGE_TAG || 'local',
      route_delay_ms: Number(process.env.ROUTE_DELAY_MS || 0),
    })}\n`,
  );
});
