import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('Updating user role from technician to client...');

    // Update user role from technician to client
    const result = await sql`UPDATE users SET role = 'client' WHERE id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7'`;

    console.log('✅ User role updated successfully!');
    console.log('Rows affected:', result.length);

    // Verify the update
    const user = await sql`SELECT id, name, phone_number, role FROM users WHERE id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7'`;
    console.log('Updated user:', user[0]);

    // Check if they have a customer record
    const customer = await sql`SELECT * FROM customers WHERE user_id = 'cb4fa769-e1e9-4589-8301-6167afacc0b7'`;
    console.log('Customer record:', customer[0] || 'None found - may need to create one');

  } catch (error) {
    console.error('❌ Failed to update user role:', error);
  }
})();







