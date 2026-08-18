#!/usr/bin/env node
/**
 * Parse every Mermaid block in a Markdown file using Mermaid in headless
 * Chromium. Usage: node check-mermaid.mjs PATH --render
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const file = process.argv.find((arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]);
if (!file) {
  console.error('Usage: node check-mermaid.mjs PATH --render');
  process.exit(2);
}

const markdown = fs.readFileSync(path.resolve(file), 'utf8');
const blocks = [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
if (blocks.length === 0) {
  console.log(`${path.basename(file)} — no Mermaid blocks`);
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<main></main>');
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js' });
const results = await page.evaluate(async (definitions) => {
  window.mermaid.initialize({ startOnLoad: false });
  return Promise.all(definitions.map(async (definition, index) => {
    try {
      await window.mermaid.render(`diagram-${index}`, definition);
      return { index, ok: true };
    } catch (error) {
      return { index, ok: false, error: String(error.message || error) };
    }
  }));
}, blocks);
await browser.close();

console.log(`${path.basename(file)} — ${blocks.length} Mermaid block(s)`);
for (const result of results) {
  console.log(result.ok ? `  block ${result.index}: renders` : `  block ${result.index}: ${result.error}`);
}
process.exit(results.every((result) => result.ok) ? 0 : 1);
