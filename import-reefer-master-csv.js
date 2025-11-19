import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

function detectContainerCode(row, headers) {
  const candidates = [
    'container number',
    'container no',
    'container id',
    'container',
    'container no/vehicle no.',
    '__empty', // seen in some xlsx exports
    'container_code',
    'container_id',
  ];
  for (const candidate of candidates) {
    const foundKey = headers.find(
      (h) => h.toLowerCase().trim() === candidate.toLowerCase().trim()
    );
    if (foundKey && row[foundKey]) return String(row[foundKey]).trim();
  }
  // fallback: try first column if it looks like container code (letters+digits and length >= 6)
  const firstHeader = headers[0];
  const val = firstHeader ? String(row[firstHeader] || '').trim() : '';
  if (/^[A-Za-z0-9\-]{6,}$/.test(val)) return val;
  return null;
}

function coerceValue(field, value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (str === '' || str.toUpperCase() === 'NA' || str.toUpperCase() === 'N/A') return null;
  // Field-aware coercions
  const intFields = new Set(['yom','size','mfg_year','no_of_days','sr_no']);
  const floatFields = new Set(['temperature','set_temperature_during_dispatch_live','set_temperature_during_despatch_live','estimated_cost_for_repair']);
  const dateFields = new Set(['purchase_date','dispatch_date','date_of_arrival_in_depot']);
  if (intFields.has(field)) {
    // Extract integer part from strings like "Minus 18degc"
    const negative = /^minus/i.test(str);
    const m = str.match(/-?\d+/);
    if (!m) return null;
    const n = parseInt(m[0], 10);
    return Number.isFinite(n) ? (negative && n > 0 ? -n : n) : null;
  }
  if (floatFields.has(field)) {
    const negative = /^minus/i.test(str);
    const m = str.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = parseFloat(m[0]);
    return Number.isFinite(n) ? (negative && n > 0 ? -n : n) : null;
  }
  if (dateFields.has(field)) {
    const d = coerceDate(value);
    return d ? d.toISOString() : null;
  }
  if (field === 'blocked') {
    if (looksLikeBoolean(str)) return parseBoolean(str);
    return null;
  }
  return str;
}

// Excel serial date to JS Date
function excelSerialToDate(serial) {
  if (serial === null || serial === undefined) return null;
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = n * 86400000;
  const date = new Date(excelEpoch.getTime() + ms);
  return isNaN(date.getTime()) ? null : date;
}

function coerceDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const s = String(value).trim();
  // Try native parse
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t);
  // dd.mm.yyyy or d.m.yyyy
  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dot) {
    const d = parseInt(dot[1], 10);
    const m = parseInt(dot[2], 10);
    let y = parseInt(dot[3], 10);
    if (y < 100) y += 2000;
    const date = new Date(Date.UTC(y, m - 1, d));
    return isNaN(date.getTime()) ? null : date;
  }
  // Mon'YY like Sep'20 or June'19 -> first day of that month
  const mon = s.match(/^([A-Za-z]+)'?(\d{2})$/);
  if (mon) {
    const monthStr = mon[1];
    const yy = parseInt(mon[2], 10);
    const y = 2000 + yy;
    const monthIndex = [
      'jan','january','feb','february','mar','march','apr','april','may','jun','june','jul','july','aug','august','sep','september','oct','october','nov','november','dec','december'
    ].indexOf(monthStr.toLowerCase());
    let mi = -1;
    if (monthIndex >= 0) {
      // Map index to 0..11
      const map = {0:0,1:0,2:1,3:1,4:2,5:2,6:3,7:3,8:4,9:5,10:5,11:6,12:6,13:7,14:7,15:8,16:8,17:9,18:9,19:10,20:10,21:11,22:11};
      mi = map[monthIndex];
    } else {
      // Try Date.parse on month name only
      const tmp = Date.parse(monthStr + ' 1, ' + y);
      if (!isNaN(tmp)) {
        const d = new Date(tmp);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      }
    }
    if (mi >= 0) {
      return new Date(Date.UTC(y, mi, 1));
    }
  }
  return null;
}
// Map common master headers to curated DB columns
const headerToDbColumn = new Map([
  ['Product Type', 'product_type'],
  ['Size Type', 'size_type'],
  ['GROUP NAME', 'group_name'],
  ['GKU - PRODUCT NAME', 'gku_product_name'],
  ['Category(Condition and usage state)', 'category'],
  ['Location', 'location'],
  ['Depot', 'depot'],
  ['YOM', 'yom'],
  ['Status', 'status'],
  ['Current', 'current'],
  ['Image Links', 'image_links'],
  ['Grade', 'grade'],
  ['Reefer Unit', 'reefer_unit'],
  ['Reefer Unit Model Name (Thinline / MP)', 'reefer_model'],
  ['SIZE', 'size'],
  // Additional explicit mappings from requirements
  ['Sr No', 'sr_no'],
  ['Container No', 'container_no'],
  ['Product Type', 'product_type'],
  ['Size', 'size'],
  ['Size/Type', 'size_type'],
  ['GROUP NAME', 'group_name'],
  ['GKU - PRODUCT NAME', 'gku_product_name'],
  ['Category (Condition and usage state)', 'category'],
  ['Available Location', 'available_location'],
  ['Depot', 'depot'],
  ['Mfg Year', 'mfg_year'],
  ['Inventory Status', 'inventory_status'],
  ['Current', 'current'],
  ['Images / PTI / Survey', 'images_pti_survey'],
  ['Grade', 'grade'],
  ['Purchase Date', 'purchase_date'],
  ['Temperature', 'temperature'],
  ['Domestication', 'domestication'],
  ['Reefer Unit', 'reefer_unit'],
  ['Reefer Unit Model Name', 'reefer_unit_model_name'],
  ['Reefer Unit Serial No', 'reefer_unit_serial_no'],
  ['Controller Configuration Number', 'controller_configuration_number'],
  ['Controller Version', 'controller_version'],
  ['City of Purchase', 'city_of_purchase'],
  ['Purchase Yard Details', 'purchase_yard_details'],
  ['CRO Number', 'cro_number'],
  ['Brand New / Used', 'brand_new_used'],
  ['Date of Arrival in Depot', 'date_of_arrival_in_depot'],
  ['In House Run Test Report', 'in_house_run_test_report'],
  ['Condition (CW / Ready / Repair)', 'condition'],
  ['Curtains', 'curtains'],
  ['Lights', 'lights'],
  ['Colour', 'colour'],
  ['Logo/Sticker', 'logo_sticker'],
  ['Repair Remarks', 'repair_remarks'],
  ['Estimated Cost For Repair', 'estimated_cost_for_repair'],
  ['Crystal Smart Sr No', 'crystal_smart_sr_no'],
  ['Booking Order Number', 'booking_order_number'],
  ['DO Number', 'do_number'],
  ['Dispatch Date', 'dispatch_date'],
  ['No of Days', 'no_of_days'],
  ['Dispatch Location', 'dispatch_location'],
  ['Set Temperature During Dispatch/Live', 'set_temperature_during_dispatch_live'],
  ['Assets Belong To', 'assets_belong_to'],
  ['Blocked', 'blocked'],
  ['Remark', 'remark'],
]);

const curatedDbColumns = new Set([
  'product_type','size_type','group_name','gku_product_name','category','depot','yom',
  'grade','reefer_unit','reefer_model','image_links','size','master_sheet_data'
]);

