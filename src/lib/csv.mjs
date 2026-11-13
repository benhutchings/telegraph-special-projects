// Minimal RFC 4180 CSV parser (handles quoted fields, embedded commas,
// escaped quotes and newlines inside quotes). Shared by the site and scripts.
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  text = text.replace(/^﻿/, '');

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])),
  );
}
