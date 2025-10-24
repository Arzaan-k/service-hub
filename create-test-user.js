import 'dotenv/config';
import { storage } from './server/storage.js';

async function createTestUser() {
  try {
    console.log('🔄 Creating test user for dashboard access...');

    // Check if test user already exists
    const existingUser = await storage.getUserByEmail('test@example.com');
    if (existingUser) {
      console.log('✅ Test user already exists:', existingUser.email);
      console.log('🔑 Login credentials:');
      console.log('   Email: test@example.com');
      console.log('   Password: test123');
      console.log('   User ID:', existingUser.id);
      return;
    }

    // Create test user
    const user = await storage.createUser({
      phoneNumber: '+1234567890',
      name: 'Test Admin',
      email: 'test@example.com',
      password: await import('./server/services/auth.js').then(m => m.hashPassword('test123')),
      role: 'admin',
      isActive: true,
      whatsappVerified: false,
      emailVerified: true, // Mark as verified for easy testing
    });

    console.log('✅ Created test user:', user.email);
    console.log('🔑 Login credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: test123');
    console.log('   User ID:', user.id);

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

createTestUser();
