import { db } from './server/db.ts';
import { users } from './shared/schema.js';
import bcrypt from 'bcryptjs';

async function createAdminUser() {
  try {
    console.log('Checking for admin user...');

    // First check if admin user exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'admin@containergenie.com')
    });

    if (existingUser) {
      console.log('✅ Admin user already exists!');
      console.log('📧 Email: admin@containergenie.com');
      console.log('🔑 Password: admin123');
      console.log('🆔 User ID (Token):', existingUser.id);

      console.log('\n📋 Use this token in the bulk upload script:');
      console.log('AUTH_TOKEN="' + existingUser.id + '"');
      return;
    }

    console.log('Creating admin user...');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await db.insert(users).values({
      phoneNumber: '+12345678901',
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








