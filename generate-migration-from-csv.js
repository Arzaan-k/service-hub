import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

dotenv.config();

function toSnakeCase(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[\s\/\-\.]+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

// Headers we intentionally DO NOT add as separate columns because they live in JSON
const skipAsColumns = new Set(['location', 'current', 'status']);

// Curated numeric columns
const integerColumns = new Set(['yom', 'size']);

// Already covered curated text columns
const curatedTextColumns = new Set([
  'product_type','size_type','group_name','gku_product_name','category','depot','grade','reefer_unit','reefer_model','image_links'
]);

function readHeadersFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const workbook = XLSX.readFile(filePath, { type: ext === '.csv' ? 'binary' : undefined });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  const headers = Object.keys(rows[0] || {});
  return headers;
}

function buildMigrationSQL(headers, fileLabel) {
  const statements = [];
  statements.push(`-- Auto-generated non-destructive migration for CSV headers (${fileLabel})`);
  statements.push(`-- Adds any missing columns to containers table using safe defaults (NULL).`);

  const mappedColumns = new Set();
  for (const h of headers) {
    const mapped = toSnakeCase(h);
    if (!mapped || skipAsColumns.has(mapped)) continue;
    if (mappedColumns.has(mapped)) continue;
    mappedColumns.add(mapped);

    // Prefer curated columns if already defined by separate migrations/schema
    if (curatedTextColumns.has(mapped)) {
      statements.push(`-- Ensured elsewhere (curated): ${mapped}`);
      continue;
    }

    if (integerColumns.has(mapped)) {
      statements.push(`ALTER TABLE containers ADD COLUMN IF NOT EXISTS ${mapped} INTEGER;`);
    } else {
      statements.push(`ALTER TABLE containers ADD COLUMN IF NOT EXISTS ${mapped} TEXT;`);
    }
  }

  if (statements.length === 2) {
    statements.push(`-- No new columns detected. Schema already in sync with CSV headers.`);
  }

  return statements.join('\n');
}

async function main() {
  try {
    const inputPath = process.argv[2] || 'Reefer Container master.csv';
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }
    const headers = readHeadersFromFile(inputPath);
    console.log(`Detected headers (${headers.length}):`, headers.join(', '));

    const fileLabel = path.basename(inputPath);
    const sql = buildMigrationSQL(headers, fileLabel);
    const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const outFile = path.join('migrations', `${stamp}_csv_headers_additions.sql`);
    fs.writeFileSync(outFile, sql, 'utf8');
    console.log(`\n✓ Migration written to ${outFile}`);
    console.log(`\nNote: This migration is additive-only and safe to run multiple times.`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to generate migration:', e);
    process.exit(1);
  }
}

await main();


