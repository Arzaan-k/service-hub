import { db } from './server/db.js';
import { manuals, users } from './shared/schema.js';

async function insertManualsDirect() {
  console.log('🌱 Inserting RAG manuals directly...');
  
  try {
    // Get a valid user ID for seeding
    const usersList = await db.select().from(users);
    const validUserId = usersList.length > 0 ? usersList[0].id : null;
    
    if (!validUserId) {
      throw new Error('No users found in database. Cannot seed manuals without a valid user ID.');
    }
    
    console.log(`Using user ID ${validUserId} for seeding manuals`);

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

    console.log(`Attempting to insert ${sampleManuals.length} manuals...`);

    let insertedCount = 0;
    for (const manual of sampleManuals) {
      console.log(`Inserting manual: ${manual.name}`);
      try {
        const [created] = await db.insert(manuals).values({
          ...manual,
          uploadedBy: validUserId, // Use valid user ID
          uploadedOn: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();

        console.log(`✅ Created manual: ${created.name}`);
        insertedCount++;
      } catch (insertError) {
        console.error(`❌ Error inserting manual ${manual.name}:`, insertError.message);
      }
    }

    console.log(`🎉 RAG manuals insertion completed! Inserted ${insertedCount} manuals.`);
    
    // Check if manuals were actually inserted
    const allManuals = await db.select().from(manuals);
    console.log(`Total manuals in database: ${allManuals.length}`);
    
    // Show all manuals
    for (const manual of allManuals) {
      console.log(`- ${manual.name} (v${manual.version || 'N/A'})`);
    }
  } catch (error) {
    console.error('❌ Error inserting manuals:', error);
  }
}

insertManualsDirect();