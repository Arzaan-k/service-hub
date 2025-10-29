import { db } from './server/db.js';
import { manuals } from './shared/schema.js';

async function seedManuals() {
  console.log('🌱 Seeding RAG manuals...');
  
  try {
    // Create sample manuals for testing
    const sampleManuals = [
      {
        name: 'Thermo King SL-500 Service Manual',
        sourceUrl: 'https://example.com/thermo-king-sl500.pdf',
        version: 'v2.1',
        meta: {
          brand: 'Thermo King',
          model: 'SL-500',
          alarms: ['17', '23', '45', '12'],
          components: ['Return Air Sensor', 'Supply Air Sensor', 'Defrost Timer', 'Control Board']
        }
      },
      {
        name: 'Carrier Transicold Manual',
        sourceUrl: 'https://example.com/carrier-transicold.pdf',
        version: 'v1.8',
        meta: {
          brand: 'Carrier',
          model: 'Transicold',
          alarms: ['12', '17', '34', '56'],
          components: ['Temperature Sensor', 'Pressure Switch', 'Compressor', 'Condenser']
        }
      },
      {
        name: 'Daikin Reefer Container Manual',
        sourceUrl: 'https://example.com/daikin-reefer.pdf',
        version: 'v3.2',
        meta: {
          brand: 'Daikin',
          model: 'Reefer',
          alarms: ['01', '02', '03', '10'],
          components: ['Fresh Air Exchange', 'Humidity Control', 'Power Module', 'Display Panel']
        }
      }
    ];
    
    for (const manual of sampleManuals) {
      const [created] = await db.insert(manuals).values({
        ...manual,
        uploadedBy: 'system', // System seeded data
        uploadedOn: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log(`✅ Created manual: ${created.name}`);
    }
    
    console.log('🎉 RAG manuals seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding manuals:', error);
  }
}

seedManuals();