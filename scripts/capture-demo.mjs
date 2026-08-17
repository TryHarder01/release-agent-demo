#!/usr/bin/env node
/**
 * Captures visual evidence of a running candidate: screenshots plus a short
 * walkthrough video, collected into media/ under stable filenames.
 *
 *   BASE_URL=https://... node scripts/capture-demo.mjs
 *
 * Playwright writes videos to test-results/<random>/video.webm, so this copies
 * the recording out to media/demo-walkthrough.webm where CI can find it.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const MEDIA_DIR = path.resolve(process.cwd(), 'media');
const RESULTS_DIR = path.resolve(process.cwd(), 'test-results');

const log = (msg) => process.stdout.write(`${msg}\n`);

function run(args) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright', 'test', ...args], {
      env: { ...process.env, BASE_URL },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => resolve(code));
    child.on('error', () => resolve(-1));
  });
}

/** Recursively find every .webm under a directory. */
function findVideos(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findVideos(full));
    else if (entry.name.endsWith('.webm')) found.push(full);
  }
  return found;
}

async function main() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  log(`Capturing media from ${BASE_URL}\n`);

  log('==> Screenshots');
  const shotCode = await run(['--project=chromium', '--grep', '@screenshot']);
  if (shotCode !== 0) {
    process.stderr.write('screenshot capture failed\n');
    process.exit(1);
  }

  log('\n==> Walkthrough video');
  // Clear stale recordings so we always pick up this run's video.
  fs.rmSync(RESULTS_DIR, { recursive: true, force: true });

  const demoCode = await run(['--project=demo']);
  if (demoCode !== 0) {
    process.stderr.write('demo recording failed\n');
    process.exit(1);
  }

  const videos = findVideos(RESULTS_DIR);
  if (videos.length === 0) {
    process.stderr.write('no video produced — is the demo project configured with video: on?\n');
    process.exit(1);
  }

  // Largest file is the full walkthrough (guards against stray empty recordings).
  const source = videos.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const target = path.join(MEDIA_DIR, 'demo-walkthrough.webm');
  fs.copyFileSync(source, target);

  const sizeKb = Math.round(fs.statSync(target).size / 1024);

  log('\n==> Collected media');
  for (const file of fs.readdirSync(MEDIA_DIR).sort()) {
    const kb = Math.round(fs.statSync(path.join(MEDIA_DIR, file)).size / 1024);
    log(`    media/${file} (${kb} KB)`);
  }
  log(`\nWalkthrough video: media/demo-walkthrough.webm (${sizeKb} KB)`);
}

main().catch((err) => {
  process.stderr.write(`capture failed: ${err.stack}\n`);
  process.exit(1);
});
