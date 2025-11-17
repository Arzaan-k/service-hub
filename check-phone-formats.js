import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('='.repeat(60));
console.log('  Checking Phone Number Formats in Database');
console.log('='.repeat(60));
console.log('');

try {
  // Check users table
  const users = await sql`SELECT id, name, phone_number, role FROM users LIMIT 10`;
  console.log('📱 Sample Users:');
  users.forEach(u => {
    console.log(`  • ${u.name}: ${u.phone_number} (role: ${u.role})`);
  });

  // Check customers
  const customers = await sql`
    SELECT c.id, c.company_name, u.phone_number, u.name, u.role
    FROM customers c
    JOIN users u ON c.user_id = u.id
    LIMIT 5
  `;
  console.log('\n🏢 Sample Customers:');
  customers.forEach(c => {
    console.log(`  • ${c.company_name}: ${c.phone_number} (${c.name}, role: ${c.role})`);
  });

  // Check technicians
  const techs = await sql`
    SELECT t.employee_code, u.phone_number, u.name, u.role
    FROM technicians t
    JOIN users u ON t.user_id = u.id
    LIMIT 5
  `;
  console.log('\n🔧 Sample Technicians:');
  techs.forEach(t => {
    console.log(`  • ${t.employee_code}: ${t.phone_number} (${t.name}, role: ${t.role})`);
  });

  // Analyze phone number patterns
  const allUsers = await sql`SELECT phone_number FROM users WHERE phone_number IS NOT NULL`;
  console.log('\n📊 Phone Number Patterns Analysis:');
  console.log(`  Total users: ${allUsers.length}`);

  const patterns = {
    withPlus: 0,
    with91Prefix: 0,
    tenDigit: 0,
    other: 0
  };

  allUsers.forEach(u => {
    const phone = u.phone_number;
    if (phone.startsWith('+')) patterns.withPlus++;
    else if (phone.startsWith('91') && phone.length === 12) patterns.with91Prefix++;
    else if (phone.length === 10) patterns.tenDigit++;
    else patterns.other++;
  });

  console.log(`  With + prefix: ${patterns.withPlus}`);
  console.log(`  With 91 prefix: ${patterns.with91Prefix}`);
  console.log(`  10-digit: ${patterns.tenDigit}`);
  console.log(`  Other formats: ${patterns.other}`);

  // Show examples of each pattern
  console.log('\n📋 Pattern Examples:');
  const examples = {
    withPlus: allUsers.find(u => u.phone_number.startsWith('+')),
    with91: allUsers.find(u => u.phone_number.startsWith('91') && u.phone_number.length === 12),
    tenDigit: allUsers.find(u => u.phone_number.length === 10)
  };

  if (examples.withPlus) console.log(`  +91 format: ${examples.withPlus.phone_number}`);
  if (examples.with91) console.log(`  91 format: ${examples.with91.phone_number}`);
  if (examples.tenDigit) console.log(`  10-digit: ${examples.tenDigit.phone_number}`);

} catch (error) {
  console.error('Error:', error);
}

console.log('\n' + '='.repeat(60));
process.exit(0);
