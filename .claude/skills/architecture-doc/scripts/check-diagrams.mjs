#!/usr/bin/env node
/**
 * Validate the Mermaid blocks in an architecture document.
 *
 *   node check-diagrams.mjs [path]          # static lint only, no deps
 *   node check-diagrams.mjs [path] --render # also render each block headlessly
 *
 * Static checks (always):
 *   - no HTML tags inside a diagram
 *   - every declared node is assigned a class (an unclassed node silently
 *     inherits Mermaid's default lavender, which means nothing)
 *   - every diagram declares a legend line beneath it
 *   - only classDef names from the color contract are defined
 *
 * --render additionally loads each block in headless Chromium via Playwright
 * and fails on any parse error. Requires `playwright` to be resolvable and a
 * browser installed; skipped with a notice otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const LEGEND_S = ['actor', 'owned', 'internal', 'external'];
const LEGEND_R = ['pass', 'warn', 'fail', 'blind'];
const ALLOWED_CLASSES = new Set([...LEGEND_S, ...LEGEND_R, 'boundary']);

const file = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'ARCHITECTURE.md');
const wantRender = process.argv.includes('--render');
const md = fs.readFileSync(file, 'utf8');

// Capture each block plus the line that follows it, to check the legend note.
const matches = [...md.matchAll(/```mermaid\n([\s\S]*?)```\n+([^\n]*)/g)];
const blocks = matches.map((m) => m[1]);
const trailers = matches.map((m) => m[2]);

let problems = 0;

console.log(`${path.basename(file)} — ${blocks.length} mermaid block(s)\n`);

blocks.forEach((b, i) => {
  const issues = [];
  const fail = (msg) => issues.push(msg);

  if (/<[a-zA-Z/]/.test(b)) {
    fail('contains an HTML tag — use \\n for line breaks, never <br/>');
  }

  const declared = new Set([...b.matchAll(/^\s*(\w+)[[{]/gm)].map((m) => m[1]));
  [...b.matchAll(/subgraph\s+(\w+)\[/g)].forEach((m) => declared.add(m[1]));

  const classed = new Set();
  [...b.matchAll(/^\s*class\s+([\w,]+)\s+\w+/gm)].forEach((m) =>
    m[1].split(',').forEach((n) => classed.add(n)));

  const unclassed = [...declared].filter((n) => !classed.has(n));
  if (unclassed.length) fail(`unclassed node(s): ${unclassed.join(', ')} — will render default lavender`);

  const defined = [...b.matchAll(/classDef\s+(\w+)/g)].map((m) => m[1]);
  const rogue = defined.filter((c) => !ALLOWED_CLASSES.has(c));
  if (rogue.length) fail(`classDef not in the color contract: ${rogue.join(', ')}`);

  // A diagram that uses classes from BOTH legends is the legend key itself —
  // the one diagram allowed to mix, and the one that needs no legend line
  // because it is the legend. Anything else mixing them is an error.
  const usedClasses = new Set([...b.matchAll(/^\s*class\s+[\w,]+\s+(\w+)/gm)].map((m) => m[1]));
  const usesS = LEGEND_S.some((c) => usedClasses.has(c));
  const usesR = LEGEND_R.some((c) => usedClasses.has(c));
  const isLegendKey = usesS && usesR;

  if (!isLegendKey && !/^_Legend [SR] —/.test((trailers[i] || '').trim())) {
    fail('no legend declaration immediately below the diagram');
  }

  console.log(`block ${i}${isLegendKey ? '  (legend key)' : ''}`);
  if (issues.length) {
    issues.forEach((m) => console.log(`  ✕ ${m}`));
    problems += issues.length;
  } else {
    console.log('  ok');
  }
});

if (wantRender) {
  console.log('\nrendering...');
  try {
    // Resolve playwright from the working directory, not from this script's
    // location — the skill lives outside the project's node_modules.
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    let mod;
    try {
      mod = await import(pathToFileURL(require.resolve('playwright')).href);
    } catch {
      mod = await import('playwright');
    }
    // A CJS package imported by file URL exposes its exports under `default`.
    const { chromium } = mod.chromium ? mod : mod.default;
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent('<div></div>');
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js' });
    const results = await page.evaluate(async (defs) => {
      window.mermaid.initialize({ startOnLoad: false });
      const out = [];
      for (let i = 0; i < defs.length; i += 1) {
        try {
          await window.mermaid.render(`g${i}`, defs[i]);
          out.push({ i, ok: true });
        } catch (e) {
          out.push({ i, ok: false, error: String(e.message || e).slice(0, 200) });
        }
      }
      return out;
    }, blocks);
    await browser.close();
    for (const r of results) {
      if (r.ok) console.log(`  block ${r.i}: renders`);
      else fail(`block ${r.i} failed to render: ${r.error}`);
    }
  } catch (err) {
    console.log(`  (skipped: ${err.message.split('\n')[0]})`);
  }
}

console.log(problems ? `\n${problems} problem(s)` : '\nall checks passed');
process.exit(problems ? 1 : 0);
