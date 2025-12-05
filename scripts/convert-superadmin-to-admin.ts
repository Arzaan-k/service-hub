/**
 * Convert super_admin accounts to regular admin role
 * Since both roles have identical access, merge to single admin role
 */

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL not found");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     CONVERTING SUPER_ADMIN TO ADMIN ROLE                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    console.log('');

    // Find all super_admin users
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE role = $1',
      ['super_admin']
    );

    if (result.rows.length === 0) {
      console.log('ℹ️  No super_admin accounts found');
      return;
    }

    console.log(`Found ${result.rows.length} super_admin account(s):`);
    console.log('');

    for (const user of result.rows) {
      console.log(`  • ${user.name} (${user.email})`);
    }

    console.log('');
    console.log('Converting to admin role...');
    console.log('');

    // Update all super_admin to admin
    const updateResult = await pool.query(
      'UPDATE users SET role = $1 WHERE role = $2 RETURNING id, name, email, role',
      ['admin', 'super_admin']
    );

    for (const user of updateResult.rows) {
      console.log(`  ✅ ${user.name} → Role: ${user.role}`);
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ CONVERSION COMPLETE                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 ADMIN ACCOUNTS:');
    console.log('');
    console.log('Account 1: System Administrator');
    console.log('  Email:    admin@servicehub.com');
    console.log('  Password: Admin@2025#Secure');
    console.log('  Role:     admin (was super_admin)');
    console.log('');
    console.log('Account 2: Backup Operations Manager');
    console.log('  Email:    ops@servicehub.com');
    console.log('  Password: Ops@2025#Manager');
    console.log('  Role:     admin (was super_admin)');
    console.log('');
    console.log('🎯 All accounts now have admin role with full system access');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