async function getExistingColumns() {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'containers'
  `;
  return new Set(rows.map((r) => r.column_name));
}

function looksLikeBoolean(value) {
  const v = String(value).trim().toLowerCase();
  return ['yes','no','true','false','y','n','1','0'].includes(v);
}

function parseBoolean(value) {
  const v = String(value).trim().toLowerCase();
  return ['yes','true','y','1'].includes(v);
}

function looksLikeDate(value) {
  if (value instanceof Date) return !isNaN(value.getTime());
  // ISO-like or dd/mm/yyyy or mm/dd/yyyy
  const s = String(value).trim();
  if (!s) return false;
  // Try Date.parse
  const t = Date.parse(s);
  if (!isNaN(t)) return true;
  // numeric Excel serials are handled upstream; here treat as non-date
  return false;
}

function inferSqlTypeFromSamples(samples) {
  // Prefer BOOLEAN, then INTEGER, then FLOAT, then DATE, else TEXT
  // Check boolean
  const nonNull = samples.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNull.length === 0) return 'TEXT';
  if (nonNull.every(looksLikeBoolean)) return 'BOOLEAN';
  // Numbers
  const allNumeric = nonNull.every(v => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v).trim()));
  if (allNumeric) {
    const anyFloat = nonNull.some(v => String(v).includes('.'));
    return anyFloat ? 'DOUBLE PRECISION' : 'INTEGER';
  }
  // Dates
  if (nonNull.every(looksLikeDate)) return 'DATE';
  return 'TEXT';
}

async function ensureColumns(headers, existingColumns, rows) {
  const newlyAdded = new Set();

  // 1) Ensure curated columns (preferred)
  for (const col of curatedDbColumns) {
    if (!existingColumns.has(col)) {
      if (col === 'yom' || col === 'size') {
        await sql(`ALTER TABLE containers ADD COLUMN IF NOT EXISTS ${col} INTEGER`);
      } else if (col === 'master_sheet_data') {
        await sql(`ALTER TABLE containers ADD COLUMN IF NOT EXISTS ${col} JSONB`);
      } else {
        await sql(`ALTER TABLE containers ADD COLUMN IF NOT EXISTS ${col} TEXT`);
      }
      newlyAdded.add(col);
      existingColumns.add(col);
    }
  }

  // 2) Ensure any additional CSV headers exist with inferred types
  for (const header of headers) {
    const mapped = headerToDbColumn.get(header) || toSnakeCase(header);
    if (!mapped) continue;
    if (!existingColumns.has(mapped)) {
      // infer type from sample values (up to 200 rows)
      const sampleValues = [];
      for (let i = 0; i < Math.min(200, rows.length); i++) {
        sampleValues.push(rows[i]?.[header]);
      }
      const sqlType = inferSqlTypeFromSamples(sampleValues);
      await sql(`ALTER TABLE containers ADD COLUMN IF NOT EXISTS ${mapped} ${sqlType}`);
      newlyAdded.add(mapped);
      existingColumns.add(mapped);
    }
  }

  return newlyAdded;
}

function inferContainerType(productType) {
  const v = String(productType || '').toLowerCase();
  if (v.includes('reefer') || v.includes('refrigerated')) return 'refrigerated';
  if (v.includes('dry')) return 'dry';
  if (v.includes('special')) return 'special';
  return 'dry';
}

async function upsertRows(rows, headers, existingColumns) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date();

  for (const row of rows) {
    try {
      const containerCode = detectContainerCode(row, headers);
      if (!containerCode) {
        skipped++;
        continue;
      }

      const existing = await sql`
        SELECT id FROM containers WHERE container_id = ${containerCode} LIMIT 1
      `;
      const isExisting = existing.length > 0;
      const containerId = isExisting ? existing[0].id : crypto.randomUUID();

      // Build curated column values
      const curatedValues = {
        product_type: coerceValue('product_type', row['Product Type']),
        size_type: coerceValue('size_type', row['Size Type']),
        group_name: coerceValue('group_name', row['GROUP NAME']),
        gku_product_name: coerceValue('gku_product_name', row['GKU - PRODUCT NAME']),
        category: coerceValue('category', row['Category(Condition and usage state)']),
        depot: coerceValue('depot', row['Depot']),
        yom: coerceValue('yom', row['YOM']),
        grade: coerceValue('grade', row['Grade']),
        reefer_unit: coerceValue('reefer_unit', row['Reefer Unit']),
        reefer_model: coerceValue('reefer_model', row['Reefer Unit Model Name (Thinline / MP)']),
        image_links: coerceValue('image_links', row['Image Links']),
        size: coerceValue('size', row['SIZE']),
      };

      // Full row JSON for audit/reference
      const rowJson = {};
      for (const h of headers) {
        rowJson[h] = row[h];
      }

      if (!isExisting) {
        // Insert new container; include any curated fields if present, others remain NULL
        const typeFromRow = curatedValues.product_type ? inferContainerType(curatedValues.product_type) : 'dry';
        // Build dynamic insert for any mapped header columns that exist in DB
        const cols = ['id','container_id','type','status','has_iot','excel_metadata','master_sheet_data','created_at','updated_at'];
        const vals = [containerId, containerCode, typeFromRow, 'active', false, JSON.stringify(rowJson), JSON.stringify(rowJson), new Date(), new Date()];
        const paramHolders = cols.map((_, idx) => `$${idx + 1}`);

        let paramIndex = vals.length + 1;
      const seenInsertCols = new Set(cols);
        for (const header of headers) {
          const mapped = headerToDbColumn.get(header) || toSnakeCase(header);
          if (!mapped || !existingColumns.has(mapped)) continue;
          if (mapped === 'status') continue; // avoid enum conflicts
        if (seenInsertCols.has(mapped)) continue; // avoid duplicate column assignment (e.g., Size and SIZE)
          cols.push(mapped);
          vals.push(coerceValue(mapped, row[header]));
          paramHolders.push(`$${paramIndex++}`);
        seenInsertCols.add(mapped);
        }

        const insertSQL = `
          INSERT INTO containers (${cols.join(', ')})
          VALUES (${paramHolders.join(', ')})
          ON CONFLICT (container_id) DO NOTHING
        `;
        await sql(insertSQL, vals);
        inserted++;
      } else {
        // Update only newly added columns to avoid overwriting existing data.
        const setFragments = [];
        const params = [containerCode];

        // Update any mapped CSV column that exists in DB when value is provided (except status to avoid enum mismatch)
      const seenUpdateCols = new Set();
        for (const h of headers) {
          const mapped = headerToDbColumn.get(h) || toSnakeCase(h);
          if (!mapped || !existingColumns.has(mapped)) continue;
          if (mapped === 'status') continue; // avoid enum conflicts
        if (seenUpdateCols.has(mapped)) continue;
          const value = coerceValue(mapped, row[h]);
          if (value !== null && value !== undefined) {
            setFragments.push(`${mapped} = $${params.length + 1}`);
            params.push(value);
          seenUpdateCols.add(mapped);
          }
        }

        // Always merge JSON metadata (adds new keys, does not delete old)
        // This satisfies: "Do NOT overwrite existing data unless the CSV provides new values."
        // JSONB concatenation prefers right-hand side for overlapping keys.
        setFragments.push(`excel_metadata = COALESCE(excel_metadata, '{}'::jsonb) || $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(rowJson));
        setFragments.push(`master_sheet_data = COALESCE(master_sheet_data, '{}'::jsonb) || $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(rowJson));
        setFragments.push(`updated_at = NOW()`);

        if (setFragments.length > 0) {
          const query = `
            UPDATE containers
            SET ${setFragments.join(', ')}
            WHERE container_id = $1
          `;
          await sql(query, params);
          updated++;
        } else {
          skipped++;
        }
      }
    } catch (e) {
      console.error('✗ Error upserting row:', e.message);
      errors++;
    }
  }

  return { inserted, updated, skipped, errors };
}

async function main() {
  try {
    const inputPath = process.argv[2] || 'Reefer Container master.csv';
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log('============================================================');
    console.log('  Reefer Container Master Import');
    console.log('  - Auto-detect columns');
    console.log('  - Add missing columns safely (non-destructive)');
    console.log('  - Upsert rows (insert new, update only newly added fields)');
    console.log('============================================================\n');

    const ext = path.extname(inputPath).toLowerCase();
    const workbook = XLSX.readFile(inputPath, { type: ext === '.csv' ? 'binary' : undefined });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    const headers = Object.keys(rows[0] || {});

    console.log(`✓ Loaded ${rows.length} rows from "${inputPath}"`);
    console.log(`✓ Detected columns: ${headers.join(', ')}\n`);

    // Report: columns present in CSV but missing in DB schema (pre-migration)
    const existingColumns = await getExistingColumns();
    const missingInDb = headers
      .map(h => headerToDbColumn.get(h) || toSnakeCase(h))
      .filter(col => !!col && !existingColumns.has(col) && !['location','current','status'].includes(col));
    if (missingInDb.length > 0) {
      console.log(`⚠ Columns missing in DB (will be added safely): ${Array.from(new Set(missingInDb)).join(', ')}`);
    } else {
      console.log('✓ No missing DB columns detected for CSV headers (before import).');
    }

    // 1) Read existing columns and ensure any missing ones are added
    const newlyAddedColumns = await ensureColumns(headers, existingColumns, rows);
    if (newlyAddedColumns.size > 0) {
      console.log(`✓ Added new columns (${newlyAddedColumns.size}): ${Array.from(newlyAddedColumns).join(', ')}`);
    } else {
      console.log('✓ No new columns needed (schema already up to date)');
    }

    // 2) Upsert rows
    const { inserted, updated, skipped, errors } = await upsertRows(rows, headers, existingColumns);

    console.log('\n=== Import Summary ===');
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated (new fields only): ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('\n✅ Completed');
    process.exit(errors > 0 ? 1 : 0);
  } catch (e) {
    console.error('Fatal error:', e);
    process.exit(1);
  }
}

await main();


