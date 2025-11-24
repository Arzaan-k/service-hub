import { seedDatabase } from './server/seed-data.js';

async function runSeed() {
  try {
    console.log('Starting database seeding...');
    await seedDatabase();
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

runSeed();




