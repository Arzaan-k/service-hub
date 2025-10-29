import 'dotenv/config';
import fs from 'fs';
import path from 'path';

console.log('=== Environment Variables ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ENABLE_ORBCOMM_DEV:', process.env.ENABLE_ORBCOMM_DEV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

console.log('\n=== Available .env files ===');
const envFiles = ['.env', '.env.development', '.env.local', '.env.development.local'];
envFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`${file}: EXISTS`);
  } else {
    console.log(`${file}: NOT FOUND`);
  }
});

console.log('\n=== Relevant environment variables ===');
Object.keys(process.env).sort().forEach(key => {
  if (key.startsWith('NODE_') || key.startsWith('ENABLE_') || key.startsWith('FRONT')) {
    console.log(`${key}=${process.env[key]}`);
  }
});