import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Running WhatsApp Enum Migration');
console.log('==================================================\n');

async function addEnumValue(enumType, value) {
  try {
    // Check if the value already exists
    const existing = await sql`
      SELECT 1 FROM pg_enum
      WHERE enumlabel = ${value}
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = ${enumType})
    `;

    if (existing.length > 0) {
      console.log(`  ℹ️  "${value}" already exists in ${enumType} enum`);
      return false;
    }

    // Add the new value using string interpolation (Neon doesn't support ALTER TYPE with parameterized queries)
    const query = `ALTER TYPE ${enumType} ADD VALUE '${value}'`;
    await sql(query);
    console.log(`  ✅ Added "${value}" to ${enumType} enum`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error adding "${value}" to ${enumType}:`, error.message);
    return false;
  }
}

try {
  console.log('Adding values to whatsapp_message_type enum...\n');

  await addEnumValue('whatsapp_message_type', 'image');
  await addEnumValue('whatsapp_message_type', 'video');
  await addEnumValue('whatsapp_message_type', 'document');
  await addEnumValue('whatsapp_message_type', 'audio');

  // Verify the enum values
  console.log('\n📋 Current enum values:');
  const enumValues = await sql`
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'whatsapp_message_type')
    ORDER BY enumsortorder
  `;

  enumValues.forEach(row => {
    console.log(`  • ${row.enumlabel}`);
  });

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n==================================================');
process.exit(0);
