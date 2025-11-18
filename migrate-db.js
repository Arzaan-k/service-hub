import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Client } = require('pg');

// Database connection strings
const sourceConfig = {
  connectionString: 'postgresql://neondb_owner:npg_Od1HJjgkwcM4@ep-square-scene-ad08b80l-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
};

const targetConfig = {
  connectionString: 'postgresql://neondb_owner:npg_O3naRCIxq1EK@ep-spring-boat-ahz5xl5s-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
};

async function migrateData() {
  const sourceClient = new Client(sourceConfig);
  const targetClient = new Client(targetConfig);

  try {
    console.log('Connecting to databases...');
    await sourceClient.connect();
    await targetClient.connect();

    console.log('Connected successfully!');

    // Get all tables from source database
    const tablesResult = await sourceClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`Found ${tables.length} tables:`, tables.join(', '));

    // Migrate each table
    for (const tableName of tables) {
      console.log(`\nMigrating table: ${tableName}`);

      try {
        // Get table structure
        const columnsResult = await sourceClient.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          ORDER BY ordinal_position;
        `, [tableName]);

        const columns = columnsResult.rows;

        // Create table in target database
        const createTableSQL = await generateCreateTableSQL(tableName, columns);
        console.log(`Creating table ${tableName}...`);

        try {
          await targetClient.query(createTableSQL);
          console.log(`✓ Table ${tableName} created`);
        } catch (error) {
          if (error.code === '42P07') { // table already exists
            console.log(`⚠ Table ${tableName} already exists, skipping creation`);
          } else {
            throw error;
          }
        }

        // Get data from source table
        const dataResult = await sourceClient.query(`SELECT * FROM "${tableName}"`);
        const rows = dataResult.rows;

        if (rows.length === 0) {
          console.log(`⚠ No data in table ${tableName}`);
          continue;
        }

        console.log(`Copying ${rows.length} rows from ${tableName}...`);

        // Insert data in batches to avoid memory issues
        const batchSize = 1000;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await insertBatch(targetClient, tableName, columns, batch);
          console.log(`✓ Inserted ${Math.min(i + batchSize, rows.length)}/${rows.length} rows`);
        }

        console.log(`✓ Completed migration for ${tableName} (${rows.length} rows)`);

      } catch (error) {
        console.error(`✗ Error migrating table ${tableName}:`, error.message);
        // Continue with other tables
      }
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

async function generateCreateTableSQL(tableName, columns) {
  const columnDefs = columns.map(col => {
    let def = `"${col.column_name}" ${col.data_type}`;

    if (col.data_type === 'character varying') {
      // Get max length for varchar
      def += '(255)'; // Default length
    }

    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }

    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }

    return def;
  }).join(',\n  ');

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs}\n);`;
}

async function insertBatch(client, tableName, columns, rows) {
  if (rows.length === 0) return;

  const columnNames = columns.map(col => `"${col.column_name}"`).join(', ');
  const placeholders = rows.map((_, rowIndex) =>
    `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
  ).join(', ');

  const values = rows.flatMap(row =>
    columns.map(col => row[col.column_name])
  );

  const sql = `INSERT INTO "${tableName}" (${columnNames}) VALUES ${placeholders}`;

  await client.query(sql, values);
}

// Run migration
migrateData().catch(console.error);
