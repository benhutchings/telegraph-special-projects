// Pull the latest content from the Google Sheet before a build.
//
//   SHEET_CSV_URL  Projects tab, published as CSV      → src/data/projects.csv
//   TYPES_CSV_URL  Types tab (optional), published CSV → src/data/types.json
//
// In Google Sheets: File → Share → Publish to web → choose the tab → "Comma-separated
// values (.csv)" → Publish, and copy the link. Set the links as environment variables
// in Netlify (Site configuration → Environment variables) and, for local use, in .env.
//
// If SHEET_CSV_URL isn't set, the committed CSV is used as-is. If it is set but
// the download fails, this exits with an error so Netlify keeps the last good deploy.
//
// Usage: npm run sync
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/lib/csv.mjs';
import { parseProjects } from '../src/lib/rows.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SHEET_CSV_URL, TYPES_CSV_URL } = process.env;

async function download(url, label) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  } catch (e) {
    fail(`${label}: could not reach the sheet (${e.name}).`);
  }
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    fail(
      `${label}: the link didn't return CSV (HTTP ${res.status}).\n` +
        '    Check the tab is still published to the web as CSV, and the link is the "Publish to web" one.',
    );
  }
  return text;
}

function fail(message) {
  console.error(`✗ Sync failed. ${message}`);
  process.exit(1);
}

// Projects
if (!SHEET_CSV_URL) {
  console.log('Sync: SHEET_CSV_URL not set; using the committed src/data/projects.csv.');
} else {
  const text = await download(SHEET_CSV_URL, 'Projects tab');
  const projects = parseProjects(text);
  if (projects.length === 0) fail('Projects tab: downloaded fine but contains no projects. Not overwriting the current data.');
  fs.writeFileSync(path.join(root, 'src/data/projects.csv'), text);
  console.log(`Sync: ${projects.length} projects from the sheet.`);
}

// Types (optional): columns "Type" and "Description"; row order = section order on the home page
if (TYPES_CSV_URL) {
  const rows = parseCSV(await download(TYPES_CSV_URL, 'Types tab'));
  const entries = rows
    .map((r) => [r.type || r.name || r.format, r.description || ''])
    .filter(([name]) => name);
  if (!entries.length) fail('Types tab: no rows with a "Type" column found.');
  const json = {
    _comment:
      'Generated from the Types tab by `npm run sync`. Edit the sheet, not this file. Row order sets section order on the home page.',
    ...Object.fromEntries(entries),
  };
  fs.writeFileSync(path.join(root, 'src/data/types.json'), JSON.stringify(json, null, 2) + '\n');
  console.log(`Sync: ${entries.length} types from the Types tab.`);
}
