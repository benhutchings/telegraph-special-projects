import type { ImageMetadata } from 'astro';
// Imported (not read with fs) so the dev server reloads when these change.
import csvText from '../data/projects.csv?raw';
import typeMeta from '../data/types.json';
// @ts-ignore – plain JS module shared with the Node scripts
import { parseProjects, slugify } from './rows.mjs';

export { slugify };

export interface Project {
  slug: string;
  title: string;
  type: string;
  typeSlug: string;
  url: string;
  figma: string;
  year: string;
  description: string;
  /** Local image (optimised by Astro) or a remote URL from the sheet's Image column. */
  image: ImageMetadata | string | null;
  alt: string;
}

// Share images downloaded by `npm run images`, named <slug>.<ext>.
const shareImages = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/share/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);
const shareBySlug = new Map(
  Object.entries(shareImages).map(([file, mod]) => [
    file.split('/').pop()!.replace(/\.[^.]+$/, ''),
    mod.default,
  ]),
);

let cache: Project[] | null = null;

export function getProjects(): Project[] {
  if (cache) return cache;
  type Row = Omit<Project, 'image'> & { imageUrl: string };
  cache = (parseProjects(csvText) as Row[]).map(({ imageUrl, ...p }) => ({
    ...p,
    image: imageUrl || shareBySlug.get(p.slug) || null,
  }));
  return cache;
}

export interface ProjectType {
  name: string;
  slug: string;
  count: number;
  description: string;
}

export function getTypes(): ProjectType[] {
  const meta = typeMeta as Record<string, string>;
  const order = Object.keys(meta).filter((k) => !k.startsWith('_')).map(slugify);
  const descBySlug = Object.fromEntries(Object.entries(meta).map(([k, v]) => [slugify(k), v]));

  const map = new Map<string, ProjectType>();
  for (const p of getProjects()) {
    const t = map.get(p.typeSlug) ?? {
      name: p.type,
      slug: p.typeSlug,
      count: 0,
      description: descBySlug[p.typeSlug] ?? '',
    };
    t.count++;
    map.set(p.typeSlug, t);
  }
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : Infinity);
  return [...map.values()].sort(
    (a, b) => rank(a.slug) - rank(b.slug) || b.count - a.count || a.name.localeCompare(b.name),
  );
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
