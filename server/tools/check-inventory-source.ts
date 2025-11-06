import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

async function main() {
  const url = process.env.INVENTORY_SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Neither INVENTORY_SOURCE_DATABASE_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  const srcTable = process.env.INVENTORY_SOURCE_TABLE;
  if (!srcTable) {
    console.error('INVENTORY_SOURCE_TABLE is not set in .env');
    process.exit(1);
  }

  const col = (name: string, dflt?: string) => process.env[name] || dflt || '';
  const COL_ID = col('INVENTORY_COL_ID');
  const COL_PN = col('INVENTORY_COL_PART_NUMBER');
  const COL_NAME = col('INVENTORY_COL_PART_NAME');
  const COL_CAT = col('INVENTORY_COL_CATEGORY');
  const COL_QTY = col('INVENTORY_COL_QTY');
  const COL_REO = col('INVENTORY_COL_REORDER');
  const COL_PRICE = col('INVENTORY_COL_PRICE');
  const COL_LOC = col('INVENTORY_COL_LOCATION');
  const COL_CREATED = col('INVENTORY_COL_CREATED_AT');
  const COL_UPDATED = col('INVENTORY_COL_UPDATED_AT');

  if (!COL_PN || !COL_NAME || !COL_CAT) {
    console.error('Missing required mapping: INVENTORY_COL_PART_NUMBER, INVENTORY_COL_PART_NAME, INVENTORY_COL_CATEGORY');
    process.exit(1);
  }

  const QTY_EXPR = COL_QTY ? `"${COL_QTY}"` : '0';
  const REO_EXPR = COL_REO ? `"${COL_REO}"` : '0';
  const PRICE_EXPR = COL_PRICE ? `"${COL_PRICE}"` : '0';
  const LOC_EXPR = COL_LOC ? `COALESCE("${COL_LOC}"::text, NULL)` : 'NULL';
  const CREATED_EXPR = COL_CREATED ? `COALESCE("${COL_CREATED}", NOW())` : 'NOW()';
  const UPDATED_EXPR = COL_UPDATED ? `COALESCE("${COL_UPDATED}", NOW())` : 'NOW()';

  const selectSql = `
    SELECT
      COALESCE(${COL_ID ? `"${COL_ID}"::text` : `"${COL_PN}"::text`}) AS id,
      COALESCE("${COL_PN}"::text, '') AS part_number,
      COALESCE("${COL_NAME}"::text, 'Unnamed Part') AS part_name,
      COALESCE("${COL_CAT}"::text, 'general') AS category,
      COALESCE(${QTY_EXPR}::int, 0) AS quantity_in_stock,
      COALESCE(${REO_EXPR}::int, 0) AS reorder_level,
      COALESCE(${PRICE_EXPR}::numeric, 0)::numeric(10,2) AS unit_price,
      ${LOC_EXPR} AS location,
      ${CREATED_EXPR} AS created_at,
      ${UPDATED_EXPR} AS updated_at
    FROM ${srcTable}
    ORDER BY 3
    LIMIT 10
  `;

  const pool = new Pool({ connectionString: url });
  try {
    console.log('Running test query with current mapping...');
    console.log('Source table:', srcTable);
    console.log('Select SQL (first lines):\n', selectSql.split('\n').slice(0, 8).join('\n'), '\n...');

    const res = await pool.query(`SELECT COUNT(*)::int AS c FROM ${srcTable}`);
    console.log('Row count in source table:', res.rows[0]?.c ?? 0);

    const sample = await pool.query(selectSql);
    console.log('Mapped sample rows (up to 10):');
    console.table(sample.rows);
  } catch (e: any) {
    console.error('Query failed:', e?.message || e);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
