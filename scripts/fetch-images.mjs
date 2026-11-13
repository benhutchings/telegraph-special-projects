// Download each project's social share (og:image) picture into
// src/assets/share/<slug>.<ext>, where Astro resizes and optimises it at build
// time. Nothing is loaded from telegraph.co.uk when people view the site.
//
//  • Only projects without a downloaded image are fetched, so re-runs are fast.
//  • Projects with an "Image" column in the sheet are skipped.
//  • src/data/images.json remembers which share image each page pointed to.
//  • Failures are reported but never stop a build.
//
// Usage:  npm run images             fetch anything missing
//         npm run images -- --all    re-download everything
//         npm run images -- --prune  also delete images for removed projects
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProjects } from '../src/lib/rows.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(root, 'src/data/projects.csv');
const jsonPath = path.join(root, 'src/data/images.json');
const outDir = path.join(root, 'src/assets/share');
const refetch = process.argv.includes('--all');
const prune = process.argv.includes('--prune');
const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const UA = 'Mozilla/5.0 (compatible; SpecialProjectsArchive/1.0)';
const NO_PHOTO = 'none';

fs.mkdirSync(outDir, { recursive: true });
const projects = parseProjects(fs.readFileSync(csvPath, 'utf8'));
const sources = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : {};

const existing = (slug) => EXTS.map((e) => path.join(outDir, `${slug}.${e}`)).find((f) => fs.existsSync(f));

function extractImage(html, base) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try {
        return new URL(m[1].replace(/&amp;/g, '&'), base).href;
      } catch {}
    }
  }
  return '';
}

// Telegraph share URLs add ?impolicy=OG-Standard, which burns a logo into the
// picture. The bare URL returns the clean original at full size.
function clean(img) {
  try {
    const u = new URL(img);
    if (/(^|\.)telegraph\.co\.uk$/.test(u.hostname) && u.pathname.startsWith('/content/dam/')) {
      u.search = '';
      return u.href;
    }
  } catch {}
  return img;
}

/** Identify JPEG / PNG / WebP / AVIF from the file's first bytes. */
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('ascii', 4, 12) === 'ftypavif') return 'avif';
  return null;
}

async function processProject(p) {
  if (refetch) {
    const f = existing(p.slug);
    if (f) fs.unlinkSync(f);
  }
  let src = !refetch && sources[p.url];
  if (src === NO_PHOTO) throw new Error('page has no share photo (remembered; run with --all to retry)');
  if (!src) {
    const res = await fetch(p.url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`page HTTP ${res.status}`);
    src = extractImage(await res.text(), res.url);
    if (!src) throw new Error('no share image on page');
  }
  src = clean(src);
  sources[p.url] = src;

  const img = await fetch(src, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA } });
  if (!img.ok) throw new Error(`image HTTP ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  // Trust the bytes, not the headers: generic share icons (SVG logos) are
  // sometimes served as images. Only keep real photos.
  const ext = sniff(buf);
  if (!ext) {
    sources[p.url] = NO_PHOTO; // don't retry this page on every build
    throw new Error('share image is a generic icon, not a photo');
  }
  fs.writeFileSync(path.join(outDir, `${p.slug}.${ext}`), buf);
}

const todo = projects.filter(
  (p) => p.url && /^https?:/.test(p.url) && !p.imageUrl && (refetch || (!existing(p.slug) && sources[p.url] !== NO_PHOTO)),
);
console.log(`Share images: ${projects.filter((p) => existing(p.slug)).length} ready, ${todo.length} to fetch.`);

let ok = 0;
const failed = [];
const queue = [...todo];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let p; (p = queue.shift()); ) {
      try {
        await processProject(p);
        ok++;
        console.log(`  ✓ ${p.slug}`);
      } catch (e) {
        failed.push(p.slug);
        console.log(`  · ${p.slug}: ${e.message ?? e.name} (using a tile)`);
      }
    }
  }),
);

// Tidy up images whose project no longer exists.
const slugs = new Set(projects.map((p) => p.slug));
const orphans = fs.readdirSync(outDir).filter((f) => !slugs.has(f.replace(/\.[^.]+$/, '')) && !f.startsWith('.'));
if (orphans.length) {
  if (prune) orphans.forEach((f) => fs.unlinkSync(path.join(outDir, f)));
  console.log(`${prune ? 'Removed' : 'Unused (run with --prune to delete)'}: ${orphans.join(', ')}`);
}

fs.writeFileSync(jsonPath, JSON.stringify(sources, null, 2) + '\n');
const noImage = projects.filter((p) => !p.imageUrl && !existing(p.slug)).map((p) => p.slug);
console.log(`Done: ${ok} downloaded${failed.length ? `, ${failed.length} failed` : ''}.`);
if (noImage.length) console.log(`Using a typographic tile for: ${noImage.join(', ')}`);
