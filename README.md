# Telegraph Special Projects

An Astro static site that archives The Telegraph's special projects. Content is edited in a Google Sheet. The
site is hosted on Netlify and rebuilds from the sheet automatically.

## Getting started

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
```

Node 22.23.4 or newer is required (see `.nvmrc`).

## Editing content

**Edit the Google Sheet. Changes go live at the next build:** every morning at about 07:00 UK time, or straight away
if you trigger a rebuild (see below).

### Projects tab

Column names are case-insensitive, and unknown columns are ignored.

| Column        | Required | Used for                                                                 |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `Name`        | yes      | Project title                                                            |
| `Type`        | yes      | Format: home page sections, filters, type pages                          |
| `Link URL`    |          | "View project" button, and the title/image link on the project page      |
| `Figma Link`  |          | "Figma file" button                                                      |
| `Slug`        | optional | Fixes the page address, e.g. `pension-millionaire`. Without it the address is made from the title and changes if the title is edited |
| `Year`        | optional | Shown on project pages. Rows containing only a year (e.g. `2025`) also work as dividers |
| `Description` | optional | Short summary on the project page                                        |
| `Image`       | optional | Image URL, replacing the auto-fetched share image                        |
| `Alt`         | optional | Image description for screen readers                                     |

### Types tab (optional)

Two columns, `Type` and `Description`. The description appears beside each section heading, and the row order sets the
order of sections on the home page. Until this tab is connected, the text comes from
[`src/data/types.json`](src/data/types.json).

### Build checks

Every build prints a data report. **Errors stop the build** (for example an empty sheet or a missing `Name` column)
and Netlify keeps the previous version live. **Warnings** such as projects with no URL or no Type are listed in the
Netlify deploy log so someone can tidy the sheet. Run it locally with `npm run check`.

## Deployment (Netlify + GitHub)

Build settings are in [`netlify.toml`](netlify.toml): `npm run sync && npm run build`, publishing `dist/`.

### One-time setup

1. **Publish the sheet tabs as CSV.** In Google Sheets, choose *File → Share → Publish to web*, select the
   **Projects** tab and *Comma-separated values (.csv)*, then *Publish* and copy the link. Repeat for the **Types** tab
   if you use it. (The site is public, so publishing exposes nothing it doesn't already show.)
2. **Add the links to Netlify.** Under *Site configuration → Environment variables*, add `SHEET_CSV_URL` (Projects) and
   optionally `TYPES_CSV_URL` (Types).
3. **Add a build hook for the daily rebuild.** Under *Site configuration → Build & deploy → Build hooks*, add a hook and
   copy its URL. In the GitHub repo, go to *Settings → Secrets and variables → Actions* and add it as
   `NETLIFY_BUILD_HOOK`. [`.github/workflows/rebuild.yml`](.github/workflows/rebuild.yml) then rebuilds every day.

### Publishing a change straight away

Use either of these:

- In GitHub: *Actions → Rebuild site → Run workflow*.
- In Netlify: *Deploys → Trigger deploy → Deploy site*.

### Local sync

Copy `.env.example` to `.env`, paste in the same CSV links, then run `npm run sync`. Without a `.env` file, the
committed `src/data/projects.csv` is used.

## Images

Each project's social share image (its `og:image`) is downloaded to `src/assets/share/<slug>.jpg`. Astro then resizes
it to WebP at build time, so visitors never load images from telegraph.co.uk.

- Every build fetches images for new projects first. This step never fails the build.
- `npm run images` fetches missing images on demand. Add `-- --all` to re-download everything, or `-- --prune` to delete
  images for projects that have been removed.
- Pages whose share image is only a generic logo get a coloured tile instead, and are remembered so they aren't
  re-checked on every build.
- Commit new files in `src/assets/share/` from time to time, so builds don't re-download them.

## Fonts

The Telegraph brand fonts (Austin News, Doric News UI) are licensed. See
[`src/assets/fonts/README.md`](src/assets/fonts/README.md). Keep the GitHub repository **private**.

## Structure

```
src/
  data/projects.csv          ← content (overwritten by `npm run sync`)
  data/types.json            ← Type descriptions + section order (or from the Types tab)
  data/images.json           ← share-image source URLs
  assets/share/              ← downloaded share images (<slug>.jpg)
  assets/fonts/              ← brand fonts
  lib/rows.mjs               ← parses the CSV (shared with scripts)
  lib/projects.ts            ← projects + types for the site
  components/                ← Header, Footer, Button, ProjectCard, ProjectIndex, Thumb
  pages/index.astro          ← home: a section per Type
  pages/projects/index.astro ← all projects with filters + search
  pages/type/[type].astro
  pages/projects/[slug].astro
  pages/about.astro
scripts/
  sync-sheet.mjs             ← npm run sync   (sheet → CSV)
  check-data.mjs             ← npm run check  (data report; runs before every build)
  fetch-images.mjs           ← npm run images (share images; runs before every build)
netlify.toml                 ← Netlify build settings
.github/workflows/rebuild.yml ← daily rebuild via Netlify build hook
```
