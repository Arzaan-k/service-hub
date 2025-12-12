
import axios from 'axios';
import { db } from './server/db';
import { containers } from './shared/schema';

async function main() {
    const loginUrl = 'http://localhost:5000/api/auth/login';
    const email = 'arzaan@example.com';
    const password = 'password123';

    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(loginUrl, { email, password });
        const token = loginRes.data.token;
        console.log('Login successful, token:', token);

        // 2. Get a container ID
        const container = await db.select().from(containers).limit(1);
        if (!container || container.length === 0) {
            console.error('No containers found');
            return;
        }
        const containerId = container[0].id;
        console.log('Testing with container ID:', containerId);

        // 3. Fetch detailed history
        const historyUrl = `http://localhost:5000/api/containers/${containerId}/service-history/detailed`;
        console.log('Fetching history from:', historyUrl);

        const historyRes = await axios.get(historyUrl, {
            headers: {
                'x-user-id': token
            }
        });

        console.log('History response status:', historyRes.status);
        console.log('History response data:', JSON.stringify(historyRes.data, null, 2).substring(0, 500) + '...');

    } catch (error: any) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
    process.exit(0);
}

main().catch(console.error);
