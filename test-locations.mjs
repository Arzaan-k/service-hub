// Test script to verify technician location data fetching
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_ls7YTgzeoNA4@ep-young-grass-aewvokzj-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
    ssl: true,
});

async function testLocationFetch() {
    try {
        console.log('🔍 Testing connection to Service Hub database...');

        const result = await pool.query(`
      SELECT DISTINCT ON (l.employee_id)
          e.first_name,
          e.last_name,
          e.email,
          l.employee_id,
          l.latitude,
          l.longitude,
          l.heading,
          l.speed,
          l.battery_level,
          l.timestamp as last_seen
      FROM location_logs l
      JOIN employees e ON l.employee_id = e.employee_id
      WHERE l.timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY l.employee_id, l.timestamp DESC;
    `);

        console.log(`✅ Successfully fetched ${result.rows.length} technician locations`);

        if (result.rows.length > 0) {
            console.log('\n📍 Sample location data:');
            console.log(JSON.stringify(result.rows[0], null, 2));

            console.log('\n👥 All technicians:');
            result.rows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.first_name} ${row.last_name} - Lat: ${row.latitude}, Lng: ${row.longitude}`);
            });
        } else {
            console.log('⚠️ No location data found in the last 24 hours');

            // Check if tables exist
            console.log('\n🔍 Checking if tables exist...');
            const tablesCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('location_logs', 'employees')
        ORDER BY table_name;
      `);
            console.log('Tables found:', tablesCheck.rows);

            // Check total records in location_logs
            const countCheck = await pool.query(`SELECT COUNT(*) as total FROM location_logs`);
            console.log(`Total records in location_logs: ${countCheck.rows[0].total}`);

            // Check recent records (last 7 days)
            const recentCheck = await pool.query(`
        SELECT COUNT(*) as total 
        FROM location_logs 
        WHERE timestamp > NOW() - INTERVAL '7 days'
      `);
            console.log(`Records in last 7 days: ${recentCheck.rows[0].total}`);
        }

        await pool.end();
        console.log('\n✅ Test completed successfully');
    } catch (error) {
        console.error('❌ Error:', error);
        await pool.end();
        process.exit(1);
    }
}

testLocationFetch();
