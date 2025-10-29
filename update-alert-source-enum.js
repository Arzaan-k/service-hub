import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function updateAlertSourceEnum() {
  try {
    console.log('Updating alert_source enum...');

    // Add new value to the existing enum
    await sql`
      ALTER TYPE alert_source ADD VALUE IF NOT EXISTS 'simulation';
    `;

    console.log('✅ Successfully updated alert_source enum');

    // Test the enum values
    const result = await sql`
      SELECT unnest(enum_range(NULL::alert_source)) as alert_source;
    `;

    console.log('Available alert sources:', result.map(r => r.alert_source));

  } catch (error) {
    console.error('Error updating enum:', error);
  }
}

updateAlertSourceEnum().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(console.error);







