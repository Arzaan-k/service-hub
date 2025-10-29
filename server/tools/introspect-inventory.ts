import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

async function main() {
  const url = process.env.INVENTORY_SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Neither INVENTORY_SOURCE_DATABASE_URL nor DATABASE_URL is set. Please add one to your .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    console.log('Connected. Listing non-system tables with estimated row counts...');
    const tables = await pool.query(
      `select n.nspname as table_schema,
              c.relname as table_name,
              coalesce(c.reltuples,0)::bigint as est_rows
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'r'
         and n.nspname not in ('pg_catalog','information_schema')
       order by n.nspname, c.relname`
    );
    console.table(tables.rows);

    const likeNames = ['%product%', '%inventory%', '%item%', '%stock%', '%catalog%'];
    for (const pattern of likeNames) {
      console.log(`\nColumns for tables with name like ${pattern}`);
      const cols = await pool.query(
        `select table_schema, table_name, column_name, data_type
         from information_schema.columns
         where table_name ilike $1
         order by table_schema, table_name, ordinal_position`,
        [pattern]
      );
      if (cols.rows.length) console.table(cols.rows);
    }

    const candidates = ['products','product','items','inventory','stock','catalog','sku','spares'];
    for (const name of candidates) {
      try {
        const sample = await pool.query(`select * from ${name} limit 3`);
        console.log(`\nSample rows from ${name}:`);
        console.table(sample.rows);
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error('Introspection error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
