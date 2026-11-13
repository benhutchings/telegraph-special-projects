// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Netlify sets URL to the site's main address at build time (used for share-image links).
  site: process.env.URL || 'http://localhost:4321',
});
