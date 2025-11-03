import { db } from './server/db.js';
import { users } from './shared/schema.js';
import bcrypt from 'bcryptjs';

async function createAdminUser() {
  try {
    console.log('Creating admin user...');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await db.insert(users).values({
      phoneNumber: '+1234567890',
      name: 'Admin User',
      email: 'admin@containergenie.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      whatsappVerified: true,
      emailVerified: true
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@containergenie.com');
    console.log('🔑 Password: admin123');
    console.log('🆔 User ID (Token):', adminUser[0].id);

    console.log('\n📋 Use this token in the bulk upload script:');
    console.log('AUTH_TOKEN="' + adminUser[0].id + '"');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

createAdminUser();





