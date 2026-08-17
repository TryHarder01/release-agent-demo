#!/usr/bin/env node
/**
 * Captures visual evidence of a running candidate: screenshots plus a short
 * walkthrough video, collected into media/ under stable filenames.
 *
 *   BASE_URL=https://... node scripts/capture-demo.mjs
 *
 * Playwright writes videos to test-results/<random>/video.webm, so this copies
 * the recording out to media/demo-walkthrough.webm where CI can find it.
 *
 * The .webm is also transcoded to media/demo-walkthrough.mp4, which is what
 * scripts/publish-media.mjs uploads for inline playback in the PR comment:
 * GitHub's attachment store takes .mp4/.mov, not .webm.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const MEDIA_DIR = path.resolve(process.cwd(), 'media');
const RESULTS_DIR = path.resolve(process.cwd(), 'test-results');

// GitHub caps comment attachments at 10 MB on free plans, 100 MB on paid. A
// 10-second UI walkthrough lands around 150 KB, so this is headroom, not a
// constraint — it exists to fail loudly if the demo spec ever grows unbounded.
const MAX_MP4_BYTES = 10 * 1024 * 1024;

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

function ffmpeg(args) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('close', (code) => resolve(code));
    child.on('error', () => resolve(-1));
  });
}

/**
 * Transcode the walkthrough to H.264 mp4. yuv420p because Safari and the
 * GitHub player refuse 4:4:4; +faststart moves the moov atom to the front so
 * playback starts before the whole file has downloaded.
 */
async function toMp4(source, target) {
  const code = await ffmpeg([
    '-y', '-v', 'error',
    '-i', source,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-vf', 'scale=1280:-2',
    target,
  ]);
  if (code !== 0) return null;
  return { size: fs.statSync(target).size };
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

  log('\n==> Inline mp4');
  const mp4Path = path.join(MEDIA_DIR, 'demo-walkthrough.mp4');
  const mp4 = await toMp4(target, mp4Path);
  if (!mp4) {
    process.stderr.write('mp4 transcode failed — the PR comment would have no inline playback\n');
    process.exit(1);
  }
  if (mp4.size > MAX_MP4_BYTES) {
    process.stderr.write(
      `mp4 is ${Math.round(mp4.size / 1024 / 1024)} MB, over GitHub's 10 MB attachment limit — ` +
        'shorten the walkthrough in e2e/demo.spec.js\n',
    );
    process.exit(1);
  }
  log(`    ${Math.round(mp4.size / 1024)} KB`);

  log('\n==> Collected media');
  for (const file of fs.readdirSync(MEDIA_DIR).sort()) {
    const kb = Math.round(fs.statSync(path.join(MEDIA_DIR, file)).size / 1024);
    log(`    media/${file} (${kb} KB)`);
  }
  log(`\nWalkthrough video: media/demo-walkthrough.webm (${sizeKb} KB)`);
  log(`Inline walkthrough: media/demo-walkthrough.mp4 (${Math.round(mp4.size / 1024)} KB)`);
}

main().catch((err) => {
  process.stderr.write(`capture failed: ${err.stack}\n`);
  process.exit(1);
});
