import { registerAllTemplates, WHATSAPP_TEMPLATES } from './server/services/whatsapp.ts';

console.log(`📋 Found ${Object.keys(WHATSAPP_TEMPLATES).length} templates to register:`);
console.log(Object.keys(WHATSAPP_TEMPLATES).join(', '));

(async () => {
  try {
    console.log('\n🚀 Starting template registration...');
    const results = await registerAllTemplates();

    console.log('\n✅ Template registration completed!');
    console.log('Results:', JSON.stringify(results, null, 2));

    // Count successes and failures
    const successes = results.filter(r => r.status === 'success').length;
    const failures = results.filter(r => r.status === 'error').length;

    console.log(`\n📊 Summary: ${successes} succeeded, ${failures} failed`);

  } catch (error) {
    console.error('❌ Error registering templates:', error.message);
    console.error(error.stack);
  }
})();




