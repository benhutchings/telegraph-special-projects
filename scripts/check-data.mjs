// Sanity-check src/data/projects.csv before every build.
//
//   ✗ errors stop the build (on Netlify the previous deploy stays live)
//   ! warnings are printed in the build log so someone can tidy the sheet
//
// Usage: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/lib/csv.mjs';
import { parseProjects, slugify } from '../src/lib/rows.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csv = fs.readFileSync(path.join(root, 'src/data/projects.csv'), 'utf8');
const types = JSON.parse(fs.readFileSync(path.join(root, 'src/data/types.json'), 'utf8'));

const errors = [];
const warnings = [];
const list = (items, max = 8) => items.slice(0, max).join(', ') + (items.length > max ? ` …and ${items.length - max} more` : '');

// Columns
const rows = parseCSV(csv);
const columns = Object.keys(rows[0] ?? {});
if (!columns.some((c) => ['name', 'project', 'title'].includes(c))) {
  errors.push(`No "Name" column found. Columns are: ${columns.join(', ') || '(none)'}`);
}
if (!columns.includes('type') && !columns.includes('category')) warnings.push('No "Type" column: every project will be filed under "Other".');

const projects = parseProjects(csv);
if (projects.length === 0) errors.push('The sheet has no projects. Refusing to publish an empty site.');

// Per-project checks
const noType = projects.filter((p) => p.type === 'Other').map((p) => p.title);
if (noType.length) warnings.push(`${noType.length} project(s) have no Type (shown as "Other"): ${list(noType)}`);

const noUrl = projects.filter((p) => !p.url).map((p) => p.title);
if (noUrl.length) warnings.push(`${noUrl.length} project(s) have no URL: ${list(noUrl)}`);

const badUrl = projects
  .flatMap((p) => [['URL', p.url], ['Figma', p.figma], ['Image', p.imageUrl]].map(([k, v]) => [p.title, k, v]))
  .filter(([, , v]) => v && !/^https?:\/\/\S+$/i.test(v))
  .map(([t, k]) => `${t} (${k})`);
if (badUrl.length) warnings.push(`${badUrl.length} link(s) don't look like web addresses: ${list(badUrl)}`);

const dupes = projects.filter((p) => /-\d+$/.test(p.slug) && projects.some((q) => q.slug === p.slug.replace(/-\d+$/, ''))).map((p) => p.title);
if (dupes.length) warnings.push(`Duplicate titles/slugs were given a number suffix: ${list(dupes)}. Add a Slug column value to choose the address.`);

const noSlug = projects.filter((p) => !p.hasSlug).length;
if (columns.includes('slug') && noSlug) warnings.push(`${noSlug} project(s) have no Slug yet; their address is made from the title, so it will change if the title is edited.`);

// Types
const described = new Set(Object.keys(types).filter((k) => !k.startsWith('_')).map(slugify));
const undescribed = [...new Set(projects.filter((p) => !described.has(p.typeSlug)).map((p) => p.type))];
if (undescribed.length) warnings.push(`Type(s) with no description in the Types tab / types.json: ${undescribed.join(', ')}`);

// Report
const byType = Object.entries(projects.reduce((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {}))
  .map(([t, n]) => `${t} ${n}`)
  .join(' · ');
console.log(`Data check: ${projects.length} projects${byType ? ` (${byType})` : ''}`);
warnings.forEach((w) => console.log(`  ! ${w}`));
errors.forEach((e) => console.log(`  ✗ ${e}`));
if (errors.length) {
  console.log('Build stopped: fix the sheet and rebuild.');
  process.exit(1);
}
if (!warnings.length) console.log('  ✓ No problems found.');
