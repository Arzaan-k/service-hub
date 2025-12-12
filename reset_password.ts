
import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from './server/services/auth';

async function main() {
    const email = 'arzaan@example.com';
    const newPassword = 'password123';
    const hashedPassword = await hashPassword(newPassword);

    await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email));

    console.log(`Password updated for ${email}`);
    process.exit(0);
}

main().catch(console.error);
