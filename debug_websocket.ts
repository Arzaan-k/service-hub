
import WebSocket from 'ws';
import axios from 'axios';

async function main() {
    const loginUrl = 'http://localhost:5000/api/auth/login';
    const email = 'arzaan@example.com';
    const password = 'password123';

    try {
        // 1. Login to get token
        console.log('Logging in...');
        const loginRes = await axios.post(loginUrl, { email, password });
        const token = loginRes.data.token;
        console.log('Login successful, token:', token);

        // 2. Connect to WebSocket
        const wsUrl = `ws://localhost:5000/ws?token=${token}`;
        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('WebSocket connected!');

            // Send authentication message (if needed, though query param might be enough)
            ws.send(JSON.stringify({ type: 'authenticate', token }));

            // Wait a bit and then close
            setTimeout(() => {
                console.log('Closing WebSocket...');
                ws.close();
                process.exit(0);
            }, 3000);
        });

        ws.on('message', (data) => {
            console.log('Received message:', data.toString());
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
            process.exit(1);
        });

        ws.on('close', (code, reason) => {
            console.log(`WebSocket closed: ${code} ${reason}`);
        });

    } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);
