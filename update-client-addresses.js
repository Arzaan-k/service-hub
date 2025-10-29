import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateClientAddresses() {
  let client;
  try {
    client = await pool.connect();

    console.log('🏢 Starting client address update...\n');

    // Get current customer data
    const customers = await client.query(`
      SELECT
        c.id,
        c.company_name,
        c.billing_address,
        c.shipping_address,
        COUNT(cont.id) as container_count
      FROM customers c
      LEFT JOIN containers cont ON cont.assigned_client_id = c.id
      GROUP BY c.id, c.company_name, c.billing_address, c.shipping_address
      ORDER BY c.company_name
    `);

    console.log(`📊 Found ${customers.rows.length} customers\n`);

    let updated = 0;
    let skipped = 0;

    for (const customer of customers.rows) {
      console.log(`🏭 Processing: ${customer.company_name} (${customer.container_count} containers)`);

      // Get container locations for this customer
      const containerLocations = await client.query(`
        SELECT
          current_location->>'address' as address,
          current_location->>'city' as city,
          COUNT(*) as container_count
        FROM containers
        WHERE assigned_client_id = $1
          AND current_location->>'address' IS NOT NULL
        GROUP BY current_location->>'address', current_location->>'city'
        ORDER BY container_count DESC
        LIMIT 1
      `, [customer.id]);

      if (containerLocations.rows.length > 0) {
        const primaryLocation = containerLocations.rows[0];
        const fullAddress = `${primaryLocation.address}${primaryLocation.city ? `, ${primaryLocation.city}` : ''}`;

        // Update customer addresses
        await client.query(`
          UPDATE customers
          SET
            billing_address = COALESCE(billing_address, $1),
            shipping_address = COALESCE(shipping_address, $1),
            updated_at = NOW()
          WHERE id = $2
        `, [fullAddress, customer.id]);

        console.log(`✅ Updated: ${fullAddress}`);
        updated++;
      } else {
        console.log(`⏭️  Skipped: No container locations found`);
        skipped++;
      }

      console.log('');
    }

    // Show final statistics
    const finalStats = await client.query(`
      SELECT
        COUNT(*) as total_customers,
        COUNT(billing_address) as with_billing,
        COUNT(shipping_address) as with_shipping
      FROM customers
    `);

    console.log('📈 Final Statistics:');
    console.log(`   Total customers: ${finalStats.rows[0].total_customers}`);
    console.log(`   With billing address: ${finalStats.rows[0].with_billing}`);
    console.log(`   With shipping address: ${finalStats.rows[0].with_shipping}`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);

    // Show sample updated customers
    console.log('\n🔍 Sample updated customers:');
    const sampleCustomers = await client.query(`
      SELECT company_name, billing_address, shipping_address
      FROM customers
      WHERE billing_address IS NOT NULL
      LIMIT 5
    `);

    sampleCustomers.rows.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.company_name}`);
      console.log(`   Billing: ${customer.billing_address}`);
      console.log(`   Shipping: ${customer.shipping_address}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

updateClientAddresses();
