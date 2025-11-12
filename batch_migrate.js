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

// Tables to migrate in priority order (smaller tables first)
const priorityTables = [
  'users', 'roles', 'permissions', 'user_roles', 'user_permissions',
  'service_categories', 'service_types',
  'customers', 'customer_contacts',
  'technicians', 'technician_skills', 'technician_availability',
  'containers', 'container_types', 'container_status_history',
  'service_requests', 'service_request_items', 'service_request_status_history',
  'feedback', 'feedback_responses',
  'notifications', 'notification_recipients',
  'reports', 'report_schedules'
];

async function migrateDataInBatches() {
  const sourceClient = new Client(sourceConfig);
  const targetClient = new Client(targetConfig);

  try {
    console.log('Connecting to databases...');
    await sourceClient.connect();
    await targetClient.connect();
    console.log('Connected successfully!');

    // Get all tables if priority list is not complete
    const allTablesResult = await sourceClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('${priorityTables.join("','")}')
      ORDER BY table_name;
    `);

    const remainingTables = allTablesResult.rows.map(row => row.table_name);
    const allTablesToMigrate = [...priorityTables, ...remainingTables];

    console.log(`Planning to migrate ${allTablesToMigrate.length} tables`);

    // Migrate each table in small batches
    for (const tableName of allTablesToMigrate) {
      console.log(`\nMigrating table: ${tableName}`);

      try {
        // Check if table exists in target
        const targetTableExists = await targetClient.query(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          );
        `, [tableName]);

        if (!targetTableExists.rows[0].exists) {
          console.log(`⚠ Table ${tableName} does not exist in target database, skipping`);
          continue;
        }

        // Get total count from source
        const countResult = await sourceClient.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
        const totalRows = parseInt(countResult.rows[0].total);

        if (totalRows === 0) {
          console.log(`⚠ No data in table ${tableName}`);
          continue;
        }

        console.log(`Found ${totalRows} rows in ${tableName}`);

        // Migrate in small batches to avoid quota issues
        const batchSize = 100; // Very small batches
        let migrated = 0;

        while (migrated < totalRows) {
          const limit = Math.min(batchSize, totalRows - migrated);

          // Get batch of data
          const dataResult = await sourceClient.query(
            `SELECT * FROM "${tableName}" ORDER BY (SELECT NULL) LIMIT $1 OFFSET $2`,
            [limit, migrated]
          );

          if (dataResult.rows.length === 0) break;

          // Insert batch into target
          await insertBatch(targetClient, tableName, dataResult.rows);

          migrated += dataResult.rows.length;
          console.log(`✓ Migrated ${migrated}/${totalRows} rows from ${tableName}`);

          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✓ Completed migration for ${tableName} (${totalRows} rows)`);

      } catch (error) {
        console.error(`✗ Error migrating table ${tableName}:`, error.message);
        // Continue with other tables
      }
    }

    console.log('\n🎉 Batch migration completed!');

    // Final verification
    console.log('\nVerifying migration...');
    for (const tableName of allTablesToMigrate.slice(0, 5)) { // Check first 5 tables
      try {
        const sourceCount = await sourceClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const targetCount = await targetClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);

        console.log(`${tableName}: Source=${sourceCount.rows[0].count}, Target=${targetCount.rows[0].count}`);
      } catch (error) {
        console.log(`${tableName}: Error checking counts - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

async function insertBatch(client, tableName, rows) {
  if (rows.length === 0) return;

  // Get column names from first row
  const columns = Object.keys(rows[0]);
  const columnNames = columns.map(col => `"${col}"`).join(', ');

  // Create placeholders for each row
  const valuePlaceholders = rows.map((_, rowIndex) => {
    const placeholders = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
    return `(${placeholders.join(', ')})`;
  }).join(', ');

  // Flatten all values
  const values = rows.flatMap(row => columns.map(col => row[col]));

  const sql = `INSERT INTO "${tableName}" (${columnNames}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`;

  await client.query(sql, values);
}

// Run migration
migrateDataInBatches().catch(console.error);
