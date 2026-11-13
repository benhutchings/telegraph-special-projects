// Turns the raw spreadsheet CSV into a clean list of projects.
// Plain JS so the site (projects.ts) and the Node scripts share one source of
// truth, which keeps slugs, and therefore image file names, in step.
import { parseCSV } from './csv.mjs';

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Find a value by trying several possible column names. */
function pick(row, ...keys) {
  for (const k of keys) if (row[k]) return row[k];
  return '';
}

const TITLE_KEYS = ['project', 'title', 'name'];
const YEAR_ROW = /^\d{4}(\s*[\/–-]\s*\d{2,4})?$/;

/**
 * @returns {{slug:string,title:string,type:string,typeSlug:string,url:string,figma:string,
 *            year:string,description:string,imageUrl:string,alt:string}[]}
 */
export function parseProjects(csvText) {
  const seen = new Map();
  // Rows that only contain a year (e.g. "2025" or "2023/2024") act as section
  // dividers: every project below them inherits that year until the next one.
  let sectionYear = '';
  const out = [];

  for (const row of parseCSV(csvText)) {
    const title = pick(row, ...TITLE_KEYS);
    if (!title) continue;
    const others = Object.entries(row).filter(([k, v]) => v && !TITLE_KEYS.includes(k));
    if (others.length === 0 && YEAR_ROW.test(title)) {
      sectionYear = title.replace(/\s+/g, '');
      continue;
    }

    // A "Slug" column keeps page addresses fixed when a title is edited.
    let slug = slugify(pick(row, 'slug')) || slugify(title) || 'project';
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n) slug = `${slug}-${n + 1}`;

    const type = pick(row, 'type', 'category') || 'Other';
    out.push({
      slug,
      title,
      type,
      typeSlug: slugify(type),
      url: pick(row, 'url', 'link url', 'link'),
      figma: pick(row, 'figma', 'figma link', 'figma url'),
      year: pick(row, 'year', 'date') || sectionYear,
      hasSlug: Boolean(pick(row, 'slug')),
      description: pick(row, 'description', 'summary', 'dek'),
      imageUrl: pick(row, 'image', 'image url', 'thumbnail'),
      alt: pick(row, 'alt', 'alt text', 'image alt'),
    });
  }
  return out;
}
