
import { db } from './server/db';
import { users } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
    const allUsers = await db.select().from(users).where(sql`${users.password} IS NOT NULL AND ${users.email} IS NOT NULL`).limit(1);
    console.log(JSON.stringify(allUsers, null, 2));
    process.exit(0);
}

main().catch(console.error);
