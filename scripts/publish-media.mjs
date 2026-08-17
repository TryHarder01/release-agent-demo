#!/usr/bin/env node
/**
 * Uploads captured media to GitHub's comment-attachment store and prints a
 * name -> URL map, so a PR comment can embed a real video player instead of
 * linking to a zip.
 *
 *   GH_TOKEN=$(gh auth token) REPOSITORY=owner/repo node scripts/publish-media.mjs
 *
 * Why this endpoint: GitHub strips <video> tags out of comment markdown, and
 * renders a player for exactly one thing — a github.com/user-attachments/assets
 * URL, which its own drag-and-drop upload produces. `POST /markdown` with such a
 * URL comes back as <video controls src="private-user-images...?jwt=...">, so
 * the asset is signed per-viewer and works on a private repo with no branch and
 * no public bucket. The endpoint below is what drag-and-drop calls. It is
 * undocumented: treat a failure here as expected weather, not an incident —
 * scripts/../.github/workflows/ci.yml falls back to the artifact link.
 *
 * Env:
 *   GH_TOKEN     (required) token to authenticate the upload
 *   REPOSITORY   default: derived from the origin remote (owner/repo)
 *   MEDIA_DIR    default media
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MEDIA_DIR = path.resolve(process.cwd(), process.env.MEDIA_DIR || 'media');
const TOKEN = process.env.GH_TOKEN;

// Only what the comment embeds. The rest of media/ rides along in the artifact.
const UPLOAD = [
  ['demo-walkthrough.mp4', 'video/mp4'],
  ['01-empty-state.png', 'image/png'],
  ['03-route-results.png', 'image/png'],
  ['05-mobile-results.png', 'image/png'],
];

const log = (msg) => process.stderr.write(`${msg}\n`);

function repositoryId(repository) {
  const out = execFileSync('gh', ['api', `repos/${repository}`, '--jq', '.id'], {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: TOKEN },
  });
  return out.trim();
}

async function upload(file, contentType, repoId) {
  const url =
    'https://uploads.github.com/user-attachments/assets' +
    `?name=${encodeURIComponent(file)}&content_type=${encodeURIComponent(contentType)}` +
    `&repository_id=${repoId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': contentType,
    },
    body: fs.readFileSync(path.join(MEDIA_DIR, file)),
  });

  if (!res.ok) {
    throw new Error(`${file}: ${res.status} ${res.statusText} — ${(await res.text()).slice(0, 200)}`);
  }

  const body = await res.json();
  if (!body.url) throw new Error(`${file}: upload succeeded but returned no url`);
  return body.url;
}

async function main() {
  if (!TOKEN) {
    log('GH_TOKEN must be set');
    process.exit(1);
  }

  let repository = process.env.REPOSITORY || process.env.GITHUB_REPOSITORY;
  if (!repository) {
    repository = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' })
      .trim()
      .replace(/^(git@github\.com:|https:\/\/github\.com\/)/, '')
      .replace(/\.git$/, '');
  }

  const repoId = repositoryId(repository);
  log(`==> Uploading media as ${repository} attachments (repository_id=${repoId})`);

  const assets = {};
  for (const [file, contentType] of UPLOAD) {
    const full = path.join(MEDIA_DIR, file);
    if (!fs.existsSync(full)) {
      log(`    ${file} missing — run npm run capture first`);
      process.exit(1);
    }
    assets[file] = await upload(file, contentType, repoId);
    log(`    ${file} (${Math.round(fs.statSync(full).size / 1024)} KB) -> ${assets[file]}`);
  }

  const json = JSON.stringify(assets);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `assets=${json}\n`);
  }
  process.stdout.write(`${json}\n`);
}

main().catch((err) => {
  log(`attachment upload failed: ${err.message}`);
  process.exit(1);
});
