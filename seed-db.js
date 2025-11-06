const { seedDatabase } = require('./server/seed-data.ts');

async function main() {
  try {
    console.log('Starting database seeding...');
    await seedDatabase();
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();

