import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateContainerLocation() {
  let client;
  try {
    client = await pool.connect();

    const containerId = 'CICU1799140';
    const fullAddress = 'Plot No 25,25Ato25K, Rambilli(M),Lalamkoduru(V), Anakapalli,-531011 AP India Ph No:7337384112';

    console.log('🔍 Updating container:', containerId);
    console.log('📍 New address:', fullAddress);

    // Update container location
    const updateResult = await client.query(`
      UPDATE containers
      SET current_location = $1,
          excel_metadata = COALESCE(excel_metadata, '{}'::jsonb) || $2,
          updated_at = NOW()
      WHERE container_id = $3
      RETURNING id, container_id, current_location
    `, [
      {
        address: fullAddress,
        city: 'Anakapalli',
        state: 'Andhra Pradesh',
        pincode: '531011',
        phone: '7337384112',
        source: 'manual_update',
        latitude: 17.6868,  // Approximate coordinates for Anakapalli
        longitude: 83.0036
      },
      {
        full_address: fullAddress,
        delivery_address: fullAddress,
        city: 'Anakapalli',
        state: 'Andhra Pradesh',
        pincode: '531011',
        phone: '7337384112',
        updated_at: new Date().toISOString()
      },
      containerId
    ]);

    if (updateResult.rows.length > 0) {
      console.log('✅ Container updated successfully');
      console.log('📦 Updated container:', updateResult.rows[0]);

      // Get the client information for this container
      const clientInfo = await client.query(`
        SELECT c.id, c.company_name, c.billing_address, c.shipping_address
        FROM customers c
        JOIN containers cont ON cont.assigned_client_id = c.id
        WHERE cont.container_id = $1
      `, [containerId]);

      if (clientInfo.rows.length > 0) {
        console.log('🏢 Associated client:', clientInfo.rows[0].company_name);
        console.log('📍 Client billing address:', clientInfo.rows[0].billing_address);
        console.log('📍 Client shipping address:', clientInfo.rows[0].shipping_address);

        // Update client address to match the primary container location
        const primaryLocation = 'Plot No 25,25Ato25K, Rambilli(M),Lalamkoduru(V), Anakapalli, Andhra Pradesh 531011';
        await client.query(`
          UPDATE customers
          SET billing_address = $1, shipping_address = $1, updated_at = NOW()
          WHERE id = $2
        `, [primaryLocation, clientInfo.rows[0].id]);

        console.log('✅ Client address updated to match container location');
        console.log('📍 New client address:', primaryLocation);
      } else {
        console.log('⚠️  No associated client found');
      }

    } else {
      console.log('❌ Container not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

updateContainerLocation();
