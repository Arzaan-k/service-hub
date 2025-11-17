import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('Checking user records for phone 918218994855...');

    // Check the user
    const user = await sql`SELECT * FROM users WHERE id = 'e3d4fc35-93fc-492a-b6e5-02434aeb80ce'`;
    console.log('User:', user[0]);

    // Check if they have customer record by user_id
    const customerByUserId = await sql`SELECT * FROM customers WHERE user_id = 'e3d4fc35-93fc-492a-b6e5-02434aeb80ce'`;
    console.log('Customer record by user_id:', customerByUserId[0] || 'None');

    // Check if they have customer record by phone
    const customerByPhone = await sql`SELECT * FROM customers WHERE phone = '918218994855' OR whatsapp_number = '918218994855'`;
    console.log('Customer record by phone:', customerByPhone[0] || 'None');

    if (customerByUserId.length === 0 && customerByPhone.length > 0) {
      console.log('🔄 Linking existing customer record to user...');
      await sql`UPDATE customers SET user_id = 'e3d4fc35-93fc-492a-b6e5-02434aeb80ce' WHERE phone = '918218994855' OR whatsapp_number = '918218994855'`;
      console.log('✅ Customer linked to user successfully!');
    } else if (customerByUserId.length === 0 && customerByPhone.length === 0) {
      console.log('📝 Creating new customer record...');
      await sql`INSERT INTO customers (
        user_id, company_name, contact_person, email, phone,
        whatsapp_number, billing_address, customer_tier, payment_terms, status
      ) VALUES (
        'e3d4fc35-93fc-492a-b6e5-02434aeb80ce',
        'WhatsApp User',
        'WhatsApp User',
        'whatsapp@example.com',
        '918218994855',
        '918218994855',
        'Default Address',
        'standard',
        'net30',
        'active'
      )`;
      console.log('✅ Customer record created successfully!');
    } else {
      console.log('ℹ️ User already has proper customer record');
    }

    // Verify final state
    const finalCustomer = await sql`SELECT * FROM customers WHERE user_id = 'e3d4fc35-93fc-492a-b6e5-02434aeb80ce'`;
    console.log('Final customer record:', finalCustomer[0]);

  } catch (error) {
    console.error('❌ Error:', error);
  }
})();







