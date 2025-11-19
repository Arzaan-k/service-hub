import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Please configure your .env file.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

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

// Map common master headers to curated DB columns
const headerToDbColumn = new Map([
  ['Product Type', 'product_type'],
  ['Size Type', 'size_type'],
  ['GROUP NAME', 'group_name'],
  ['GKU - PRODUCT NAME', 'gku_product_name'],
  ['Category(Condition and usage state)', 'category'],
  ['Location', 'location'], // kept in JSON metadata
  ['Depot', 'depot'],
  ['YOM', 'yom'],
  ['Status', 'status'], // existing enum column; we do not forcibly overwrite
  ['Current', 'current'], // JSON metadata
  ['Image Links', 'image_links'],
  ['Grade', 'grade'],
  ['Reefer Unit', 'reefer_unit'],
  ['Reefer Unit Model Name (Thinline / MP)', 'reefer_model'],
  ['SIZE', 'size'],
]);

const skipAsColumns = new Set(['location', 'current', 'status']);
const curatedColumns = new Set([
  'product_type','size_type','group_name','gku_product_name','category',
  'depot','yom','grade','reefer_unit','reefer_model','image_links','size',
  'master_sheet_data','excel_metadata'
]);
const integerColumns = new Set(['yom','size']);

async function getDbColumns(table = 'containers') {
  const rows = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;
  return rows.map(r => ({ name: r.column_name, type: r.data_type }));
}

function readHeaders(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const workbook = XLSX.readFile(filePath, { type: ext === '.csv' ? 'binary' : undefined });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  const headers = Object.keys(rows[0] || {});
  return { headers, sheetName };
}

function compare(headers, dbColumns) {
  const dbSet = new Set(dbColumns.map(c => c.name));
  const mapping = [];
  const present = [];
  const missing = [];
  const skipped = [];

  for (const h of headers) {
    const mapped = headerToDbColumn.get(h) || toSnakeCase(h);
    const status = skipAsColumns.has(mapped)
      ? 'kept_in_json'
      : dbSet.has(mapped)
        ? 'exists_in_db'
        : 'missing_in_db';

    mapping.push({ header: h, mappedColumn: mapped, status });
    if (status === 'exists_in_db') present.push(h);
    if (status === 'missing_in_db') missing.push(h);
    if (status === 'kept_in_json') skipped.push(h);
  }

  return { mapping, present, missing, skipped };
}

async function main() {
  try {
    const inputPath = process.argv[2] || 'Reefer Container master.csv';
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    const { headers, sheetName } = readHeaders(inputPath);
    const dbColumns = await getDbColumns('containers');
    const { mapping, present, missing, skipped } = compare(headers, dbColumns);

    console.log('=== Reefer Container Master Column Report ===\n');
    console.log(`File       : ${inputPath}`);
    console.log(`Sheet      : ${sheetName}`);
    console.log(`DB Table   : containers\n`);

    console.log('Current DB columns (containers):');
    console.log(dbColumns.map(c => `- ${c.name} (${c.type})`).join('\n'));
    console.log('');

    console.log('Header → DB Column Mapping:');
    for (const m of mapping) {
      console.log(`- "${m.header}" -> ${m.mappedColumn} [${m.status}]`);
    }

    console.log('\nSummary:');
    console.log(`- CSV headers: ${headers.length}`);
    console.log(`- Present in DB: ${present.length}`);
    console.log(`- Missing in DB (eligible to add): ${missing.length}`);
    console.log(`- Kept in JSON only (not separate columns): ${skipped.length}`);

    // Also emit a JSON report file for reference
    const out = {
      file: inputPath,
      sheet: sheetName,
      table: 'containers',
      dbColumns,
      mapping,
      presentHeaders: present,
      missingHeaders: missing,
      skippedHeaders: skipped,
      curatedColumns: Array.from(curatedColumns),
      integerColumns: Array.from(integerColumns),
    };
    const outFile = 'reefer_master_column_report.json';
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
    console.log(`\n✓ JSON report written to ${outFile}`);
  } catch (e) {
    console.error('Report failed:', e);
    process.exit(1);
  }
}

await main();


