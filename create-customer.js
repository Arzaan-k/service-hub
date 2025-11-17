import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('Checking customer records for user...');

    // Check if customer already exists by user_id
    const existingByUserId = await sql`SELECT * FROM customers WHERE user_id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7'`;
    if (existingByUserId.length > 0) {
      console.log('ℹ️ Customer record already exists for user_id:', existingByUserId[0]);
      return;
    }

    // Check if customer exists by phone number
    const existingByPhone = await sql`SELECT * FROM customers WHERE phone = '917021307474' OR whatsapp_number = '917021307474'`;
    if (existingByPhone.length > 0) {
      console.log('ℹ️ Customer record exists with phone number:', existingByPhone[0]);
      console.log('🔄 Linking existing customer to user...');

      // Link existing customer to user
      await sql`UPDATE customers SET user_id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7' WHERE phone = '917021307474' OR whatsapp_number = '917021307474'`;

      console.log('✅ Customer linked to user successfully!');
      const updated = await sql`SELECT * FROM customers WHERE user_id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7'`;
      console.log('Updated customer record:', updated[0]);
      return;
    }

    // Create a basic customer record
    const result = await sql`INSERT INTO customers (
      user_id, company_name, contact_person, email, phone,
      whatsapp_number, billing_address, customer_tier, payment_terms, status
    ) VALUES (
      'cb4fa769-e1e9-4589-8301-6167afacc0b7',
      'Test Company',
      'Test User',
      'test@example.com',
      '917021307474',
      '917021307474',
      'Test Address',
      'standard',
      'net30',
      'active'
    )`;

    console.log('✅ Customer record created successfully!');

    // Verify the customer record
    const customer = await sql`SELECT * FROM customers WHERE user_id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7'`;
    console.log('Customer record:', customer[0]);

  } catch (error) {
    console.error('❌ Failed to create customer record:', error);
  }
})();
