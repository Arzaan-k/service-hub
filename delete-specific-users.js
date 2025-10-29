import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteSpecificUsers() {
  let client;
  try {
    client = await pool.connect();

    // Users to delete:
    // 1. Two users with email arzaanalikhan12@gmail.com
    // 2. One user with phone 7021307474

    // Get user IDs to delete
    const usersToDelete = [];

    // Find users by email
    const emailResult = await client.query('SELECT id, email, name, phone_number, role FROM users WHERE email = $1', ['arzaanalikhan12@gmail.com']);
    emailResult.rows.forEach(user => {
      usersToDelete.push({ id: user.id, email: user.email, phone: user.phone_number, reason: 'email match' });
    });

    // Find user by phone
    const phoneResult = await client.query('SELECT id, email, name, phone_number, role FROM users WHERE phone_number = $1', ['7021307474']);
    phoneResult.rows.forEach(user => {
      usersToDelete.push({ id: user.id, email: user.email, phone: user.phone_number, reason: 'phone match' });
    });

    console.log('🗑️ Users to delete:');
    usersToDelete.forEach(user => {
      console.log(`  - ${user.email} (${user.phone}) - ID: ${user.id} - Reason: ${user.reason}`);
    });

    if (usersToDelete.length === 0) {
      console.log('No users found to delete.');
      return;
    }

    const userIds = usersToDelete.map(u => u.id);
    console.log(`\nUser IDs: ${userIds.join(', ')}`);

    // Delete related data in the correct order (to handle foreign key constraints)

    // 1. WhatsApp messages (depends on whatsapp_sessions)
    console.log('Deleting whatsapp messages...');
    const whatsappMsgDeleteResult = await client.query('DELETE FROM whatsapp_messages WHERE recipient_id = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${whatsappMsgDeleteResult.rowCount} whatsapp message records`);

    // 2. WhatsApp sessions
    console.log('Deleting whatsapp sessions...');
    const whatsappDeleteResult = await client.query('DELETE FROM whatsapp_sessions WHERE user_id = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${whatsappDeleteResult.rowCount} whatsapp session records`);

    // 3. Email verifications
    console.log('Deleting email verifications...');
    const emailDeleteResult = await client.query('DELETE FROM email_verifications WHERE user_id = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${emailDeleteResult.rowCount} email verification records`);

    // 4. Audit logs
    console.log('Deleting audit logs...');
    const auditDeleteResult = await client.query('DELETE FROM audit_logs WHERE user_id = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${auditDeleteResult.rowCount} audit log records`);

    // 5. Alerts acknowledged by these users
    console.log('Deleting alerts acknowledged by users...');
    const alertDeleteResult = await client.query('DELETE FROM alerts WHERE acknowledged_by = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${alertDeleteResult.rowCount} alert records`);

    // 6. Service requests created by these users
    console.log('Deleting service requests created by users...');
    const serviceRequestDeleteResult = await client.query('DELETE FROM service_requests WHERE created_by = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${serviceRequestDeleteResult.rowCount} service request records`);

    // 7. Invoices related to service requests created by these users
    console.log('Deleting invoices related to user-created service requests...');
    const invoiceDeleteResult = await client.query(`
      DELETE FROM invoices
      WHERE service_request_id IN (
        SELECT id FROM service_requests WHERE created_by = ANY($1)
      )
    `, [userIds]);
    console.log(`✅ Deleted ${invoiceDeleteResult.rowCount} invoice records`);

    // 8. Customers (if any)
    console.log('Deleting customers...');
    const customerDeleteResult = await client.query('DELETE FROM customers WHERE user_id = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${customerDeleteResult.rowCount} customer records`);

    // 9. Update service requests to remove technician assignments (set to NULL)
    console.log('Setting assigned_technician_id to NULL for service requests...');
    const updateAssignmentsResult = await client.query('UPDATE service_requests SET assigned_technician_id = NULL WHERE assigned_technician_id = ANY($1)', [userIds]);
    console.log(`✅ Updated ${updateAssignmentsResult.rowCount} service request assignments to NULL`);

    // Check for any remaining references
    const remainingRefs = await client.query('SELECT COUNT(*) as count FROM service_requests WHERE assigned_technician_id = ANY($1)', [userIds]);
    console.log(`Remaining service request references: ${remainingRefs.rows[0].count}`);

    // 10. Get technician IDs first, then delete technicians
    console.log('Getting technician IDs...');
    const technicianIdsResult = await client.query('SELECT id FROM technicians WHERE user_id = ANY($1)', [userIds]);
    const technicianIds = technicianIdsResult.rows.map(t => t.id);
    console.log(`Found ${technicianIds.length} technician records to delete`);

    if (technicianIds.length > 0) {
      // Update service requests to NULL for these technician IDs
      console.log('Setting technician assignments to NULL...');
      const finalUpdateResult = await client.query('UPDATE service_requests SET assigned_technician_id = NULL WHERE assigned_technician_id = ANY($1)', [technicianIds]);
      console.log(`✅ Updated ${finalUpdateResult.rowCount} service request assignments`);

      // Now delete technicians
      console.log('Deleting technicians...');
      const technicianDeleteResult = await client.query('DELETE FROM technicians WHERE id = ANY($1)', [technicianIds]);
      console.log(`✅ Deleted ${technicianDeleteResult.rowCount} technician records`);
    } else {
      console.log('No technicians to delete');
    }

    // 11. Delete manuals uploaded by these users
    console.log('Deleting manuals uploaded by users...');
    const manualDeleteResult = await client.query('DELETE FROM manuals WHERE uploaded_by = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${manualDeleteResult.rowCount} manual records`);

    // 12. Finally, delete the users
    console.log('Deleting users...');
    const userDeleteResult = await client.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    console.log(`✅ Deleted ${userDeleteResult.rowCount} user records`);

    // Verify deletion
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM users WHERE id = ANY($1)', [userIds]);
    console.log(`\n📊 Users remaining with these IDs: ${verifyResult.rows[0].count}`);
    console.log('✅ User deletion completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

deleteSpecificUsers();
