import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function listAndDeleteAdmins() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔍 Checking admin users in database...\n');

    // Get all admin users
    const adminResult = await client.query('SELECT id, email, name, role FROM users WHERE role = $1', ['admin']);
    console.log(`Found ${adminResult.rows.length} admin users:`);

    for (const user of adminResult.rows) {
      console.log(`- ${user.email} (${user.name}) - ID: ${user.id}`);
    }

    if (adminResult.rows.length === 0) {
      console.log('No admin users found.');
      return;
    }

    console.log('\n🗑️ Deleting all admin users and related data...\n');

    // Get admin user IDs
    const adminIds = adminResult.rows.map(user => user.id);
    console.log(`Admin user IDs: ${adminIds.join(', ')}`);

    // Delete related technicians first (depends on users)
    console.log('Deleting technicians...');
    const technicianDeleteResult = await client.query('DELETE FROM technicians WHERE user_id = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${technicianDeleteResult.rowCount} technician records`);

    // Delete related customers (depends on users)
    console.log('Deleting customers...');
    const customerDeleteResult = await client.query('DELETE FROM customers WHERE user_id = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${customerDeleteResult.rowCount} customer records`);

    // Delete invoices that reference service requests created by admin users
    console.log('Deleting invoices related to admin-created service requests...');
    const invoiceDeleteResult = await client.query(`
      DELETE FROM invoices
      WHERE service_request_id IN (
        SELECT id FROM service_requests WHERE created_by = ANY($1)
      )
    `, [adminIds]);
    console.log(`✅ Deleted ${invoiceDeleteResult.rowCount} invoice records`);

    // Delete service requests created by admin users
    console.log('Deleting service requests created by admins...');
    const serviceRequestDeleteResult = await client.query('DELETE FROM service_requests WHERE created_by = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${serviceRequestDeleteResult.rowCount} service request records`);

    // Delete related whatsapp messages first (depends on whatsapp_sessions)
    console.log('Deleting whatsapp messages...');
    const whatsappMsgDeleteResult = await client.query('DELETE FROM whatsapp_messages WHERE recipient_id = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${whatsappMsgDeleteResult.rowCount} whatsapp message records`);

    // Delete related whatsapp sessions
    console.log('Deleting whatsapp sessions...');
    const whatsappDeleteResult = await client.query('DELETE FROM whatsapp_sessions WHERE user_id = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${whatsappDeleteResult.rowCount} whatsapp session records`);

    // Delete related email verifications
    console.log('Deleting email verifications...');
    const emailDeleteResult = await client.query('DELETE FROM email_verifications WHERE user_id = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${emailDeleteResult.rowCount} email verification records`);

    // Delete alerts acknowledged by admin users
    console.log('Deleting alerts acknowledged by admins...');
    const alertDeleteResult = await client.query('DELETE FROM alerts WHERE acknowledged_by = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${alertDeleteResult.rowCount} alert records`);

    // Delete related audit logs
    console.log('Deleting audit logs...');
    const auditDeleteResult = await client.query('DELETE FROM audit_logs WHERE user_id = ANY($1)', [adminIds]);
    console.log(`✅ Deleted ${auditDeleteResult.rowCount} audit log records`);

    // Now delete admin users
    console.log('Deleting admin users...');
    const deleteResult = await client.query('DELETE FROM users WHERE role = $1', ['admin']);
    console.log(`✅ Deleted ${deleteResult.rowCount} admin users`);

    // Check if any admin users remain
    const remainingResult = await client.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['admin']);
    console.log(`📊 Admin users remaining: ${remainingResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

listAndDeleteAdmins();
