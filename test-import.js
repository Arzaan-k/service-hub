async function testImport() {
  try {
    const auth = await import('./server/services/auth.js');
    console.log('Auth import successful');
    console.log('Functions:', Object.keys(auth));
  } catch (error) {
    console.error('Auth import failed:', error.message);
  }
}

testImport();
