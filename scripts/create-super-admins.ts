/**
 * Create Two Super Admin Accounts
 *
 * Account 1: System Administrator
 *   Role:     SUPER_ADMIN
 *   Email:    admin@servicehub.com
 *   Password: Admin@2025#Secure
 *
 * Account 2: Backup Operations Manager
 *   Role:     SUPER_ADMIN
 *   Email:    ops@servicehub.com
 *   Password: Ops@2025#Manager
 *
 * SUPER_ADMIN Features:
 * - Full access to all system features
 * - Cannot see client/customer details (privacy protection)
 * - Can manage users, technicians, containers, alerts, service requests
 * - Can access analytics, scheduling, inventory
 * - No access to /clients or /customers pages
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createSuperAdmin(
  name: string,
  email: string,
  password: string,
  phoneNumber: string
) {
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone_number = $2',
      [email, phoneNumber]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User already exists: ${email}`);
      console.log(`   ID: ${existingUser.rows[0].id}`);
      console.log(`   Role: ${existingUser.rows[0].role}`);

      // Update to super_admin if not already
      if (existingUser.rows[0].role !== 'super_admin') {
        await pool.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['super_admin', existingUser.rows[0].id]
        );
        console.log(`   ✅ Updated role to super_admin`);
      }

      return existingUser.rows[0];
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (
        phone_number,
        name,
        email,
        password,
        role,
        is_active,
        whatsapp_verified,
        email_verified,
        requires_password_reset
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        phoneNumber,
        name,
        email,
        hashedPassword,
        'super_admin',
        true,
        false,
        true,
        false // Don't require password reset for these specific accounts
      ]
    );

    console.log(`✅ Created super admin: ${email}`);
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Name: ${result.rows[0].name}`);

    return result.rows[0];
  } catch (error) {
    console.error(`❌ Failed to create super admin ${email}:`, error);
    throw error;
  }
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           CREATING SUPER ADMIN ACCOUNTS                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    console.log('');

    // Account 1: System Administrator
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Account 1: System Administrator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const admin1 = await createSuperAdmin(
      'System Administrator',
      'admin@servicehub.com',
      'Admin@2025#Secure',
      '+91-1000000001' // Unique phone number
    );
    console.log('');

    // Account 2: Backup Operations Manager
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Account 2: Backup Operations Manager');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const admin2 = await createSuperAdmin(
      'Backup Operations Manager',
      'ops@servicehub.com',
      'Ops@2025#Manager',
      '+91-1000000002' // Unique phone number
    );
    console.log('');

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ SUCCESS                                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 SUPER ADMIN ACCOUNTS CREATED');
    console.log('');
    console.log('Account 1: System Administrator');
    console.log('  Email:    admin@servicehub.com');
    console.log('  Password: Admin@2025#Secure');
    console.log('  Role:     super_admin');
    console.log('');
    console.log('Account 2: Backup Operations Manager');
    console.log('  Email:    ops@servicehub.com');
    console.log('  Password: Ops@2025#Manager');
    console.log('  Role:     super_admin');
    console.log('');
    console.log('🔒 SUPER_ADMIN RESTRICTIONS:');
    console.log('  ✅ Full access to all system features');
    console.log('  ✅ User management, technicians, containers');
    console.log('  ✅ Alerts, service requests, scheduling');
    console.log('  ✅ Analytics, inventory, WhatsApp admin');
    console.log('  ❌ NO ACCESS to client/customer data (privacy protection)');
    console.log('  ❌ Cannot view /clients or /customers pages');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('  1. Login at http://localhost:5000/login');
    console.log('  2. Use the credentials above');
    console.log('  3. Verify client menu is hidden in sidebar');
    console.log('  4. Test that client data cannot be accessed');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
