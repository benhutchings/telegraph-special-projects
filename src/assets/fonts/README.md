# Brand fonts

Licensed Telegraph typefaces. Do not copy them into other projects or public repositories without checking the licence.

| File | Typeface | CSS family / weight | Used for |
| --- | --- | --- | --- |
| `AustinNewsDeck-Semibold.woff2` | Austin News Deck Semibold | `Austin News Deck` 600 | Footer logo, menu links |
| `AustinNewsIonic-RomanNo2.woff2` | Austin News Ionic Roman No 2 | `Austin News Ionic No2` 400 | Card titles (h3) |
| `AustinNewsIonic-Light.woff2` | Austin News Ionic Light | `Austin News Ionic` 300 | Page titles (h1) |
| `AustinNewsIonic-Roman.woff2` | Austin News Ionic Roman | `Austin News Ionic` 400 | Standfirsts (project dek) |
| `AustinNewsIonic-Semibold.woff2` | Austin News Ionic Semibold | `Austin News Ionic` 600 | Home page title |
| `DoricNewsUI-UIRegular.woff2` | Doric News UI · UI Regular | `Doric News UI` 400 | Body and interface text |
| `DoricNewsUI-HedMedium.woff2` | Doric News UI · Hed Medium | `Doric News UI` 500 | Section headings (h2, 21/27), labels |
| `DoricNewsUI-UIBold.woff2` | Doric News UI · UI Bold | `Doric News UI` 700 | Uppercase labels |

Doric files are the official web fonts from `_Fonts/Doric/DEVELOPER STATIC FILES`. Austin is supplied only as
desktop OTF, so these files were converted to WOFF2 with fontTools. **Confirm that the Austin licence covers web
embedding before the site goes public.**

Roles follow the Telegraph Design System typography tokens (Deck for web display, Ionic for reading text, Doric for
UI). To add a weight, convert or copy the file here and add an `@font-face` in `src/styles/global.css`.
